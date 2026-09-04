'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  Check, FileText, Loader2, Package, Truck, Wallet, X, Building2, RotateCcw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency } from '@/lib/utils'
import { useModuleAccess, viewOnlyToast } from '@/lib/module-access'
import { wholesaleApi, type WholesaleDealer } from '@/lib/wholesale-api'
import { WholesaleDetailShell } from './wholesale-ui'

type AnyRow = Record<string, unknown>

function asData(res: unknown): AnyRow {
  const r = res as { data?: unknown }
  if (r?.data && typeof r.data === 'object' && !Array.isArray(r.data)) return r.data as AnyRow
  if (res && typeof res === 'object') return res as AnyRow
  return {}
}

function statusChip(status: string) {
  const s = String(status || '—')
  const tone =
    s.includes('CONFIRM') || s === 'ACTIVE' || s === 'PAID' || s === 'DELIVERED' || s === 'ISSUED' || s === 'COMPLETED' || s === 'CREDITED'
      ? 'bg-emerald-500/10 text-emerald-700'
      : s.includes('HOLD') || s === 'PARTIAL' || s === 'DRAFT' || s === 'PENDING' || s === 'RECEIVED' || s === 'QC' || s === 'SUBMITTED'
        ? 'bg-amber-500/10 text-amber-700'
        : s.includes('CANCEL') || s === 'REJECTED' || s === 'SUSPENDED'
          ? 'bg-rose-500/10 text-rose-700'
          : 'bg-sky-500/10 text-sky-700'
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${tone}`}>{s}</span>
  )
}

function dealerLabel(row: AnyRow) {
  const d = row.dealer as { tradingName?: string; legalName?: string; dealerCode?: string } | undefined
  if (!d) return '—'
  return d.tradingName || d.legalName || d.dealerCode || '—'
}

function MetaItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="text-[12px]">
      <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
        {children}
      </div>
    </div>
  )
}

function LinesTable({
  lines,
  columns = 'qty-price',
}: {
  lines: AnyRow[]
  columns?: 'qty-price' | 'pick' | 'dispatch' | 'return'
}) {
  if (!lines.length) {
    return (
      <p className="text-xs py-4 text-center" style={{ color: 'var(--text-muted)' }}>
        No lines
      </p>
    )
  }
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
      <table className="w-full text-xs">
        <thead style={{ background: 'var(--bg-subtle)' }}>
          <tr style={{ color: 'var(--text-muted)' }}>
            <th className="text-left font-medium px-3 py-2">Product</th>
            {columns === 'pick' && (
              <>
                <th className="text-right font-medium px-3 py-2">Req</th>
                <th className="text-right font-medium px-3 py-2">Picked</th>
              </>
            )}
            {columns === 'qty-price' && (
              <>
                <th className="text-right font-medium px-3 py-2">Qty</th>
                <th className="text-right font-medium px-3 py-2">Price</th>
                <th className="text-right font-medium px-3 py-2">Total</th>
              </>
            )}
            {columns === 'dispatch' && (
              <>
                <th className="text-right font-medium px-3 py-2">Qty</th>
                <th className="text-right font-medium px-3 py-2">IMEIs</th>
              </>
            )}
            {columns === 'return' && (
              <>
                <th className="text-right font-medium px-3 py-2">Qty</th>
                <th className="text-right font-medium px-3 py-2">Disp.</th>
                <th className="text-right font-medium px-3 py-2">Total</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            const serials = (l.serials as unknown[] | undefined) ?? []
            return (
              <tr key={String(l.id ?? i)} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <td className="px-3 py-2">
                  <p className="font-medium truncate max-w-[280px]">{String(l.productName ?? l.sku ?? '—')}</p>
                  {l.sku ? (
                    <p className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {String(l.sku)}
                    </p>
                  ) : null}
                </td>
                {columns === 'pick' && (
                  <>
                    <td className="px-3 py-2 text-right font-mono">{Number(l.quantity ?? 0)}</td>
                    <td className="px-3 py-2 text-right font-mono">{Number(l.pickedQty ?? 0)}</td>
                  </>
                )}
                {columns === 'qty-price' && (
                  <>
                    <td className="px-3 py-2 text-right font-mono">{Number(l.quantity ?? 0)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(Number(l.unitPrice ?? 0))}</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {formatCurrency(Number(l.total ?? Number(l.quantity ?? 0) * Number(l.unitPrice ?? 0)))}
                    </td>
                  </>
                )}
                {columns === 'dispatch' && (
                  <>
                    <td className="px-3 py-2 text-right font-mono">{Number(l.quantity ?? 0)}</td>
                    <td className="px-3 py-2 text-right font-mono">{serials.length}</td>
                  </>
                )}
                {columns === 'return' && (
                  <>
                    <td className="px-3 py-2 text-right font-mono">{Number(l.quantity ?? 0)}</td>
                    <td className="px-3 py-2 text-right">{String(l.disposition ?? '—')}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(Number(l.total ?? 0))}</td>
                  </>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ActionBtn({
  children,
  onClick,
  busy,
  tone = 'sky',
}: {
  children: ReactNode
  onClick: () => void
  busy?: boolean
  tone?: 'sky' | 'emerald' | 'rose' | 'border'
}) {
  const cls =
    tone === 'emerald'
      ? 'bg-emerald-600 text-white'
      : tone === 'rose'
        ? 'bg-rose-600/90 text-white'
        : tone === 'border'
          ? 'border'
          : 'bg-sky-600 text-white'
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg font-semibold disabled:opacity-50 ${cls}`}
      style={tone === 'border' ? { borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' } : undefined}
    >
      {children}
    </button>
  )
}

