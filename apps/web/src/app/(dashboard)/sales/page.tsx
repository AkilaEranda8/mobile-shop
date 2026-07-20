'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Receipt, Eye, X, Calendar, User, Package,
  CreditCard, Loader2, Hash, ShoppingBag,
  Banknote, Smartphone, TrendingUp, Download, Truck, RotateCcw,
  Pencil, Trash2, Lock, AlertTriangle,
} from 'lucide-react'
import { TableDensityToggle, type TableDensity } from '@/components/ui/TableDensityToggle'
import { type ColumnDef } from '@tanstack/react-table'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { TableActionsRow } from '@/components/table/table-actions-row'
import { ToolbarSearch } from '@/components/ui/toolbar-search'
import { salesApi } from '@/lib/api'
import { authStorage } from '@/lib/auth'
import { getActiveBranchId } from '@/lib/active-branch'
import { formatDate, formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'
import { getInvoiceSettings, fetchInvoiceSettings, resolveInvoiceTemplate, type InvoiceSettings } from '@/lib/invoiceSettings'
import InvoiceA4View from '@/components/invoice/InvoiceA4View'
import { OpenPosButton } from '@/components/pos/OpenPosButton'

const statusColors: Record<string, string> = {
  PAID:           'bg-green-500/10  border-green-500/20  text-green-400',
  PARTIAL:        'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
  UNPAID:         'bg-red-500/10    border-red-500/20    text-red-400',
  REFUNDED:       'bg-slate-500/10  border-slate-500/20  text-slate-400',
  RETURNED:       'bg-rose-500/10   border-rose-500/20   text-rose-400',
  DUE:            'bg-orange-500/10 border-orange-500/20 text-orange-400',
}


const methodIcon: Record<string, React.ReactNode> = {
  CASH:   <Banknote   size={11} />,
  CARD:   <CreditCard size={11} />,
  UPI:    <Smartphone size={11} />,
}

/* â”€â”€ Printable Invoice Template â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const INV_NAVY   = '#0d1b2e'
const INV_ORANGE = '#f59e0b'
const INV_DARK2  = '#162436'

function InvLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', background: INV_ORANGE, padding: '4px 12px 4px 10px', marginBottom: 10, clipPath: 'polygon(0 0,100% 0,calc(100% - 8px) 100%,0 100%)' }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 }}>{children}</span>
    </div>
  )
}

function InvoiceTemplate({ sale, shopName, settings }: { sale: any; shopName: string; settings: InvoiceSettings }) {
  const fc = (n: number) => formatCurrency(n)
  const dateStr = sale.createdAt ? new Date(sale.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''
  const payMethod = sale.payments?.map((p: any) => p.method).join(' + ') || 'â€”'
  const displayName = settings.shopName || shopName

  return (
    <div style={{ width: 794, background: '#fff', fontFamily: "'Segoe UI',Arial,sans-serif", color: '#1e293b' }}>

      {/* HEADER */}
      <div style={{ background: INV_NAVY, position: 'relative', overflow: 'hidden', padding: '30px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 110 }}>
        <div style={{ position: 'absolute', left: -18, top: 0, width: 90, height: '130%', background: INV_ORANGE, transform: 'skewX(-12deg)', opacity: 0.85 }} />
        <div style={{ position: 'absolute', left: 58, top: 0, width: 30, height: '130%', background: '#c97d06', transform: 'skewX(-12deg)', opacity: 0.7 }} />
        <div style={{ position: 'relative', zIndex: 2, paddingLeft: 60 }}>
          <p style={{ margin: 0, color: '#fff', fontSize: 24, fontWeight: 900, letterSpacing: 1 }}>{displayName.toUpperCase()}</p>
          <p style={{ margin: '2px 0 0', color: '#94a3b8', fontSize: 11, letterSpacing: 2 }}>{settings.slogan || 'SALES INVOICE'}</p>
        </div>
        <div style={{ textAlign: 'right', zIndex: 2 }}>
          <p style={{ margin: 0, color: INV_ORANGE, fontSize: 28, fontWeight: 900, letterSpacing: 2 }}>INVOICE</p>
          <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 11 }}>ID NO : {sale.invoiceNumber}</p>
          <p style={{ margin: '2px 0 0', color: '#94a3b8', fontSize: 10 }}>{dateStr}</p>
        </div>
      </div>

      {/* BILL TO / BILL FROM */}
      <div style={{ display: 'flex', background: '#f8fafc', borderBottom: '3px solid #e2e8f0', padding: '18px 36px', gap: 24 }}>
        <div style={{ flex: 1 }}>
          <InvLabel>Invoice To :</InvLabel>
          <p style={{ margin: '0 0 3px', fontSize: 14, fontWeight: 700, color: INV_NAVY }}>{sale.customerName || 'Walk-in Customer'}</p>
          {sale.customerPhone && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>Phone : {sale.customerPhone}</p>}
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>Date : {dateStr}</p>
        </div>
        <div style={{ flex: 1 }}>
          <InvLabel>Invoice From :</InvLabel>
          <p style={{ margin: '0 0 3px', fontSize: 14, fontWeight: 700, color: INV_NAVY }}>{displayName}</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>{sale.cashierName}</p>
          {settings.phone   && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>Phone : {settings.phone}</p>}
          {settings.email   && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>Email : {settings.email}</p>}
          {settings.address && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>{settings.address}</p>}
        </div>
      </div>

      {/* ITEMS TABLE */}
      <div style={{ padding: '20px 36px 0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ background: INV_ORANGE, padding: '9px 12px', color: '#fff', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'left', clipPath: 'polygon(0 0,100% 0,calc(100% - 6px) 100%,0 100%)' }}>Description</th>
              <th style={{ background: INV_DARK2, padding: '9px 12px', color: '#fff', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right' }}>Price</th>
              <th style={{ background: INV_DARK2, padding: '9px 12px', color: '#fff', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right' }}>Qty</th>
              <th style={{ background: INV_ORANGE, padding: '9px 12px', color: '#fff', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right', clipPath: 'polygon(6px 0,100% 0,100% 100%,0 100%)' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {sale.items?.map((item: any, idx: number) => (
              <tr key={item.id ?? idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '10px 12px', fontSize: 12, color: '#1e293b', fontWeight: 500 }}>
                  {item.productName}
                  {item.sku && <span style={{ display: 'block', fontSize: 9, color: '#94a3b8', fontFamily: 'monospace', marginTop: 1 }}>{item.sku}{item.imei ? ' Â· IMEI: ' + item.imei : ''}</span>}
                </td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: '#475569', textAlign: 'right' }}>{fc(item.unitPrice)}</td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: '#475569', textAlign: 'right' }}>{item.quantity}</td>
                <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 700, color: INV_NAVY, textAlign: 'right' }}>{fc(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* FOOTER: payment | contact | totals */}
      <div style={{ display: 'flex', gap: 16, padding: '20px 36px', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, background: INV_NAVY, borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ background: INV_ORANGE, padding: '5px 12px', clipPath: 'polygon(0 0,100% 0,calc(100% - 8px) 100%,0 100%)' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 }}>Payment Method :</span>
          </div>
          <div style={{ padding: '10px 12px' }}>
            {sale.payments?.map((p: any, i: number) => (
              <p key={i} style={{ margin: '0 0 4px', fontSize: 11, color: '#94a3b8' }}><span style={{ color: '#cbd5e1', fontWeight: 600 }}>{p.method}</span> : {fc(p.amount)}{p.reference ? ` (${p.reference})` : ''}</p>
            ))}
            <p style={{ margin: '6px 0 0', fontSize: 10, color: '#64748b' }}>Status : <span style={{ color: '#4ade80', fontWeight: 700 }}>{sale.status || 'PAID'}</span></p>
          </div>
        </div>
        <div style={{ flex: 1, background: INV_NAVY, borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ background: INV_ORANGE, padding: '5px 12px', clipPath: 'polygon(0 0,100% 0,calc(100% - 8px) 100%,0 100%)' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 }}>Contact Info :</span>
          </div>
          <div style={{ padding: '10px 12px' }}>
            {settings.phone   && <p style={{ margin: '0 0 3px', fontSize: 11, color: '#94a3b8' }}>Phone : <span style={{ color: '#cbd5e1' }}>{settings.phone}</span></p>}
            {settings.email   && <p style={{ margin: '0 0 3px', fontSize: 11, color: '#94a3b8' }}>Email : <span style={{ color: '#cbd5e1' }}>{settings.email}</span></p>}
            {settings.website && <p style={{ margin: '0 0 3px', fontSize: 11, color: '#94a3b8' }}>Web : <span style={{ color: '#cbd5e1' }}>{settings.website}</span></p>}
            {sale.customerPhone && <p style={{ margin: '0', fontSize: 11, color: '#94a3b8' }}>Customer : <span style={{ color: '#cbd5e1' }}>{sale.customerPhone}</span></p>}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          {[
            { label: 'Subtotal :', value: fc(sale.subtotal) },
            { label: 'Discount :', value: sale.discount ? fc(sale.discount) : fc(0) },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
              <span style={{ fontWeight: 600 }}>{label}</span><span>{value}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, background: INV_ORANGE, padding: '8px 12px', borderRadius: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: '#fff', letterSpacing: 1 }}>TOTAL</span>
            <span style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>{fc(sale.total)}</span>
          </div>
          {sale.dueAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, background: '#fef3c7', padding: '5px 10px', borderRadius: 4, fontSize: 11, color: '#92400e', fontWeight: 700 }}>
              <span>Due</span><span>{fc(sale.dueAmount)}</span>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '0 36px 20px' }}>
        <div>
          {sale.notes && <p style={{ margin: '0 0 4px', fontSize: 11, color: '#475569', fontStyle: 'italic' }}>{sale.notes}</p>}
          <p style={{ margin: '0 0 3px', fontSize: 12, color: '#475569', fontStyle: 'italic' }}>{settings.footerNote || 'Thanks for your business!'}</p>
          <p style={{ margin: 0, fontSize: 10, color: '#94a3b8' }}>Computer-generated invoice Â· {displayName}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '2px solid ' + INV_NAVY, paddingTop: 4, width: 140 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: INV_NAVY }}>{sale.cashierName}</p>
            <p style={{ margin: 0, fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>Authorised Signature</p>
          </div>
        </div>
      </div>
      <div style={{ height: 8, background: `linear-gradient(90deg, ${INV_NAVY} 60%, ${INV_ORANGE} 100%)` }} />
    </div>
  )
}

