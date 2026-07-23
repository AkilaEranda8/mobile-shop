import { PaymentMethod } from '@prisma/client'
import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { generateReturnNumber } from '../../utils/counters'
import { verifyTenantAdminPassword } from '../../utils/admin-password.util'
import { assertBusinessDayOpenIfEnabled } from '../daily-closing/day-lock.util'
import { assertBranchRecordAccess } from '../../utils/active-branch'
import { voidWarrantiesForSaleReturn } from '../warranty/warranty.service'
import { emitSaleReturnAccounting } from '../accounting/integration/accounting-events.service'
import { createPostedJournalEntry } from '../accounting/journals/journal-create.service'
import type { JournalDraftLine } from '../accounting/journals/journal-validator.util'
import { hasVariants, sumVariantStock } from '../../utils/product-variants'
import type { Request } from 'express'

const round2 = (n: number) => Math.round(n * 100) / 100

type ReturnRequestItem = {
  saleItemId?: string | null
  productId?: string | null
  productName?: string
  quantity: number
  imei?: string | null
}

export type ProcessSaleReturnInput = {
  tenantId: string
  saleId: string
  performedBy: string
  actorEmail?: string
  items: ReturnRequestItem[]
  reason: string
  refundMethod: string
  notes?: string | null
  req?: Request
}

async function resolveAccountIdByKey(tenantId: string, key: string) {
  const settings = await prisma.accountingSettings.findUnique({ where: { tenantId } })
  if (!settings?.initializedAt) return null
  const map = (settings.defaultAccounts ?? {}) as Record<string, unknown>
  const val = map[key]
  return typeof val === 'string' && val ? val : null
}

async function resolveBranchCashGlAccountId(tenantId: string, branchId: string) {
  const cash = await prisma.cashAccount.findFirst({
    where: { tenantId, branchId, name: 'Main Cash', isActive: true },
    select: { glAccountId: true },
  })
  return cash?.glAccountId ?? null
}