/* ── Quotation ──────────────────────────────────────────────────────── */

export function QuotationDetailModal({
  id,
  onClose,
  onChanged,
}: {
  id: string
  onClose: () => void
  onChanged: () => void
}) {
  const { canEdit } = useModuleAccess()
  const [row, setRow] = useState<AnyRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(() => {
    setLoading(true)
    wholesaleApi
      .quotation(id)
      .then((res) => setRow(asData(res)))
      .catch((e: Error) => {
        toast.error(e.message)
        setRow(null)
      })
      .finally(() => setLoading(false))
  }, [id])

  useEffect(reload, [reload])

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    if (!canEdit) return viewOnlyToast('quotations')
    setBusy(true)
    try {
      await fn()
      toast.success(ok)
      onChanged()
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  const st = String(row?.status ?? '')
  const lines = (row?.lines as AnyRow[] | undefined) ?? []

  return (
    <WholesaleDetailShell
      title="Quotation details"
      subtitle={row ? `${String(row.quoteNumber)} · ${dealerLabel(row)}` : 'Loading…'}
      icon={FileText}
      badge={row ? statusChip(st) : null}
      onClose={onClose}
      actions={
        row ? (
          <>
            {st === 'DRAFT' && (
              <ActionBtn busy={busy} onClick={() => act(() => wholesaleApi.issueQuotation(id), 'Issued')}>
                Issue
              </ActionBtn>
            )}
            {st === 'ISSUED' && (
              <>
                <ActionBtn
                  tone="emerald"
                  busy={busy}
                  onClick={() => act(() => wholesaleApi.acceptQuotation(id), 'Accepted → order')}
                >
                  <Check size={12} /> Accept
                </ActionBtn>
                <ActionBtn
                  tone="border"
                  busy={busy}
                  onClick={() => act(() => wholesaleApi.rejectQuotation(id, { reason: 'Rejected' }), 'Rejected')}
                >
                  Reject
                </ActionBtn>
              </>
            )}
            {(st === 'DRAFT' || st === 'ISSUED') && (
              <ActionBtn
                tone="border"
                busy={busy}
                onClick={() => act(() => wholesaleApi.reviseQuotation(id), 'Revised')}
              >
                Revise
              </ActionBtn>
            )}
          </>
        ) : null
      }
    >
      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-sky-500" />
        </div>
      )}
      {!loading && !row && (
        <p className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          Failed to load quotation
        </p>
      )}
      {!loading && row && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetaItem label="Quote #">
              <span className="font-mono">{String(row.quoteNumber)}</span>
            </MetaItem>
            <MetaItem label="Dealer">{dealerLabel(row)}</MetaItem>
            <MetaItem label="Total">{formatCurrency(Number(row.total ?? 0))}</MetaItem>
            <MetaItem label="Notes">{String(row.notes || '—')}</MetaItem>
          </div>
          <div>
            <p className="text-xs font-semibold mb-2">Lines</p>
            <LinesTable lines={lines} />
          </div>
        </div>
      )}
    </WholesaleDetailShell>
  )
}