/* â”€â”€ Admin password gate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function AdminPasswordField({
  value, onChange, autoFocus,
}: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <div>
      <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
        <span className="inline-flex items-center gap-1"><Lock size={11} /> Owner / Admin password</span>
      </label>
      <input
        type="password"
        autoFocus={autoFocus}
        className="input-field w-full text-sm"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Enter owner password to confirm"
        autoComplete="current-password"
      />
    </div>
  )
}

/** Shown immediately when Edit is clicked — must enter password before the edit form. */
function EditPasswordGate({
  invoiceNumber, onClose, onVerified,
}: { invoiceNumber: string; onClose: () => void; onVerified: (password: string) => void }) {
  const [adminPassword, setAdminPassword] = useState('')

  const continueEdit = () => {
    if (!adminPassword.trim()) {
      toast.error('Admin password is required')
      return
    }
    onVerified(adminPassword)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <form
        className="rounded-xl w-full max-w-md border shadow-2xl p-5 space-y-4"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
        onClick={e => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); continueEdit() }}
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-violet-500/15 text-violet-500">
            <Lock size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Admin password required</h3>
            <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>
              Enter the owner / admin password to edit invoice{' '}
              <span className="font-mono font-semibold">{invoiceNumber}</span>.
            </p>
          </div>
        </div>
        <AdminPasswordField value={adminPassword} onChange={setAdminPassword} autoFocus />
        <div className="flex gap-2 justify-end pt-1">
          <button type="button" className="btn-secondary text-sm" onClick={onClose}>Cancel</button>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg font-semibold bg-violet-600 text-white hover:bg-violet-500"
          >
            <Pencil size={14} />
            Continue to edit
          </button>
        </div>
      </form>
    </div>
  )
}