export async function processSaleReturn(input: ProcessSaleReturnInput) {
  const sale = await prisma.sale.findFirst({
    where: { id: input.saleId, tenantId: input.tenantId },
    include: { items: true },
  })
  if (!sale) throw new AppError('Sale not found', 404)
  if (input.req) assertBranchRecordAccess(input.req, sale.branchId)
  if (sale.status === 'RETURNED') throw new AppError('This order has already been fully returned', 400)
  await assertBusinessDayOpenIfEnabled(input.tenantId, sale.branchId)

  if (!input.items?.length) throw new AppError('No items provided for return', 400)

  const requested = input.items.map(raw => ({
    saleItemId: raw?.saleItemId ? String(raw.saleItemId) : null,
    productId: raw?.productId ? String(raw.productId) : null,
    productName: String(raw?.productName ?? ''),
    quantity: Number(raw?.quantity ?? 0),
    imei: raw?.imei ? String(raw.imei).trim() : null,
  }))
  if (requested.some(r => !r.quantity || r.quantity < 0)) throw new AppError('Invalid return quantity', 400)

  const saleItemsById = new Map((sale.items ?? []).map(si => [si.id, si]))

  const priorReturns = await prisma.saleReturn.findMany({
    where: { saleId: sale.id },
    include: { items: true },
  })
  const alreadyReturnedBySaleItem: Record<string, number> = {}
  const alreadyReturnedByProductSku: Record<string, number> = {}
  for (const ret of priorReturns) {
    for (const ri of ret.items) {
      if (ri.productId) {
        const key = `${ri.productId}::${(sale.items.find(si => si.productId === ri.productId)?.sku ?? '')}`
        alreadyReturnedByProductSku[key] = (alreadyReturnedByProductSku[key] ?? 0) + ri.quantity
      }
    }
  }
  // Also count prior by matching productName+qty when productId missing (legacy)
  for (const ret of priorReturns) {
    for (const ri of ret.items) {
      if (!ri.productId) {
        const match = sale.items.find(si => si.productName === ri.productName)
        if (match) {
          alreadyReturnedBySaleItem[match.id] = (alreadyReturnedBySaleItem[match.id] ?? 0) + ri.quantity
        }
      }
    }
  }

  const resolved = requested.map(ri => {
    let orig = ri.saleItemId ? saleItemsById.get(ri.saleItemId) : undefined
    if (!orig && ri.productId) orig = sale.items.find(si => si.productId === ri.productId)
    if (!orig) throw new AppError(`Item "${ri.productName || 'Unknown'}" not found in original sale`, 400)

    const priorQty = alreadyReturnedBySaleItem[orig.id]
      ?? (orig.productId
        ? (alreadyReturnedByProductSku[`${orig.productId}::${orig.sku ?? ''}`] ?? 0)
        : 0)
    const available = Number(orig.quantity) - priorQty
    if (available <= 0) throw new AppError(`"${orig.productName}" has already been fully returned`, 400)
    if (ri.quantity > available) {
      throw new AppError(`Return qty for "${orig.productName}" exceeds available (${available} remaining)`, 400)
    }

    const unitNet = Number(orig.quantity) > 0 ? Number(orig.total) / Number(orig.quantity) : Number(orig.unitPrice)
    const lineTotal = round2(unitNet * ri.quantity)
    return {
      saleItemId: orig.id,
      productId: orig.productId ?? null,
      productName: orig.productName,
      sku: orig.sku ?? '',
      imei: (ri.imei || orig.imei || null) as string | null,
      quantity: ri.quantity,
      unitPrice: Number(orig.unitPrice),
      total: lineTotal,
    }
  })

  for (const r of resolved) {
    const orig = saleItemsById.get(r.saleItemId)
    if (!r.imei && orig?.imei) throw new AppError(`IMEI required for "${r.productName}"`, 400)
    if ((orig?.imei || r.imei) && r.quantity !== 1) {
      throw new AppError(`IMEI products must be returned one unit per line: "${r.productName}"`, 400)
    }
  }

  const method = String(input.refundMethod || 'CASH').toUpperCase()
  if (!['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'WALLET', 'CHEQUE', 'CREDIT'].includes(method)) {
    throw new AppError('Invalid refund method', 400)
  }

  const returnNumber = await generateReturnNumber(input.tenantId)
  const refundAmount = round2(resolved.reduce((s, i) => s + Number(i.total), 0))
  const branchId = sale.branchId

  const totalSoldQty = sale.items.reduce((s, i) => s + i.quantity, 0)
  const totalNewQty = resolved.reduce((s, i) => s + Number(i.quantity), 0)
  const totalPriorBySaleItem = Object.values(alreadyReturnedBySaleItem).reduce((s, v) => s + v, 0)
  const totalPriorBySku = Object.values(alreadyReturnedByProductSku).reduce((s, v) => s + v, 0)
  const totalPriorQty = totalPriorBySaleItem > 0 ? totalPriorBySaleItem : totalPriorBySku
  const newSaleStatus = (totalPriorQty + totalNewQty >= totalSoldQty) ? 'RETURNED' as const : sale.status
  const isFullReturn = newSaleStatus === 'RETURNED'

  const saleReturn = await prisma.$transaction(async (tx) => {
    const ret = await tx.saleReturn.create({
      data: {
        tenantId: input.tenantId,
        branchId,
        saleId: sale.id,
        returnNumber,
        reason: input.reason,
        refundAmount,
        refundMethod: method as PaymentMethod,
        processedBy: input.performedBy,
        notes: input.notes ?? null,
        items: {
          create: resolved.map(i => ({
            productId: i.productId ?? undefined,
            productName: i.productName,
            quantity: Number(i.quantity),
            unitPrice: Number(i.unitPrice),
            total: Number(i.total),
          })),
        },
      },
      include: { items: true },
    })

    for (const ri of resolved) {
      if (ri.productId) {
        const product = await tx.product.findUnique({
          where: { id: ri.productId },
          select: { storageVariations: true },
        })
        await tx.product.update({
          where: { id: ri.productId },
          data: { stock: { increment: Number(ri.quantity) } },
        })

        if (product?.storageVariations && ri.sku) {
          let updated = product.storageVariations as any[]
          if (Array.isArray(updated)) {
            let changed = false
            updated = updated.map((v: any) => {
              if (v?.sku && v.sku === ri.sku) {
                changed = true
                return { ...v, stock: Number(v.stock ?? 0) + Number(ri.quantity) }
              }
              return v
            })
            if (changed) {
              await tx.product.update({
                where: { id: ri.productId },
                data: { storageVariations: updated },
              })
            }
          }
        }

        if (!sale.branchId) throw new AppError('Sale branch is required to restore stock', 400)
        await tx.stockMovement.create({
          data: {
            productId: ri.productId,
            branchId: sale.branchId,
            type: 'RETURN',
            quantity: Number(ri.quantity),
            reference: returnNumber,
            note: `Return for ${sale.invoiceNumber} — ${input.reason}`,
            performedBy: input.performedBy,
          },
        })
      }
      if (ri.imei) {
        await tx.imeiRecord.updateMany({
          where: { imei: ri.imei, ...(ri.productId ? { productId: ri.productId } : {}) },
          data: { status: 'IN_STOCK', saleId: null, customerId: null },
        })
      }
    }

    const refundFromPaid = Math.min(refundAmount, sale.paidAmount)
    const refundFromDue = Math.max(0, refundAmount - refundFromPaid)

    await tx.sale.update({
      where: { id: sale.id },
      data: {
        status: newSaleStatus,
        total: { decrement: refundAmount },
        paidAmount: { decrement: refundFromPaid },
        ...(refundFromDue > 0 && { dueAmount: { decrement: refundFromDue } }),
      },
    })

    if (refundFromDue > 0 && sale.customerId) {
      await tx.customer.update({
        where: { id: sale.customerId },
        data: { totalDue: { decrement: refundFromDue } },
      }).catch(() => {})
    }

    const origIncomeTx = await tx.transaction.findFirst({
      where: { reference: sale.invoiceNumber, type: 'INCOME', tenantId: input.tenantId },
    })
    if (origIncomeTx) {
      const newAmount = origIncomeTx.amount - refundAmount
      if (newAmount <= 0) {
        await tx.transaction.delete({ where: { id: origIncomeTx.id } })
      } else {
        await tx.transaction.update({ where: { id: origIncomeTx.id }, data: { amount: newAmount } })
      }
    }

    if (isFullReturn && sale.customerId) {
      await tx.customer.update({
        where: { id: sale.customerId },
        data: { totalPurchases: { decrement: 1 } },
      }).catch(() => {})
    }

    const returnedImeis = resolved.map(ri => ri.imei).filter(Boolean) as string[]
    await voidWarrantiesForSaleReturn(tx, input.tenantId, sale.id, returnedImeis)

    return ret
  })

  void emitSaleReturnAccounting(input.tenantId, saleReturn.id, branchId ?? sale.branchId, input.actorEmail)
  return saleReturn
}

/** Void / delete a sale invoice: full return of remaining qty + admin password. */
export async function voidSaleInvoice(opts: {
  tenantId: string
  saleId: string
  adminPassword: string
  reason?: string
  performedBy: string
  actorEmail?: string
  req?: Request
}) {
  await verifyTenantAdminPassword(opts.tenantId, opts.adminPassword)

  const sale = await prisma.sale.findFirst({
    where: { id: opts.saleId, tenantId: opts.tenantId },
    include: { items: true, returns: { include: { items: true } } },
  })
  if (!sale) throw new AppError('Sale not found', 404)
  if (opts.req) assertBranchRecordAccess(opts.req, sale.branchId)
  if (sale.status === 'RETURNED') throw new AppError('Sale is already fully returned / voided', 400)
  if (sale.source === 'OPENING_BALANCE') {
    throw new AppError('Opening balance invoices cannot be voided from Sales. Adjust via customer credit.', 400)
  }

  const priorBySaleItem: Record<string, number> = {}
  for (const ret of sale.returns) {
    for (const ri of ret.items) {
      const match = sale.items.find(si =>
        (ri.productId && si.productId === ri.productId) || si.productName === ri.productName,
      )
      if (match) priorBySaleItem[match.id] = (priorBySaleItem[match.id] ?? 0) + ri.quantity
    }
  }

  const itemsToReturn: ReturnRequestItem[] = []
  for (const si of sale.items) {
    const already = priorBySaleItem[si.id] ?? 0
    const qty = Number(si.quantity) - already
    if (qty <= 0) continue
    itemsToReturn.push({
      saleItemId: si.id,
      productId: si.productId,
      productName: si.productName,
      quantity: qty,
      imei: si.imei,
    })
  }
  if (!itemsToReturn.length) throw new AppError('Nothing left to void on this invoice', 400)

  const reason = (opts.reason?.trim() || 'Voided by admin').slice(0, 200)
  const saleReturn = await processSaleReturn({
    tenantId: opts.tenantId,
    saleId: opts.saleId,
    performedBy: opts.performedBy,
    actorEmail: opts.actorEmail,
    items: itemsToReturn,
    reason,
    refundMethod: 'CASH',
    notes: `VOID — ${reason}`,
    req: opts.req,
  })

  const voidNote = `[VOIDED ${new Date().toISOString().slice(0, 10)}] ${reason}`
  await prisma.sale.update({
    where: { id: opts.saleId },
    data: {
      notes: sale.notes ? `${sale.notes}\n${voidNote}` : voidNote,
      status: 'RETURNED',
    },
  })

  return { saleReturn, voided: true }
}

export type UpdateSaleInput = {
  tenantId: string
  saleId: string
  adminPassword: string
  performedBy: string
  actorEmail?: string
  req?: Request
  customerName?: string | null
  customerPhone?: string | null
  notes?: string | null
  discount?: number
  items?: Array<{ id: string; unitPrice: number; quantity?: number }>
  payments?: Array<{ id?: string; method: string; amount: number; reference?: string | null }>
}

/** Edit sale invoice (price + quantity). Requires admin password. */
export async function updateSaleInvoice(input: UpdateSaleInput) {
  await verifyTenantAdminPassword(input.tenantId, input.adminPassword)

  const sale = await prisma.sale.findFirst({
    where: { id: input.saleId, tenantId: input.tenantId },
    include: { items: true, payments: true, returns: { select: { id: true } } },
  })
  if (!sale) throw new AppError('Sale not found', 404)
  if (input.req) assertBranchRecordAccess(input.req, sale.branchId)
  if (sale.status === 'RETURNED') throw new AppError('Cannot edit a fully returned / voided sale', 400)
  if (sale.returns.length > 0 && (input.items?.length || input.discount != null || input.payments?.length)) {
    throw new AppError('Cannot change prices or payments on a sale that already has returns. Void remaining items or process a new sale.', 400)
  }
  if (sale.source === 'OPENING_BALANCE' && (input.items?.length || input.discount != null || input.payments?.length)) {
    throw new AppError('Opening balance invoices only allow customer name / phone / notes edits', 400)
  }

  await assertBusinessDayOpenIfEnabled(input.tenantId, sale.branchId)

  const prevTotal = round2(Number(sale.total))
  const prevPaid = round2(Number(sale.paidAmount))
  const prevDue = round2(Number(sale.dueAmount))

  type EditableItem = (typeof sale.items)[number] & { qtyDelta: number }
  let items: EditableItem[] = sale.items.map(i => ({ ...i, qtyDelta: 0 }))
  if (input.items?.length) {
    const byId = new Map(input.items.map(i => [i.id, i]))
    items = items.map(row => {
      const patch = byId.get(row.id)
      if (!patch) return { ...row, qtyDelta: 0 }
      const unitPrice = round2(Number(patch.unitPrice))
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new AppError(`Invalid unit price for "${row.productName}"`, 400)
      }
      const quantity = patch.quantity != null ? Math.floor(Number(patch.quantity)) : Number(row.quantity)
      if (!Number.isFinite(quantity) || quantity < 1) {
        throw new AppError(`Invalid quantity for "${row.productName}" (minimum 1)`, 400)
      }
      if (row.imei && quantity !== 1) {
        throw new AppError(`IMEI items must stay quantity 1: "${row.productName}"`, 400)
      }
      const lineDiscount = round2(Number(row.discount ?? 0))
      const total = round2(unitPrice * quantity - lineDiscount)
      return {
        ...row,
        unitPrice,
        quantity,
        total,
        qtyDelta: quantity - Number(row.quantity),
      }
    })
  }

  const subtotal = round2(items.reduce((s, i) => s + Number(i.unitPrice) * Number(i.quantity), 0))
  const discount = input.discount != null ? round2(Number(input.discount)) : round2(Number(sale.discount))
  if (!Number.isFinite(discount) || discount < 0) throw new AppError('Invalid discount', 400)
  if (discount > subtotal + 0.01) throw new AppError('Discount cannot exceed subtotal', 400)
  const tax = round2(Number(sale.tax ?? 0))
  const total = round2(Math.max(0, subtotal - discount + tax))

  let payments: Array<{ id?: string; method: string; amount: number; reference: string | null }> = sale.payments.map(p => ({
    id: p.id,
    method: p.method as string,
    amount: round2(Number(p.amount)),
    reference: p.reference,
  }))
  if (input.payments) {
    payments = input.payments.map(p => {
      const method = String(p.method || 'CASH').toUpperCase()
      if (!['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'WALLET', 'CHEQUE', 'CREDIT'].includes(method)) {
        throw new AppError(`Invalid payment method: ${p.method}`, 400)
      }
      const amount = round2(Number(p.amount))
      if (!Number.isFinite(amount) || amount < 0) throw new AppError('Invalid payment amount', 400)
      return {
        id: p.id,
        method,
        amount,
        reference: p.reference ?? null,
      }
    })
  }

  const creditPaid = round2(payments.filter(p => p.method === 'CREDIT').reduce((s, p) => s + p.amount, 0))
  const cashPaid = round2(payments.filter(p => p.method !== 'CREDIT').reduce((s, p) => s + p.amount, 0))
  const paidAmount = cashPaid
  const dueAmount = round2(Math.max(0, total - paidAmount))
  const effectiveDue = round2(Math.max(dueAmount, creditPaid > 0 ? creditPaid : dueAmount))
  const finalPaid = round2(Math.max(0, total - effectiveDue))

  if (effectiveDue > 0 && !sale.customerId) {
    throw new AppError('Customer is required when the invoice has an outstanding balance', 400)
  }

  let status: 'PAID' | 'PARTIAL' | 'DUE' = 'PAID'
  if (effectiveDue >= total - 0.01 && total > 0) status = 'DUE'
  else if (effectiveDue > 0.01) status = 'PARTIAL'
  else status = 'PAID'

  const customerName = input.customerName !== undefined
    ? (input.customerName?.trim() || null)
    : sale.customerName
  const customerPhone = input.customerPhone !== undefined
    ? (input.customerPhone?.trim() || null)
    : sale.customerPhone
  const notes = input.notes !== undefined
    ? (input.notes?.trim() || null)
    : sale.notes

  const updated = await prisma.$transaction(async (tx) => {
    // Stock adjustments for quantity changes (qtyDelta > 0 = more sold = reduce stock)
    for (const row of items) {
      if (!row.productId || row.qtyDelta === 0 || !sale.branchId) continue

      const product = await tx.product.findUnique({
        where: { id: row.productId },
        select: { stock: true, name: true, storageVariations: true, trackImei: true },
      })
      if (!product) continue
      if (product.trackImei) {
        throw new AppError(`Cannot change quantity for IMEI-tracked product "${product.name}"`, 400)
      }

      const variantMode = hasVariants(product.storageVariations)
      if (row.qtyDelta > 0) {
        const available = variantMode ? sumVariantStock(product.storageVariations) : product.stock
        if (available < row.qtyDelta) {
          throw new AppError(
            `Insufficient stock for "${product.name}". Available: ${available}, needed extra: ${row.qtyDelta}`,
            400,
          )
        }
        if (variantMode && row.sku) {
          let updatedVars = product.storageVariations as any[]
          let changed = false
          updatedVars = updatedVars.map((v: any) => {
            if (v?.sku && v.sku === row.sku) {
              const next = Number(v.stock ?? 0) - row.qtyDelta
              if (next < 0) throw new AppError(`Insufficient variant stock for "${product.name}" (${row.sku})`, 400)
              changed = true
              return { ...v, stock: next }
            }
            return v
          })
          if (!changed) throw new AppError(`Variant SKU "${row.sku}" not found on "${product.name}"`, 400)
          await tx.product.update({
            where: { id: row.productId },
            data: { stock: { decrement: row.qtyDelta }, storageVariations: updatedVars },
          })
        } else {
          await tx.product.update({
            where: { id: row.productId },
            data: { stock: { decrement: row.qtyDelta } },
          })
        }
        await tx.stockMovement.create({
          data: {
            productId: row.productId,
            branchId: sale.branchId,
            type: 'SALE',
            quantity: row.qtyDelta,
            reference: sale.invoiceNumber,
            note: `Sale edit — qty +${row.qtyDelta} on ${sale.invoiceNumber}`,
            performedBy: input.performedBy,
          },
        })
      } else {
        const restore = Math.abs(row.qtyDelta)
        if (variantMode && row.sku) {
          let updatedVars = product.storageVariations as any[]
          let changed = false
          updatedVars = updatedVars.map((v: any) => {
            if (v?.sku && v.sku === row.sku) {
              changed = true
              return { ...v, stock: Number(v.stock ?? 0) + restore }
            }
            return v
          })
          if (!changed) throw new AppError(`Variant SKU "${row.sku}" not found on "${product.name}"`, 400)
          await tx.product.update({
            where: { id: row.productId },
            data: { stock: { increment: restore }, storageVariations: updatedVars },
          })
        } else {
          await tx.product.update({
            where: { id: row.productId },
            data: { stock: { increment: restore } },
          })
        }
        await tx.stockMovement.create({
          data: {
            productId: row.productId,
            branchId: sale.branchId,
            type: 'ADJUSTMENT',
            quantity: restore,
            reference: sale.invoiceNumber,
            note: `Sale edit — qty -${restore} on ${sale.invoiceNumber} (stock restored)`,
            performedBy: input.performedBy,
          },
        })
      }
    }

    for (const row of items) {
      await tx.saleItem.update({
        where: { id: row.id },
        data: { unitPrice: row.unitPrice, quantity: row.quantity, total: row.total },
      })
    }

    await tx.salePayment.deleteMany({ where: { saleId: sale.id } })
    if (payments.length) {
      await tx.salePayment.createMany({
        data: payments.map(p => ({
          saleId: sale.id,
          method: p.method as PaymentMethod,
          amount: p.amount,
          reference: p.reference || undefined,
        })),
      })
    }

    const dueDelta = round2(effectiveDue - prevDue)
    if (sale.customerId && Math.abs(dueDelta) >= 0.01) {
      await tx.customer.update({
        where: { id: sale.customerId },
        data: { totalDue: { increment: dueDelta } },
      })
    }

    const s = await tx.sale.update({
      where: { id: sale.id },
      data: {
        customerName,
        customerPhone,
        notes,
        subtotal,
        discount,
        tax,
        total,
        paidAmount: finalPaid,
        dueAmount: effectiveDue,
        status,
      },
      include: { items: true, payments: true },
    })

    const incomeTx = await tx.transaction.findFirst({
      where: { reference: sale.invoiceNumber, type: 'INCOME', tenantId: input.tenantId },
    })
    if (incomeTx) {
      if (finalPaid <= 0) {
        await tx.transaction.delete({ where: { id: incomeTx.id } })
      } else {
        await tx.transaction.update({
          where: { id: incomeTx.id },
          data: {
            amount: finalPaid,
            description: `Sale ${sale.invoiceNumber} (edited)`,
          },
        })
      }
    } else if (finalPaid > 0 && sale.branchId) {
      await tx.transaction.create({
        data: {
          tenantId: input.tenantId,
          branchId: sale.branchId,
          type: 'INCOME',
          category: 'Sales',
          amount: finalPaid,
          description: `Sale ${sale.invoiceNumber} (edited)`,
          paymentMethod: (payments.find(p => p.method !== 'CREDIT')?.method as PaymentMethod) || 'CASH',
          reference: sale.invoiceNumber,
          performedBy: input.performedBy,
        },
      })
    }

    return s
  })

  // GL adjustment when totals / paid / due change and accounting is live
  const totalDelta = round2(total - prevTotal)
  const paidDelta = round2(finalPaid - prevPaid)
  const dueDelta = round2(effectiveDue - prevDue)
  if (sale.branchId && (Math.abs(totalDelta) >= 0.01 || Math.abs(paidDelta) >= 0.01 || Math.abs(dueDelta) >= 0.01)) {
    try {
      await postSaleEditAdjustmentJournal({
        tenantId: input.tenantId,
        branchId: sale.branchId,
        saleId: sale.id,
        invoiceNumber: sale.invoiceNumber,
        customerId: sale.customerId,
        totalDelta,
        paidDelta,
        dueDelta,
        actorEmail: input.actorEmail,
      })
    } catch (err) {
      console.error('[sales] edit GL adjustment failed:', err)
    }
  }

  return updated
}

async function postSaleEditAdjustmentJournal(opts: {
  tenantId: string
  branchId: string
  saleId: string
  invoiceNumber: string
  customerId: string | null
  totalDelta: number
  paidDelta: number
  dueDelta: number
  actorEmail?: string
}) {
  const settings = await prisma.accountingSettings.findUnique({ where: { tenantId: opts.tenantId } })
  if (!settings?.initializedAt || !settings.autoPostEnabled) return null

  const linked = await prisma.integrationLink.findUnique({
    where: {
      tenantId_sourceType_sourceId_eventType: {
        tenantId: opts.tenantId,
        sourceType: 'Sale',
        sourceId: opts.saleId,
        eventType: 'SALE_CREATED',
      },
    },
  })
  if (!linked) return null

  const salesAcc = await resolveAccountIdByKey(opts.tenantId, 'salesAccessory')
    ?? await resolveAccountIdByKey(opts.tenantId, 'salesMobile')
  const arAcc = await resolveAccountIdByKey(opts.tenantId, 'ar')
  const cashAcc = await resolveBranchCashGlAccountId(opts.tenantId, opts.branchId)
  if (!salesAcc || !cashAcc || !arAcc) return null

  const lines: JournalDraftLine[] = []
  const absPaid = round2(Math.abs(opts.paidDelta))
  const absDue = round2(Math.abs(opts.dueDelta))
  const absTotal = round2(Math.abs(opts.totalDelta))

  // Revenue side follows total delta
  if (opts.totalDelta > 0.009) {
    lines.push({ accountId: salesAcc, debit: 0, credit: absTotal, description: 'Sales revenue adjustment' })
  } else if (opts.totalDelta < -0.009) {
    lines.push({ accountId: salesAcc, debit: absTotal, credit: 0, description: 'Sales revenue adjustment' })
  }

  if (opts.paidDelta > 0.009) {
    lines.push({ accountId: cashAcc, debit: absPaid, credit: 0, description: 'Cash receipt adjustment' })
  } else if (opts.paidDelta < -0.009) {
    lines.push({ accountId: cashAcc, debit: 0, credit: absPaid, description: 'Cash receipt adjustment' })
  }

  if (opts.dueDelta > 0.009) {
    lines.push({
      accountId: arAcc,
      debit: absDue,
      credit: 0,
      description: 'AR adjustment',
      customerId: opts.customerId ?? undefined,
    })
  } else if (opts.dueDelta < -0.009) {
    lines.push({
      accountId: arAcc,
      debit: 0,
      credit: absDue,
      description: 'AR adjustment',
      customerId: opts.customerId ?? undefined,
    })
  }

  // Balance any rounding residue against sales
  const debit = round2(lines.reduce((s, l) => s + l.debit, 0))
  const credit = round2(lines.reduce((s, l) => s + l.credit, 0))
  const gap = round2(debit - credit)
  if (Math.abs(gap) >= 0.01) {
    if (gap > 0) lines.push({ accountId: salesAcc, debit: 0, credit: gap, description: 'Rounding' })
    else lines.push({ accountId: salesAcc, debit: Math.abs(gap), credit: 0, description: 'Rounding' })
  }

  const balDebit = round2(lines.reduce((s, l) => s + l.debit, 0))
  const balCredit = round2(lines.reduce((s, l) => s + l.credit, 0))
  if (Math.abs(balDebit - balCredit) >= 0.01 || balDebit < 0.01) return null

  return createPostedJournalEntry({
    tenantId: opts.tenantId,
    branchId: opts.branchId,
    sourceModule: 'SALES',
    sourceRefType: 'Sale',
    sourceRefId: opts.saleId,
    sourceEvent: 'SALE_EDITED',
    memo: `Sale edit adjustment ${opts.invoiceNumber}`,
    createdByEmail: opts.actorEmail,
    lines,
  })
}