/* ── Order ──────────────────────────────────────────────────────────── */

export function OrderDetailModal({
  id,
  onClose,
  onChanged,
}: {
  id: string
  onClose: () => void
  onChanged: () => void
}) {
  const { canEdit } = useModuleAccess()
  const [row, setRow] = useState<AnyRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(() => {
    setLoading(true)
    wholesaleApi
      .order(id)
      .then((res) => setRow(asData(res)))
      .catch((e: Error) => {
        toast.error(e.message)
        setRow(null)
      })
      .finally(() => setLoading(false))
  }, [id])

  useEffect(reload, [reload])

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    if (!canEdit) return viewOnlyToast('orders')
    setBusy(true)
    try {
      await fn()
      toast.success(ok)
      onChanged()
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  const st = String(row?.status ?? '')
  const lines = (row?.lines as AnyRow[] | undefined) ?? []

  return (
    <WholesaleDetailShell
      title="Sales order"
      subtitle={row ? `${String(row.orderNumber)} · ${dealerLabel(row)}` : 'Loading…'}
      icon={ClipboardIcon}
      badge={row ? statusChip(st) : null}
      onClose={onClose}
      actions={
        row ? (
          <>
            {st === 'DRAFT' && (
              <ActionBtn busy={busy} onClick={() => act(() => wholesaleApi.submitOrder(id), 'Submitted')}>
                Submit
              </ActionBtn>
            )}
            {(st === 'SUBMITTED' || st === 'ON_HOLD') && (
              <ActionBtn
                tone="emerald"
                busy={busy}
                onClick={() => act(() => wholesaleApi.confirmOrder(id), 'Confirmed & reserved')}
              >
                <Check size={12} /> Confirm
              </ActionBtn>
            )}
            {st === 'SUBMITTED' && (
              <ActionBtn
                tone="border"
                busy={busy}
                onClick={() => act(() => wholesaleApi.holdOrder(id, { type: 'MANUAL' }), 'On hold')}
              >
                Hold
              </ActionBtn>
            )}
            {st === 'ON_HOLD' && (
              <ActionBtn tone="border" busy={busy} onClick={() => act(() => wholesaleApi.releaseHold(id), 'Hold released')}>
                Release
              </ActionBtn>
            )}
            {(st === 'DRAFT' || st === 'SUBMITTED' || st === 'ON_HOLD') && (
              <ActionBtn tone="rose" busy={busy} onClick={() => act(() => wholesaleApi.cancelOrder(id), 'Cancelled')}>
                Cancel
              </ActionBtn>
            )}
            {st === 'CONFIRMED' && (
              <Link
                href="/dashboard/wholesale/warehouse"
                className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg border font-semibold"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
              >
                <Package size={12} /> Warehouse
              </Link>
            )}
          </>
        ) : null
      }
    >
      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-sky-500" />
        </div>
      )}
      {!loading && row && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetaItem label="Order #">
              <span className="font-mono">{String(row.orderNumber)}</span>
            </MetaItem>
            <MetaItem label="Dealer">{dealerLabel(row)}</MetaItem>
            <MetaItem label="Total">{formatCurrency(Number(row.total ?? 0))}</MetaItem>
            <MetaItem label="Notes">{String(row.notes || '—')}</MetaItem>
          </div>
          <div>
            <p className="text-xs font-semibold mb-2">Lines</p>
            <LinesTable lines={lines} />
          </div>
        </div>
      )}
    </WholesaleDetailShell>
  )
}

function ClipboardIcon({ size, className }: { size?: number; className?: string }) {
  return <FileText size={size} className={className} />
}

/* ── Dealer ─────────────────────────────────────────────────────────── */