function DeleteSaleModal({
  sale, onClose, onDeleted,
}: { sale: any; onClose: () => void; onDeleted: () => void }) {
  const [adminPassword, setAdminPassword] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!adminPassword.trim()) { toast.error('Admin password is required'); return }
    setSaving(true)
    try {
      await salesApi.void(sale.id, {
        adminPassword,
        reason: reason.trim() || 'Deleted by admin',
      })
      toast.success(`Invoice ${sale.invoiceNumber} voided â€” stock restored`)
      onDeleted()
      onClose()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete sale')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="rounded-xl w-full max-w-md border shadow-2xl p-5 space-y-4"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-rose-500/15 text-rose-500">
            <AlertTriangle size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Delete sales invoice?</h3>
            <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>
              Invoice <span className="font-mono font-semibold">{sale.invoiceNumber}</span> will be voided.
              Stock and IMEI will be restored, and accounting will reverse via a return journal.
              This cannot be undone.
            </p>
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Reason (optional)</label>
          <input
            className="input-field w-full text-sm"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Wrong entry / cashier mistakeâ€¦"
          />
        </div>
        <AdminPasswordField value={adminPassword} onChange={setAdminPassword} autoFocus />
        <div className="flex gap-2 justify-end pt-1">
          <button type="button" className="btn-secondary text-sm" onClick={onClose} disabled={saving}>Cancel</button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg font-semibold bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {saving ? 'Deletingâ€¦' : 'Delete invoice'}
          </button>
        </div>
      </div>
    </div>
  )
}