export function DealerDetailModal({
  id,
  onClose,
  onChanged,
}: {
  id: string
  onClose: () => void
  onChanged: () => void
}) {
  const { canEdit } = useModuleAccess()
  const [row, setRow] = useState<WholesaleDealer | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(() => {
    setLoading(true)
    wholesaleApi
      .dealer(id)
      .then((res) => setRow(res.data ?? (res as unknown as WholesaleDealer)))
      .catch((e: Error) => {
        toast.error(e.message)
        setRow(null)
      })
      .finally(() => setLoading(false))
  }, [id])

  useEffect(reload, [reload])

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    if (!canEdit) return viewOnlyToast('dealers')
    setBusy(true)
    try {
      await fn()
      toast.success(ok)
      onChanged()
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  const st = String(row?.status ?? '')

  return (
    <WholesaleDetailShell
      title="Dealer details"
      subtitle={row ? `${row.dealerCode} · ${row.tradingName || row.legalName}` : 'Loading…'}
      icon={Building2}
      badge={row ? statusChip(st) : null}
      onClose={onClose}
      actions={
        row ? (
          <>
            {st !== 'ACTIVE' && (
              <ActionBtn
                tone="emerald"
                busy={busy}
                onClick={() => act(() => wholesaleApi.approveDealer(id), 'Dealer activated')}
              >
                Approve
              </ActionBtn>
            )}
            {st === 'ACTIVE' && (
              <ActionBtn tone="border" busy={busy} onClick={() => act(() => wholesaleApi.holdDealer(id), 'On hold')}>
                Hold
              </ActionBtn>
            )}
            {st !== 'SUSPENDED' && (
              <ActionBtn tone="rose" busy={busy} onClick={() => act(() => wholesaleApi.suspendDealer(id), 'Suspended')}>
                Suspend
              </ActionBtn>
            )}
            <Link
              href={`/dashboard/wholesale/collections?dealerId=${id}`}
              className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg border font-semibold"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
            >
              <Wallet size={12} /> Collections
            </Link>
          </>
        ) : null
      }
    >
      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-sky-500" />
        </div>
      )}
      {!loading && row && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <MetaItem label="Legal name">{row.legalName}</MetaItem>
          <MetaItem label="Trading name">{row.tradingName || '—'}</MetaItem>
          <MetaItem label="Phone">{row.phone}</MetaItem>
          <MetaItem label="Email">{row.email || '—'}</MetaItem>
          <MetaItem label="Credit limit">{formatCurrency(Number(row.creditLimit ?? 0))}</MetaItem>
          <MetaItem label="Outstanding">
            <span className={Number(row.totalDue) > 0 ? 'text-amber-600 font-semibold' : ''}>
              {formatCurrency(Number(row.totalDue ?? 0))}
            </span>
          </MetaItem>
          <MetaItem label="Payment terms">{row.paymentTermsDays} days</MetaItem>
          <MetaItem label="Cash only">{row.cashOnly ? 'Yes' : 'No'}</MetaItem>
          <MetaItem label="Tier">{row.tier?.name ?? '—'}</MetaItem>
          <MetaItem label="Notes">{row.notes || '—'}</MetaItem>
        </div>
      )}
    </WholesaleDetailShell>
  )
}

/* ── Pick list ──────────────────────────────────────────────────────── */

export function PickListDetailModal({
  id,
  onClose,
  onChanged,
}: {
  id: string
  onClose: () => void
  onChanged: () => void
}) {
  const { canEdit } = useModuleAccess()
  const [row, setRow] = useState<AnyRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(() => {
    setLoading(true)
    wholesaleApi
      .pickList(id)
      .then((res) => setRow(asData(res)))
      .catch((e: Error) => {
        toast.error(e.message)
        setRow(null)
      })
      .finally(() => setLoading(false))
  }, [id])

  useEffect(reload, [reload])

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    if (!canEdit) return viewOnlyToast('warehouse')
    setBusy(true)
    try {
      await fn()
      toast.success(ok)
      onChanged()
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  const st = String(row?.status ?? '')
  const lines = (row?.lines as AnyRow[] | undefined) ?? []

  return (
    <WholesaleDetailShell
      title="Pick list"
      subtitle={row ? String(row.pickNumber ?? id) : 'Loading…'}
      icon={Package}
      badge={row ? statusChip(st) : null}
      onClose={onClose}
      actions={
        row ? (
          <>
            {(st === 'DRAFT' || st === 'ASSIGNED' || st === 'IN_PROGRESS') && (
              <ActionBtn
                tone="border"
                busy={busy}
                onClick={() =>
                  act(
                    () =>
                      wholesaleApi.recordPick(id, {
                        lines: lines.map((l) => ({
                          pickLineId: String(l.id),
                          pickedQty: Number(l.quantity),
                        })),
                      }),
                    'All lines marked picked',
                  )
                }
              >
                Pick all
              </ActionBtn>
            )}
            {st !== 'COMPLETED' && st !== 'CANCELLED' && (
              <ActionBtn busy={busy} onClick={() => act(() => wholesaleApi.completePick(id), 'Pick completed')}>
                Complete
              </ActionBtn>
            )}
            {st === 'COMPLETED' && (
              <>
                <ActionBtn tone="emerald" busy={busy} onClick={() => act(() => wholesaleApi.packPick(id), 'Packed')}>
                  Pack
                </ActionBtn>
                <ActionBtn
                  busy={busy}
                  onClick={() => act(() => wholesaleApi.createDispatch({ pickListId: id }), 'Dispatch note created')}
                >
                  Create DN
                </ActionBtn>
              </>
            )}
          </>
        ) : null
      }
    >
      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-sky-500" />
        </div>
      )}
      {!loading && row && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <MetaItem label="Pick #">
              <span className="font-mono">{String(row.pickNumber)}</span>
            </MetaItem>
            <MetaItem label="Order">{String((row.salesOrder as { orderNumber?: string } | undefined)?.orderNumber ?? row.salesOrderId ?? '—')}</MetaItem>
            <MetaItem label="Notes">{String(row.notes || '—')}</MetaItem>
          </div>
          <div>
            <p className="text-xs font-semibold mb-2">Lines</p>
            <LinesTable lines={lines} columns="pick" />
          </div>
        </div>
      )}
    </WholesaleDetailShell>
  )
}

/* ── Dispatch ───────────────────────────────────────────────────────── */

export function DispatchDetailModal({
  id,
  onClose,
  onChanged,
  onBindImei,
}: {
  id: string
  onClose: () => void
  onChanged: () => void
  onBindImei?: (row: AnyRow) => void
}) {
  const { canEdit } = useModuleAccess()
  const [row, setRow] = useState<AnyRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(() => {
    setLoading(true)
    wholesaleApi
      .dispatch(id)
      .then((res) => setRow(asData(res)))
      .catch((e: Error) => {
        toast.error(e.message)
        setRow(null)
      })
      .finally(() => setLoading(false))
  }, [id])

  useEffect(reload, [reload])

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    if (!canEdit) return viewOnlyToast('warehouse')
    setBusy(true)
    try {
      await fn()
      toast.success(ok)
      onChanged()
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  const st = String(row?.status ?? '')
  const lines = (row?.lines as AnyRow[] | undefined) ?? []

  return (
    <WholesaleDetailShell
      title="Dispatch note"
      subtitle={row ? String(row.dispatchNumber ?? id) : 'Loading…'}
      icon={Truck}
      badge={row ? statusChip(st) : null}
      onClose={onClose}
      actions={
        row && st === 'DRAFT' ? (
          <>
            <ActionBtn
              tone="border"
              busy={busy}
              onClick={() => {
                if (onBindImei) onBindImei(row)
                else toast.error('Open Bind IMEI from the list')
              }}
            >
              Bind IMEI
            </ActionBtn>
            <ActionBtn
              tone="emerald"
              busy={busy}
              onClick={() => act(() => wholesaleApi.confirmDispatch(id), 'Dispatch confirmed')}
            >
              Confirm dispatch
            </ActionBtn>
          </>
        ) : null
      }
    >
      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-sky-500" />
        </div>
      )}
      {!loading && row && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <MetaItem label="DN #">
              <span className="font-mono">{String(row.dispatchNumber)}</span>
            </MetaItem>
            <MetaItem label="Pick">{String((row.pickList as { pickNumber?: string } | undefined)?.pickNumber ?? row.pickListId ?? '—')}</MetaItem>
            <MetaItem label="Notes">{String(row.notes || '—')}</MetaItem>
          </div>
          <div>
            <p className="text-xs font-semibold mb-2">Lines</p>
            <LinesTable lines={lines} columns="dispatch" />
          </div>
        </div>
      )}
    </WholesaleDetailShell>
  )
}

/* ── Return / RMA ───────────────────────────────────────────────────── */