function EditSaleModal({
  sale, onClose, onSaved, initialAdminPassword = '',
}: { sale: any; onClose: () => void; onSaved: (updated: any) => void; initialAdminPassword?: string }) {
  const hasReturns = (sale._count?.returns ?? sale.returns?.length ?? 0) > 0
  const [customerName, setCustomerName] = useState(sale.customerName ?? '')
  const [customerPhone, setCustomerPhone] = useState(sale.customerPhone ?? '')
  const [notes, setNotes] = useState(sale.notes ?? '')
  const [discount, setDiscount] = useState(String(sale.discount ?? 0))
  const [items, setItems] = useState(
    (sale.items ?? []).map((i: any) => ({
      id: i.id,
      productName: i.productName,
      quantity: String(i.quantity),
      unitPrice: String(i.unitPrice),
      sku: i.sku,
      imei: i.imei ?? null,
    })),
  )
  const [payments, setPayments] = useState(
    (sale.payments ?? []).map((p: any) => ({
      id: p.id,
      method: p.method,
      amount: String(p.amount),
      reference: p.reference ?? '',
    })),
  )
  const [adminPassword, setAdminPassword] = useState(initialAdminPassword)
  const [saving, setSaving] = useState(false)

  const subtotal = items.reduce(
    (s: number, i: { unitPrice: string; quantity: string }) =>
      s + Number(i.unitPrice || 0) * Number(i.quantity || 0),
    0,
  )
  const disc = Number(discount) || 0
  const tax = Number(sale.tax ?? 0)
  const total = Math.max(0, Math.round((subtotal - disc + tax) * 100) / 100)

  const submit = async () => {
    if (!adminPassword.trim()) { toast.error('Admin password is required'); return }
    setSaving(true)
    try {
      const body: any = {
        adminPassword,
        customerName: customerName.trim() || null,
        customerPhone: customerPhone.trim() || null,
        notes: notes.trim() || null,
      }
      if (!hasReturns) {
        body.discount = disc
        body.items = items.map((i: { id: string; unitPrice: string; quantity: string }) => ({
          id: i.id,
          unitPrice: Number(i.unitPrice) || 0,
          quantity: Math.max(1, Math.floor(Number(i.quantity) || 1)),
        }))
        body.payments = payments.map((p: { id?: string; method: string; amount: string; reference: string }) => ({
          id: p.id,
          method: p.method,
          amount: Number(p.amount) || 0,
          reference: p.reference || null,
        }))
      }
      const res: any = await salesApi.update(sale.id, body)
      toast.success('Invoice updated')
      onSaved(res?.data ?? res)
      onClose()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update sale')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="rounded-xl w-full max-w-2xl border shadow-2xl max-h-[92vh] overflow-y-auto"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b sticky top-0 z-10" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <Pencil size={15} className="text-emerald-500" />
            <div>
              <p className="text-sm font-semibold">Edit invoice {sale.invoiceNumber}</p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Requires owner / admin password</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {initialAdminPassword ? (
            <div
              className="flex items-center gap-2 text-[12px] px-3 py-2 rounded-lg border"
              style={{ borderColor: 'var(--border-default)', background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}
            >
              <Lock size={12} className="text-violet-500" />
              Admin password entered — save will use it to confirm changes.
            </div>
          ) : (
            <AdminPasswordField value={adminPassword} onChange={setAdminPassword} autoFocus />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Customer name</label>
              <input className="input-field w-full text-sm" value={customerName} onChange={e => setCustomerName(e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Customer phone</label>
              <input className="input-field w-full text-sm" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Notes</label>
            <textarea className="input-field w-full text-sm min-h-[64px]" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          {hasReturns ? (
            <p className="text-[12px] rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)', background: 'var(--bg-subtle)' }}>
              This invoice has returns — only customer name, phone and notes can be edited.
            </p>
          ) : (
            <>
              <div>
                <p className="text-[11px] font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Line items</p>
                <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                  <table className="w-full text-[12px]">
                    <thead style={{ background: 'var(--bg-subtle)' }}>
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Item</th>
                        <th className="text-right px-3 py-2 font-medium">Qty</th>
                        <th className="text-right px-3 py-2 font-medium">Unit price</th>
                        <th className="text-right px-3 py-2 font-medium">Line total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item: {
                        id: string
                        productName: string
                        sku?: string
                        quantity: string
                        unitPrice: string
                        imei?: string | null
                      }, idx: number) => {
                        const lineTotal = (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0)
                        const imeiLocked = !!item.imei
                        return (
                        <tr key={item.id} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                          <td className="px-3 py-2">
                            <p className="font-medium">{item.productName}</p>
                            {item.sku && <p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{item.sku}</p>}
                            {imeiLocked && (
                              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>IMEI locked to qty 1</p>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min={1}
                              step={1}
                              disabled={imeiLocked}
                              className="input-field text-sm py-1 w-20 text-right ml-auto disabled:opacity-60"
                              value={item.quantity}
                              onChange={e => {
                                const next = [...items]
                                next[idx] = { ...item, quantity: e.target.value }
                                setItems(next)
                              }}
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              className="input-field text-sm py-1 w-28 text-right ml-auto"
                              value={item.unitPrice}
                              onChange={e => {
                                const next = [...items]
                                next[idx] = { ...item, unitPrice: e.target.value }
                                setItems(next)
                              }}
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-medium">{formatCurrency(lineTotal)}</td>
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Discount</label>
                  <input type="number" min={0} step="0.01" className="input-field w-full text-sm" value={discount} onChange={e => setDiscount(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Tax</label>
                  <input className="input-field w-full text-sm" value={tax} disabled />
                </div>
                <div>
                  <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>New total</label>
                  <input className="input-field w-full text-sm font-semibold" value={formatCurrency(total)} disabled />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Payments</p>
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-emerald-600"
                    onClick={() => setPayments([...payments, { method: 'CASH', amount: '0', reference: '' }])}
                  >
                    + Add payment
                  </button>
                </div>
                <div className="space-y-2">
                  {payments.map((p: { id?: string; method: string; amount: string; reference: string }, idx: number) => (
                    <div key={idx} className="grid grid-cols-3 gap-2">
                      <select
                        className="input-field text-sm"
                        value={p.method}
                        onChange={e => {
                          const next = [...payments]
                          next[idx] = { ...p, method: e.target.value }
                          setPayments(next)
                        }}
                      >
                        {['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'WALLET', 'CREDIT'].map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="input-field text-sm"
                        value={p.amount}
                        onChange={e => {
                          const next = [...payments]
                          next[idx] = { ...p, amount: e.target.value }
                          setPayments(next)
                        }}
                      />
                      <div className="flex gap-1">
                        <input
                          className="input-field text-sm flex-1"
                          placeholder="Ref"
                          value={p.reference}
                          onChange={e => {
                            const next = [...payments]
                            next[idx] = { ...p, reference: e.target.value }
                            setPayments(next)
                          }}
                        />
                        {payments.length > 1 && (
                          <button
                            type="button"
                            className="px-2 rounded-lg text-rose-500 hover:bg-rose-500/10"
                            onClick={() => setPayments(payments.filter((_: unknown, i: number) => i !== idx))}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <button type="button" className="btn-secondary text-sm" onClick={onClose} disabled={saving}>Cancel</button>
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg font-semibold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
              {saving ? 'Savingâ€¦' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* â”€â”€ Sale Details Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function SaleDetailsModal({
  sale, onClose, onChanged,
}: {
  sale: any
  onClose: () => void
  onChanged: () => void
}) {
  const invoiceRef  = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)
  const [showEditAuth, setShowEditAuth] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [editAdminPassword, setEditAdminPassword] = useState('')
  const [showDelete, setShowDelete] = useState(false)
  const [liveSale, setLiveSale] = useState(sale)
  const shopName = authStorage.getUser()?.name?.split(' ')[0] + ' Shop' || 'Our Shop'
  const [invSettings, setInvSettings] = useState<InvoiceSettings>(() => getInvoiceSettings())
  const [tenantSlug, setTenantSlug] = useState<string | undefined>()
  const activeTemplate = resolveInvoiceTemplate(invSettings, tenantSlug)
  const canManage = ['OWNER', 'MANAGER', 'PLATFORM_ADMIN'].includes(authStorage.getUser()?.role ?? '')
  const isReturned = liveSale.status === 'RETURNED'

  useEffect(() => { setLiveSale(sale) }, [sale])

  useEffect(() => {
    const user = authStorage.getUser()
    if (!user?.tenantId) return
    fetchInvoiceSettings(user.tenantId, getActiveBranchId()).then(setInvSettings).catch(() => {})
    import('@/lib/api').then(({ tenantApi }) => {
      tenantApi.get(user.tenantId).then((res: any) => {
        const tenant = res?.data ?? res
        setTenantSlug(tenant?.slug)
      }).catch(() => {})
    })
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const downloadInvoice = async () => {
    if (!invoiceRef.current) return
    setDownloading(true)
    try {
      const { default: html2canvas } = await import('html2canvas')
      const { jsPDF }               = await import('jspdf')
      const A4_W_PX = 794, A4_W_MM = 210, A4_H_MM = 297
      const wrapper = document.createElement('div')
      wrapper.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:${A4_W_PX}px;overflow:visible;`
      const el = invoiceRef.current!
      const clone = el.cloneNode(true) as HTMLElement
      clone.style.cssText = `width:${A4_W_PX}px;max-width:${A4_W_PX}px;border-radius:0;`
      wrapper.appendChild(clone)
      document.body.appendChild(wrapper)
      const canvas = await html2canvas(clone, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false, width: A4_W_PX, windowWidth: A4_W_PX })
      document.body.removeChild(wrapper)
      const imgData = canvas.toDataURL('image/jpeg', 0.95)
      const imgH_MM = (canvas.height / canvas.width) * A4_W_MM
      const pdf     = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      if (imgH_MM <= A4_H_MM) {
        pdf.addImage(imgData, 'JPEG', 0, 0, A4_W_MM, imgH_MM)
      } else {
        const scale = canvas.width / A4_W_MM
        let yMM = 0
        while (yMM < imgH_MM) {
          const sliceHMM = Math.min(A4_H_MM, imgH_MM - yMM)
          const tmp = document.createElement('canvas')
          tmp.width = canvas.width; tmp.height = Math.ceil(sliceHMM * scale)
          tmp.getContext('2d')!.drawImage(canvas, 0, yMM * scale, canvas.width, sliceHMM * scale, 0, 0, canvas.width, sliceHMM * scale)
          if (yMM > 0) pdf.addPage()
          pdf.addImage(tmp.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, A4_W_MM, sliceHMM)
          yMM += sliceHMM
        }
      }
      pdf.save(`Invoice_${liveSale.invoiceNumber}.pdf`)
      toast.success('Invoice downloaded')
    } catch { toast.error('Download failed') }
    finally { setDownloading(false) }
  }

  const printInvoice = () => {
    if (!invoiceRef.current) return
    const printContents = invoiceRef.current.innerHTML
    const w = window.open('', '_blank', 'width=900,height=1200')
    if (!w) return
    w.document.write(`
      <html><head><title>Invoice ${liveSale.invoiceNumber}</title>
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@3/dist/tailwind.min.css" rel="stylesheet">
      <style>
        body { margin: 0; background: white; font-family: 'Segoe UI', sans-serif; }
        @page { size: A4; margin: 15mm; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style>
      </head><body>${printContents}</body></html>
    `)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print(); w.close() }, 400)
  }

  const paymentStatus = liveSale?.dueAmount > 0 ? 'Partial' : 'Paid'
  const paymentStatusClass = liveSale?.dueAmount > 0
    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25'
    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'

  const safeText = (v: any) => (v === null || v === undefined || v === '' ? 'â€”' : String(v))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="rounded-xl w-full max-w-6xl shadow-2xl max-h-[92vh] overflow-y-auto border"
        style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 sm:px-5 py-3 border-b sticky top-0 z-10"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-start gap-2">
            <Receipt size={16} className="text-emerald-500 mt-0.5" />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Sell Details ( Invoice No : <span className="font-mono">{safeText(liveSale.invoiceNumber)}</span> )
              </p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {safeText(liveSale.customerName || 'Walk-in Customer')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold ${paymentStatusClass}`}>
              {paymentStatus}
            </span>
            <span className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold ${statusColors[liveSale.status] ?? ''}`}
              style={!statusColors[liveSale.status] ? { background: 'var(--bg-subtle)', borderColor: 'var(--border-default)', color: 'var(--text-secondary)' } : undefined}
            >
              {safeText(liveSale.status)}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-subtle)'; e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Top meta row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="space-y-1 text-[12px]">
              <div className="flex items-center gap-1.5">
                <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Date:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(formatDate(liveSale.createdAt))}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Hash size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Invoice No:</span>
                <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{safeText(liveSale.invoiceNumber)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Receipt size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(liveSale.status)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CreditCard size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Payment status:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{paymentStatus}</span>
              </div>
            </div>

            <div className="space-y-1 text-[12px]">
              <div className="flex items-center gap-1.5">
                <User size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Customer name:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(liveSale.customerName || 'Walk-in Customer')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Package size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Phone:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(liveSale.customerPhone)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <User size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Service staff:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(liveSale.cashierName)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Truck size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Shipping:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(liveSale.shippingMethod || liveSale.source === 'DELIVERY' ? 'Delivery' : '')}</span>
              </div>
            </div>

            <div className="rounded-lg border p-3 text-[12px]" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
              <div className="flex items-center justify-between border-b pb-2 mb-2" style={{ borderColor: 'var(--border-subtle)' }}>
                <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Totals</span>
              </div>
              {[
                { label: 'Subtotal', value: liveSale.subtotal ?? 0 },
                { label: 'Discount', value: liveSale.discount ?? 0 },
                { label: 'Order Tax', value: liveSale.tax ?? 0 },
                { label: 'Shipping', value: liveSale.shippingFee ?? 0 },
                { label: 'Round Off', value: liveSale.roundOff ?? 0 },
              ].map(r => (
                  <div key={r.label} className="flex items-center justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>{r.label}:</span>
                    <span className="font-medium">{formatCurrency(Number(r.value ?? 0))}</span>
                  </div>
                ))}
                <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Total Payable:</span>
                    <span className="font-semibold">{formatCurrency(liveSale.total ?? 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Total paid:</span>
                    <span className="font-medium">{formatCurrency(liveSale.paidAmount ?? (liveSale.total ?? 0) - (liveSale.dueAmount ?? 0))}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Total remaining:</span>
                    <span className="font-medium">{formatCurrency(liveSale.dueAmount ?? 0)}</span>
                  </div>
                </div>
            </div>
          </div>

          {/* Items preview */}
          {Array.isArray(liveSale.items) && liveSale.items.length > 0 && (
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
              <table className="w-full text-[12px]">
                <thead style={{ background: 'var(--bg-subtle)' }}>
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Item</th>
                    <th className="text-right px-3 py-2 font-medium">Qty</th>
                    <th className="text-right px-3 py-2 font-medium">Price</th>
                    <th className="text-right px-3 py-2 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {liveSale.items.map((item: any) => (
                    <tr key={item.id} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                      <td className="px-3 py-2">
                        <p className="font-medium">{item.productName}</p>
                        {(item.sku || item.imei) && (
                          <p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                            {[item.sku, item.imei ? `IMEI ${item.imei}` : null].filter(Boolean).join(' Â· ')}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">{item.quantity}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Bottom actions */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-end pt-2">
            {canManage && !isReturned && (
              <>
                <button
                  type="button"
                  onClick={() => setShowEditAuth(true)}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-lg border font-semibold text-violet-700 dark:text-violet-300 border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20"
                >
                  <Pencil size={14} />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setShowDelete(true)}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-lg border font-semibold text-rose-700 dark:text-rose-300 border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </>
            )}
            <button
              type="button"
              onClick={printInvoice}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-lg border font-semibold transition-colors"
              style={{ borderColor: 'var(--border-default)', background: 'var(--bg-subtle)', color: 'var(--text-primary)' }}
            >
              <Eye size={14} />
              Print Invoice
            </button>
            <button
              type="button"
              onClick={downloadInvoice}
              disabled={downloading}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-lg border border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/25 font-semibold disabled:opacity-60"
            >
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {downloading ? 'Generatingâ€¦' : 'Download PDF'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-lg border font-semibold transition-colors"
              style={{ borderColor: 'var(--border-default)', background: 'var(--bg-subtle)', color: 'var(--text-primary)' }}
            >
              Close
            </button>
          </div>

          {/* Hidden invoice for PDF capture / print */}
          <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none' }}>
            <InvoiceA4View
              ref={invoiceRef}
              sale={liveSale}
              settings={invSettings}
              tenantSlug={tenantSlug}
              shopName={shopName}
              template={activeTemplate}
              hideControls
            />
          </div>
        </div>
      </div>

      {showEditAuth && (
        <EditPasswordGate
          invoiceNumber={liveSale.invoiceNumber}
          onClose={() => setShowEditAuth(false)}
          onVerified={(password) => {
            setEditAdminPassword(password)
            setShowEditAuth(false)
            setShowEdit(true)
          }}
        />
      )}
      {showEdit && (
        <EditSaleModal
          sale={liveSale}
          initialAdminPassword={editAdminPassword}
          onClose={() => {
            setShowEdit(false)
            setEditAdminPassword('')
          }}
          onSaved={(updated) => {
            setLiveSale((prev: any) => ({ ...prev, ...updated }))
            onChanged()
          }}
        />
      )}
      {showDelete && (
        <DeleteSaleModal
          sale={liveSale}
          onClose={() => setShowDelete(false)}
          onDeleted={() => {
            onChanged()
            onClose()
          }}
        />
      )}
    </div>
  )
}

/* ── Main Sales Page ─────────────────────────────────────────────────────── */
export default function SalesPage() {
  const searchParams = useSearchParams()
  const [sales, setSales]           = useState<any[]>([])
  const [meta, setMeta]             = useState<any>(null)
  const [loading, setLoading]       = useState(true)
  const [detailSale,  setDetailSale]  = useState<any>(null)
  const [density, setDensity]       = useState<TableDensity>('comfortable')
  const [textSearch, setTextSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'PAID' | 'PARTIAL' | 'UNPAID' | 'RETURNED' | 'REFUNDED'>('all')

  const openDetail = useCallback((sale: any) => setDetailSale(sale), [])
  const canManage = ['OWNER', 'MANAGER', 'PLATFORM_ADMIN'].includes(authStorage.getUser()?.role ?? '')
  const [editAuthSale, setEditAuthSale] = useState<any>(null)
  const [editSale, setEditSale] = useState<any>(null)
  const [editAdminPassword, setEditAdminPassword] = useState('')
  const [deleteSale, setDeleteSale] = useState<any>(null)

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) setTextSearch(q)
    const id = searchParams.get('id')
    if (!id || !sales.length) return
    const found = sales.find(s => s.id === id)
    if (found) setDetailSale(found)
  }, [searchParams, sales])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await salesApi.list({ limit: '500' })
      setSales(res?.data ?? [])
      setMeta(res?.meta ?? null)
    } catch { toast.error('Failed to load sales') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const onSale = () => { load() }
    window.addEventListener('pos:sale-complete', onSale)
    return () => window.removeEventListener('pos:sale-complete', onSale)
  }, [load])

  const totalRevenue  = sales.reduce((s, r) => s + (r.total ?? 0), 0)
  const paidCount     = sales.filter(r => r.status === 'PAID').length
  const partialCount  = sales.filter(r => r.status === 'PARTIAL').length
  const returnedCount = sales.filter(r => r.status === 'RETURNED' || (r._count?.returns ?? 0) > 0).length

  const filteredSales = useMemo(() => {
    let rows = sales
    if (statusFilter !== 'all') rows = rows.filter(r => r.status === statusFilter)
    const q = textSearch.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      r.invoiceNumber?.toLowerCase().includes(q) ||
      (r.customerName ?? '').toLowerCase().includes(q) ||
      (r.customerPhone ?? '').toLowerCase().includes(q)
    )
  }, [sales, statusFilter, textSearch])

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'invoiceNumber',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Invoice" />,
      cell: ({ row }) => {
        const s = row.original
        const returnCount = s._count?.returns ?? 0
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              className="font-mono text-xs text-violet-400 hover:text-violet-300 hover:underline"
              onClick={() => openDetail(s)}
            >
              {s.invoiceNumber}
            </button>
            {s.source === 'DELIVERY' && (
              <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded font-semibold"
                style={{ background: 'var(--brand-glow)', color: 'var(--brand-light)', border: '1px solid var(--sidebar-active-border)' }}>
                <Truck size={9} /> Delivery
              </span>
            )}
            {s.source === 'CREDIT_COLLECTION' && (
              <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded font-semibold"
                style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}>
                <CreditCard size={9} /> Credit Pay
              </span>
            )}
            {returnCount > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                style={{ background: 'rgba(244,63,94,0.12)', color: '#fb7185', border: '1px solid rgba(244,63,94,0.25)' }}>
                <RotateCcw size={8} /> {returnCount} return{returnCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
      cell: ({ row }) => <span className="text-xs text-gray-700 dark:text-slate-300 whitespace-nowrap">{formatDate(row.original.createdAt)}</span>,
    },
    {
      accessorKey: 'customerName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
      cell: ({ row }) => (
        <div>
          <p className="text-xs font-semibold text-gray-800 dark:text-slate-200">{row.original.customerName || 'Walk-in'}</p>
          {row.original.customerPhone && <p className="text-[10px] text-gray-500 dark:text-slate-500">{row.original.customerPhone}</p>}
        </div>
      ),
    },
    {
      accessorKey: 'total',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
      cell: ({ row }) => {
        const s = row.original
        const totalRefunded = (s.returns ?? []).reduce((sum: number, r: any) => sum + (r.refundAmount ?? 0), 0)
        return (
          <div>
            <p className="text-xs font-bold text-gray-900 dark:text-white whitespace-nowrap">{formatCurrency(s.total)}</p>
            {totalRefunded > 0 && <p className="text-[10px] text-rose-400 whitespace-nowrap">Refunded: {formatCurrency(totalRefunded)}</p>}
            {s.dueAmount > 0 && <p className="text-[10px] text-yellow-400 whitespace-nowrap">Due: {formatCurrency(s.dueAmount)}</p>}
          </div>
        )
      },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => (
        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${statusColors[row.original.status] ?? ''}`}>
          {row.original.status}
        </span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const s = row.original
        const canEditDelete = canManage && s.status !== 'RETURNED'
        return (
          <TableActionsRow
            showAction={{ action: () => openDetail(s) }}
            {...(canEditDelete
              ? {
                  editAction: { action: () => setEditAuthSale(s) },
                  deleteAction: { action: () => setDeleteSale(s) },
                }
              : {})}
          />
        )
      },
    },
  ], [openDetail, canManage])

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="page-title">Sales</h1>
          <p className="page-subtitle">View and manage all sales transactions</p>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <OpenPosButton label="New Sale" />
          <TableDensityToggle value={density} onChange={setDensity} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Sales', value: String(meta?.total ?? 'â€”'), icon: ShoppingBag, color: 'violet', filter: 'all' as const },
          { label: 'Revenue', value: formatCurrency(totalRevenue), icon: TrendingUp, color: 'green', filter: 'all' as const },
          { label: 'Paid', value: String(paidCount), icon: Receipt, color: 'green', filter: 'PAID' as const },
          { label: 'Returned', value: String(returnedCount), icon: RotateCcw, color: 'rose', filter: 'RETURNED' as const },
        ].map(({ label, value, icon: Icon, color, filter }) => (
          <button
            key={label}
            type="button"
            onClick={() => setStatusFilter(filter)}
            className={`card p-4 flex items-center gap-3 text-left w-full transition-all hover:border-violet-500/30 ${statusFilter === filter ? 'ring-2 ring-violet-500/40' : ''}`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-${color}-500/10 border border-${color}-500/20`}>
              <Icon size={15} className={`text-${color}-400`} />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
              <p className="text-[11px] text-gray-500 dark:text-slate-500">{label}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ToolbarSearch
          value={textSearch}
          onChange={setTextSearch}
          placeholder="Search invoice, customer, phoneâ€¦"
          className="w-full sm:w-auto sm:min-w-[220px]"
        />
        <div className="flex gap-1 p-1 rounded-xl flex-wrap" style={{ background: 'var(--bg-subtle)' }}>
          {([
            { id: 'all', label: 'All' },
            { id: 'PAID', label: 'Paid' },
            { id: 'PARTIAL', label: 'Partial' },
            { id: 'UNPAID', label: 'Unpaid' },
            { id: 'RETURNED', label: 'Returned' },
          ] as const).map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setStatusFilter(opt.id)}
              className="px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-colors"
              style={statusFilter === opt.id
                ? { background: 'var(--brand-primary-light)', color: '#fff' }
                : { color: 'var(--text-muted)' }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className={`table-${density}`}>
        <ClientSideTable
          data={filteredSales}
          columns={columns}
          isLoading={loading}
          pageCount={Math.ceil((filteredSales.length || 1) / 20)}
          searchableColumns={[]}
          showFilter={false}
        />
      </div>

      {detailSale && (
        <SaleDetailsModal
          sale={detailSale}
          onClose={() => setDetailSale(null)}
          onChanged={() => { void load() }}
        />
      )}
      {editAuthSale && (
        <EditPasswordGate
          invoiceNumber={editAuthSale.invoiceNumber}
          onClose={() => setEditAuthSale(null)}
          onVerified={(password) => {
            setEditAdminPassword(password)
            setEditSale(editAuthSale)
            setEditAuthSale(null)
          }}
        />
      )}
      {editSale && (
        <EditSaleModal
          sale={editSale}
          initialAdminPassword={editAdminPassword}
          onClose={() => {
            setEditSale(null)
            setEditAdminPassword('')
          }}
          onSaved={() => { void load() }}
        />
      )}
      {deleteSale && (
        <DeleteSaleModal
          sale={deleteSale}
          onClose={() => setDeleteSale(null)}
          onDeleted={() => { void load() }}
        />
      )}
    </div>
  )
}