export function ReturnDetailModal({
  id,
  onClose,
  onChanged,
}: {
  id: string
  onClose: () => void
  onChanged: () => void
}) {
  const { canEdit } = useModuleAccess()
  const [row, setRow] = useState<AnyRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(() => {
    setLoading(true)
    wholesaleApi
      .getReturn(id)
      .then((res) => setRow(asData(res)))
      .catch((e: Error) => {
        toast.error(e.message)
        setRow(null)
      })
      .finally(() => setLoading(false))
  }, [id])

  useEffect(reload, [reload])

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    if (!canEdit) return viewOnlyToast('returns')
    setBusy(true)
    try {
      await fn()
      toast.success(ok)
      onChanged()
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  const st = String(row?.status ?? '')
  const lines = (row?.lines as AnyRow[] | undefined) ?? []

  return (
    <WholesaleDetailShell
      title="Return / RMA"
      subtitle={row ? `${String(row.returnNumber)} · ${dealerLabel(row)}` : 'Loading…'}
      icon={RotateCcw}
      badge={row ? statusChip(st) : null}
      onClose={onClose}
      actions={
        row ? (
          <>
            {st === 'DRAFT' && (
              <ActionBtn busy={busy} onClick={() => act(() => wholesaleApi.approveReturn(id), 'Approved (received)')}>
                Approve
              </ActionBtn>
            )}
            {st === 'RECEIVED' && (
              <ActionBtn tone="border" busy={busy} onClick={() => act(() => wholesaleApi.qcReturn(id), 'QC recorded')}>
                QC
              </ActionBtn>
            )}
            {(st === 'RECEIVED' || st === 'QC') && lines.length > 0 && (
              <ActionBtn
                tone="border"
                busy={busy}
                onClick={() =>
                  act(
                    () =>
                      wholesaleApi.dispositionReturn(id, {
                        lines: lines.map((l) => ({
                          returnLineId: String(l.id),
                          disposition: 'RESTOCK',
                        })),
                      }),
                    'Disposition: RESTOCK',
                  )
                }
              >
                Restock all
              </ActionBtn>
            )}
            {st === 'QC' && (
              <ActionBtn
                tone="emerald"
                busy={busy}
                onClick={() => act(() => wholesaleApi.creditNoteReturn(id), 'Credit note issued')}
              >
                Credit note
              </ActionBtn>
            )}
            {st === 'CREDITED' && (
              <ActionBtn tone="border" busy={busy} onClick={() => act(() => wholesaleApi.closeReturn(id), 'Closed')}>
                Close
              </ActionBtn>
            )}
          </>
        ) : null
      }
    >
      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-sky-500" />
        </div>
      )}
      {!loading && row && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetaItem label="RMA #">
              <span className="font-mono">{String(row.returnNumber)}</span>
            </MetaItem>
            <MetaItem label="Dealer">{dealerLabel(row)}</MetaItem>
            <MetaItem label="Reason">{String(row.reason || '—')}</MetaItem>
            <MetaItem label="Notes">{String(row.notes || '—')}</MetaItem>
          </div>
          <div>
            <p className="text-xs font-semibold mb-2">Lines</p>
            <LinesTable lines={lines} columns="return" />
          </div>
        </div>
      )}
    </WholesaleDetailShell>
  )
}

/* ── Trip (delivery) ────────────────────────────────────────────────── */

export function TripDetailModal({
  id,
  onClose,
  onChanged,
  onPod,
}: {
  id: string
  onClose: () => void
  onChanged: () => void
  onPod: (tripId: string, stopId: string) => void
}) {
  const { canEdit } = useModuleAccess()
  const [row, setRow] = useState<AnyRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(() => {
    setLoading(true)
    wholesaleApi
      .trip(id)
      .then((res) => setRow(asData(res)))
      .catch((e: Error) => {
        toast.error(e.message)
        setRow(null)
      })
      .finally(() => setLoading(false))
  }, [id])

  useEffect(reload, [reload])

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    if (!canEdit) return viewOnlyToast('delivery')
    setBusy(true)
    try {
      await fn()
      toast.success(ok)
      onChanged()
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  const st = String(row?.status ?? '')
  const stops = (row?.stops as AnyRow[] | undefined) ?? []

  return (
    <WholesaleDetailShell
      title="Delivery trip"
      subtitle={row ? String(row.tripNumber ?? id) : 'Loading…'}
      icon={Truck}
      badge={row ? statusChip(st) : null}
      onClose={onClose}
      actions={
        row ? (
          <>
            {st === 'PLANNED' || st === 'DRAFT' ? (
              <ActionBtn busy={busy} onClick={() => act(() => wholesaleApi.startTrip(id), 'Trip started')}>
                Start trip
              </ActionBtn>
            ) : null}
            {(st === 'IN_PROGRESS' || st === 'STARTED') && (
              <ActionBtn
                tone="emerald"
                busy={busy}
                onClick={() => act(() => wholesaleApi.completeTrip(id), 'Trip completed')}
              >
                Complete trip
              </ActionBtn>
            )}
          </>
        ) : null
      }
    >
      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-sky-500" />
        </div>
      )}
      {!loading && row && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <MetaItem label="Trip #">
              <span className="font-mono">{String(row.tripNumber)}</span>
            </MetaItem>
            <MetaItem label="Vehicle">
              {String(
                (row.vehicle as { plateNumber?: string; name?: string } | undefined)?.plateNumber ||
                  (row.vehicle as { name?: string } | undefined)?.name ||
                  '—',
              )}
            </MetaItem>
            <MetaItem label="Stops">{stops.length}</MetaItem>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold">Stops</p>
            {stops.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                No stops
              </p>
            ) : (
              stops.map((stop, idx) => {
                const stopId = String(stop.id)
                const stopSt = String(stop.status ?? '')
                return (
                  <div
                    key={stopId}
                    className="rounded-xl border px-3 py-2.5 flex flex-wrap items-center justify-between gap-2"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <div>
                      <p className="text-sm font-medium">
                        #{idx + 1} {dealerLabel(stop)}
                      </p>
                      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {statusChip(stopSt)}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {(stopSt === 'PENDING' || stopSt === 'PLANNED') && (
                        <ActionBtn
                          busy={busy}
                          onClick={() => act(() => wholesaleApi.arriveStop(id, stopId), 'Arrived')}
                        >
                          Arrive
                        </ActionBtn>
                      )}
                      {(stopSt === 'ARRIVED' || stopSt === 'PENDING') && (
                        <ActionBtn tone="emerald" busy={busy} onClick={() => onPod(id, stopId)}>
                          POD
                        </ActionBtn>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </WholesaleDetailShell>
  )
}

/* ── Settlement ─────────────────────────────────────────────────────── */

export function SettlementDetailModal({
  id,
  initial,
  onClose,
  onChanged,
}: {
  id: string
  initial?: AnyRow | null
  onClose: () => void
  onChanged: () => void
}) {
  const { canEdit } = useModuleAccess()
  const [row, setRow] = useState<AnyRow | null>(initial ?? null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (initial) setRow(initial)
  }, [initial])

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    if (!canEdit) return viewOnlyToast('van')
    setBusy(true)
    try {
      await fn()
      toast.success(ok)
      onChanged()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  const st = String(row?.status ?? '')
  const vehicle = row?.vehicle as { plateNumber?: string; name?: string } | undefined

  return (
    <WholesaleDetailShell
      title="Van settlement"
      subtitle={row ? String(vehicle?.plateNumber || vehicle?.name || id) : id}
      icon={Wallet}
      badge={row ? statusChip(st) : null}
      onClose={onClose}
      actions={
        row ? (
          <>
            {st === 'DRAFT' && (
              <ActionBtn busy={busy} onClick={() => act(() => wholesaleApi.submitSettlement(id), 'Submitted')}>
                Submit
              </ActionBtn>
            )}
            {st === 'SUBMITTED' && (
              <ActionBtn
                tone="emerald"
                busy={busy}
                onClick={() => act(() => wholesaleApi.approveSettlement(id), 'Approved')}
              >
                Approve
              </ActionBtn>
            )}
          </>
        ) : null
      }
    >
      {!row ? (
        <p className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          Settlement details unavailable
        </p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <MetaItem label="Vehicle">{String(vehicle?.plateNumber || vehicle?.name || '—')}</MetaItem>
          <MetaItem label="Declared cash">{formatCurrency(Number(row.declaredCash ?? 0))}</MetaItem>
          <MetaItem label="Expected cash">{formatCurrency(Number(row.expectedCash ?? 0))}</MetaItem>
          <MetaItem label="Notes">{String(row.notes || '—')}</MetaItem>
          <MetaItem label="Date">{String(row.settlementDate || row.createdAt || '—')}</MetaItem>
        </div>
      )}
    </WholesaleDetailShell>
  )
}
