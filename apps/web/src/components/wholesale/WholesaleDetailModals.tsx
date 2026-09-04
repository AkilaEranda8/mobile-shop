'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  Check, FileText, Loader2, Package, Truck, Wallet, X, Building2, RotateCcw,
  Phone, Mail, Hash, Calendar, CreditCard, Tag, ShoppingCart, MapPin,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency, formatDate } from '@/lib/utils'
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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

  const safeText = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v))
  const st = String(row?.status ?? '')
  const lines = (row?.lines as AnyRow[] | undefined) ?? []
  const dealer = row?.dealer as
    | { id?: string; tradingName?: string; legalName?: string; dealerCode?: string }
    | undefined
  const dealerName = dealerLabel(row ?? {})
  const lineCount = lines.length
  const subtotal = Number(row?.subtotal ?? row?.total ?? 0)
  const discount = Number(row?.discount ?? 0)
  const tax = Number(row?.tax ?? 0)
  const total = Number(row?.total ?? 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="rounded-xl w-full max-w-5xl shadow-2xl max-h-[92vh] overflow-y-auto border"
        style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 sm:px-5 py-3 border-b sticky top-0 z-10"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-start gap-2 min-w-0">
            <FileText size={16} className="text-sky-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                Quotation Details
                {row ? (
                  <>
                    {' '}
                    ( <span className="font-mono">{safeText(row.quoteNumber)}</span> )
                  </>
                ) : null}
              </p>
              <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                {loading ? 'Loading…' : `${dealerName} · ${safeText(dealer?.dealerCode)}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {row && statusChip(st)}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-subtle)'
                e.currentTarget.style.color = 'var(--text-primary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--text-muted)'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-sky-400" />
          </div>
        )}

        {!loading && !row && (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Failed to load quotation
          </div>
        )}

        {!loading && row && (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="space-y-1 text-[12px]">
                <div className="flex items-center gap-1.5">
                  <Hash size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Quote #:</span>
                  <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>
                    {safeText(row.quoteNumber)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Building2 size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Dealer:</span>
                  <span className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {dealerName}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Created:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {row.createdAt ? formatDate(String(row.createdAt)) : '—'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Issued:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {row.issuedAt ? formatDate(String(row.issuedAt)) : '—'}
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-[12px]">
                <div className="flex items-center gap-1.5">
                  <Tag size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {st.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <FileText size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Lines:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {lineCount}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Hash size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Dealer code:</span>
                  <span className="font-mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    {safeText(dealer?.dealerCode)}
                  </span>
                </div>
                <div className="flex items-start gap-1.5">
                  <FileText size={13} className="mt-0.5" style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Notes:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {safeText(row.notes)}
                  </span>
                </div>
              </div>

              <div
                className="rounded-lg border p-3 text-[12px]"
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}
              >
                <div
                  className="flex items-center justify-between border-b pb-2 mb-2"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    Quick totals
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    LKR
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
                    <span className="font-medium">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Discount</span>
                    <span className="font-medium">{formatCurrency(discount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Tax</span>
                    <span className="font-medium">{formatCurrency(tax)}</span>
                  </div>
                  <div
                    className="flex justify-between pt-2 border-t"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <span className="font-semibold">Total</span>
                    <span className="font-bold text-sky-600 dark:text-sky-400">
                      {formatCurrency(total)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Workflow actions */}
            <div className="flex flex-wrap gap-2">
              {canEdit && st === 'DRAFT' && (
                <ActionBtn busy={busy} onClick={() => act(() => wholesaleApi.issueQuotation(id), 'Issued')}>
                  Issue quote
                </ActionBtn>
              )}
              {canEdit && st === 'ISSUED' && (
                <>
                  <ActionBtn
                    tone="emerald"
                    busy={busy}
                    onClick={() => act(() => wholesaleApi.acceptQuotation(id), 'Accepted → order')}
                  >
                    <Check size={12} /> Accept → order
                  </ActionBtn>
                  <ActionBtn
                    tone="border"
                    busy={busy}
                    onClick={() =>
                      act(() => wholesaleApi.rejectQuotation(id, { reason: 'Rejected' }), 'Rejected')
                    }
                  >
                    Reject
                  </ActionBtn>
                </>
              )}
              {canEdit && (st === 'ISSUED' || st === 'REJECTED' || st === 'EXPIRED') && (
                <ActionBtn
                  tone="border"
                  busy={busy}
                  onClick={() => act(() => wholesaleApi.reviseQuotation(id), 'Revised')}
                >
                  <RotateCcw size={12} /> Revise
                </ActionBtn>
              )}
              {dealer?.id && (
                <Link
                  href={`/dashboard/wholesale/dealers?id=${dealer.id}`}
                  className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg font-semibold border"
                  style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                >
                  <Building2 size={12} /> View dealer
                </Link>
              )}
              {st === 'ACCEPTED' && (
                <Link
                  href="/dashboard/wholesale/orders"
                  className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg font-semibold bg-sky-600 text-white"
                >
                  <ShoppingCart size={12} /> Open orders
                </Link>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                Line items
              </p>
              <LinesTable lines={lines} />
            </div>
          </div>
        )}
      </div>
    </div>
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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

  const safeText = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v))
  const st = String(row?.status ?? '')
  const lines = (row?.lines as AnyRow[] | undefined) ?? []
  const dealer = row?.dealer as
    | { id?: string; tradingName?: string; legalName?: string; dealerCode?: string }
    | undefined
  const dealerName = dealerLabel(row ?? {})
  const lineCount = lines.length
  const subtotal = Number(row?.subtotal ?? row?.total ?? 0)
  const discount = Number(row?.discount ?? 0)
  const tax = Number(row?.tax ?? 0)
  const total = Number(row?.total ?? 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="rounded-xl w-full max-w-5xl shadow-2xl max-h-[92vh] overflow-y-auto border"
        style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 sm:px-5 py-3 border-b sticky top-0 z-10"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-start gap-2 min-w-0">
            <Package size={16} className="text-violet-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                Sales Order
                {row ? (
                  <>
                    {' '}
                    ( <span className="font-mono">{safeText(row.orderNumber)}</span> )
                  </>
                ) : null}
              </p>
              <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                {loading ? 'Loading…' : `${dealerName} · ${safeText(dealer?.dealerCode)}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {row && statusChip(st)}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-subtle)'
                e.currentTarget.style.color = 'var(--text-primary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--text-muted)'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-sky-400" />
          </div>
        )}

        {!loading && !row && (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Failed to load order
          </div>
        )}

        {!loading && row && (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="space-y-1 text-[12px]">
                <div className="flex items-center gap-1.5">
                  <Hash size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Order #:</span>
                  <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>
                    {safeText(row.orderNumber)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Building2 size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Dealer:</span>
                  <span className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {dealerName}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Created:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {row.createdAt ? formatDate(String(row.createdAt)) : '—'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Confirmed:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {row.confirmedAt ? formatDate(String(row.confirmedAt)) : '—'}
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-[12px]">
                <div className="flex items-center gap-1.5">
                  <Tag size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {st.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Package size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Lines:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {lineCount}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Hash size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Dealer code:</span>
                  <span className="font-mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    {safeText(dealer?.dealerCode)}
                  </span>
                </div>
                <div className="flex items-start gap-1.5">
                  <FileText size={13} className="mt-0.5" style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Notes:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {safeText(row.notes)}
                  </span>
                </div>
              </div>

              <div
                className="rounded-lg border p-3 text-[12px]"
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}
              >
                <div
                  className="flex items-center justify-between border-b pb-2 mb-2"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    Quick totals
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    LKR
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
                    <span className="font-medium">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Discount</span>
                    <span className="font-medium">{formatCurrency(discount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Tax</span>
                    <span className="font-medium">{formatCurrency(tax)}</span>
                  </div>
                  <div
                    className="flex justify-between pt-2 border-t"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <span className="font-semibold">Total</span>
                    <span className="font-bold text-violet-600 dark:text-violet-400">
                      {formatCurrency(total)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {canEdit && st === 'DRAFT' && (
                <ActionBtn busy={busy} onClick={() => act(() => wholesaleApi.submitOrder(id), 'Submitted')}>
                  Submit
                </ActionBtn>
              )}
              {canEdit && (st === 'SUBMITTED' || st === 'ON_HOLD') && (
                <ActionBtn
                  tone="emerald"
                  busy={busy}
                  onClick={() => act(() => wholesaleApi.confirmOrder(id), 'Confirmed & reserved')}
                >
                  <Check size={12} /> Confirm
                </ActionBtn>
              )}
              {canEdit && st === 'SUBMITTED' && (
                <ActionBtn
                  tone="border"
                  busy={busy}
                  onClick={() => act(() => wholesaleApi.holdOrder(id, { type: 'MANUAL' }), 'On hold')}
                >
                  Hold
                </ActionBtn>
              )}
              {canEdit && st === 'ON_HOLD' && (
                <ActionBtn
                  tone="border"
                  busy={busy}
                  onClick={() => act(() => wholesaleApi.releaseHold(id), 'Hold released')}
                >
                  Release
                </ActionBtn>
              )}
              {canEdit && (st === 'DRAFT' || st === 'SUBMITTED' || st === 'ON_HOLD') && (
                <ActionBtn
                  tone="rose"
                  busy={busy}
                  onClick={() => act(() => wholesaleApi.cancelOrder(id), 'Cancelled')}
                >
                  Cancel
                </ActionBtn>
              )}
              {(st === 'CONFIRMED' || st === 'PARTIAL') && (
                <Link
                  href="/dashboard/wholesale/warehouse"
                  className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg font-semibold border"
                  style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                >
                  <Package size={12} /> Warehouse
                </Link>
              )}
              {dealer?.id && (
                <Link
                  href={`/dashboard/wholesale/dealers?id=${dealer.id}`}
                  className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg font-semibold border"
                  style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                >
                  <Building2 size={12} /> View dealer
                </Link>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                Line items
              </p>
              <LinesTable lines={lines} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
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
  const [statement, setStatement] = useState<{
    invoices?: Array<{
      id: string
      invoiceNumber?: string
      createdAt?: string
      channel?: string
      total?: number
      paidAmount?: number
      dueAmount?: number
      status?: string
    }>
    payments?: Array<{
      id: string
      receiptNumber?: string
      createdAt?: string
      paidAt?: string
      amount?: number
      method?: string
      reference?: string | null
    }>
  } | null>(null)
  const [stmtLoading, setStmtLoading] = useState(false)

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    setStmtLoading(true)
    wholesaleApi
      .statement(id)
      .then((res) => {
        const data = (res as { data?: typeof statement }).data ?? (res as typeof statement)
        setStatement(data)
      })
      .catch(() => setStatement(null))
      .finally(() => setStmtLoading(false))
  }, [id])

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

  const safeText = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v))
  const st = String(row?.status ?? '')
  const name = row ? row.tradingName || row.legalName : ''
  const hasDue = Number(row?.totalDue ?? 0) > 0
  const creditHeadroom = row
    ? Math.max(0, Number(row.creditLimit) - Number(row.totalDue))
    : 0
  const invoices = [...(statement?.invoices ?? [])].reverse()
  const payments = [...(statement?.payments ?? [])].reverse()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="rounded-xl w-full max-w-6xl shadow-2xl max-h-[92vh] overflow-y-auto border"
        style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — Customers style */}
        <div
          className="flex items-center justify-between px-4 sm:px-5 py-3 border-b sticky top-0 z-10"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-start gap-2 min-w-0">
            <Building2 size={16} className="text-sky-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                Dealer Details
                {row ? (
                  <>
                    {' '}
                    ( <span className="font-mono">{safeText(name)}</span> )
                  </>
                ) : null}
              </p>
              <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                {loading ? 'Loading…' : `${safeText(row?.dealerCode)} · ${safeText(row?.phone)}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {row?.cashOnly && (
              <span className="text-[11px] px-2.5 py-1 rounded-full border font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25">
                Cash only
              </span>
            )}
            {row && (
              <span
                className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold ${
                  hasDue
                    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/25'
                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
                }`}
              >
                {hasDue ? 'Outstanding' : 'Clear'}
              </span>
            )}
            {row && statusChip(st)}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-subtle)'
                e.currentTarget.style.color = 'var(--text-primary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--text-muted)'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-sky-400" />
          </div>
        )}

        {!loading && !row && (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Failed to load dealer
          </div>
        )}

        {!loading && row && (
          <div className="p-4 sm:p-5 space-y-4">
            {/* Top meta + quick totals */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="space-y-1 text-[12px]">
                <div className="flex items-center gap-1.5">
                  <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Since:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {row.createdAt ? formatDate(row.createdAt) : '—'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Phone size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Phone:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {safeText(row.phone)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Mail size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Email:</span>
                  <span className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {safeText(row.email)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Hash size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Dealer code:</span>
                  <span className="font-mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    {safeText(row.dealerCode)}
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-[12px]">
                <div className="flex items-center gap-1.5">
                  <Building2 size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Legal name:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {safeText(row.legalName)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Tag size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Tier:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {safeText(row.tier?.name)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CreditCard size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Terms:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {row.paymentTermsDays} days
                    {row.cashOnly ? ' · Cash only' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Wallet size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Credit status:</span>
                  <span
                    className="font-medium"
                    style={{ color: hasDue ? '#ef4444' : 'var(--text-primary)' }}
                  >
                    {hasDue ? 'Has outstanding' : 'Clear'}
                  </span>
                </div>
              </div>

              <div
                className="rounded-lg border p-3 text-[12px]"
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}
              >
                <div
                  className="flex items-center justify-between border-b pb-2 mb-2"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    Quick totals
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    LKR
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Credit limit</span>
                    <span className="font-medium">{formatCurrency(Number(row.creditLimit ?? 0))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Available</span>
                    <span className="font-medium">{formatCurrency(creditHeadroom)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Invoices</span>
                    <span className="font-medium">{invoices.length}</span>
                  </div>
                  <div
                    className="flex justify-between pt-2 border-t"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <span className="font-semibold">Outstanding</span>
                    <span className={`font-semibold ${hasDue ? 'text-rose-600 dark:text-rose-400' : ''}`}>
                      {formatCurrency(Number(row.totalDue ?? 0))}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {row.notes && (
              <div
                className="rounded-lg border px-3 py-2 text-[12px]"
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}
              >
                <span style={{ color: 'var(--text-muted)' }}>Notes: </span>
                <span style={{ color: 'var(--text-primary)' }}>{row.notes}</span>
              </div>
            )}

            {/* Invoices + payments + summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-4">
                <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="bg-sky-600 text-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1.5">
                    <FileText size={12} /> Wholesale invoices
                  </div>
                  <div className="overflow-x-auto">
                    {stmtLoading ? (
                      <div className="flex justify-center py-10">
                        <Loader2 className="animate-spin text-sky-400" size={20} />
                      </div>
                    ) : invoices.length === 0 ? (
                      <p className="py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                        No invoices yet for this dealer
                      </p>
                    ) : (
                      <table className="min-w-[640px] w-full text-[12px]">
                        <thead
                          className="border-b"
                          style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}
                        >
                          <tr style={{ color: 'var(--text-secondary)' }}>
                            <th className="px-3 py-2 text-left">Invoice</th>
                            <th className="px-3 py-2 text-left">Date</th>
                            <th className="px-3 py-2 text-left">Channel</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-right">Total</th>
                            <th className="px-3 py-2 text-right">Due</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoices.slice(0, 25).map((inv) => (
                            <tr
                              key={inv.id}
                              className="border-b last:border-0"
                              style={{ borderColor: 'var(--border-subtle)' }}
                            >
                              <td className="px-3 py-2 font-mono font-semibold text-sky-600">
                                {safeText(inv.invoiceNumber)}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {inv.createdAt ? formatDate(inv.createdAt) : '—'}
                              </td>
                              <td className="px-3 py-2">{safeText(inv.channel)}</td>
                              <td className="px-3 py-2">{statusChip(String(inv.status ?? '—'))}</td>
                              <td className="px-3 py-2 text-right">
                                {formatCurrency(Number(inv.total ?? 0))}
                              </td>
                              <td
                                className={`px-3 py-2 text-right font-semibold ${
                                  Number(inv.dueAmount) > 0 ? 'text-rose-500' : ''
                                }`}
                              >
                                {formatCurrency(Number(inv.dueAmount ?? 0))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="bg-emerald-600 text-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1.5">
                    <Wallet size={12} /> Payments received
                  </div>
                  <div className="overflow-x-auto">
                    {stmtLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="animate-spin text-emerald-400" size={18} />
                      </div>
                    ) : payments.length === 0 ? (
                      <p className="py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                        No payments recorded
                      </p>
                    ) : (
                      <table className="min-w-[520px] w-full text-[12px]">
                        <thead
                          className="border-b"
                          style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}
                        >
                          <tr style={{ color: 'var(--text-secondary)' }}>
                            <th className="px-3 py-2 text-left">Receipt</th>
                            <th className="px-3 py-2 text-left">Date</th>
                            <th className="px-3 py-2 text-left">Method</th>
                            <th className="px-3 py-2 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payments.slice(0, 20).map((p) => (
                            <tr
                              key={p.id}
                              className="border-b last:border-0"
                              style={{ borderColor: 'var(--border-subtle)' }}
                            >
                              <td className="px-3 py-2 font-mono">{safeText(p.receiptNumber)}</td>
                              <td className="px-3 py-2">
                                {p.paidAt || p.createdAt ? formatDate(p.paidAt || p.createdAt!) : '—'}
                              </td>
                              <td className="px-3 py-2">{safeText(p.method)}</td>
                              <td className="px-3 py-2 text-right font-semibold text-emerald-600">
                                {formatCurrency(Number(p.amount ?? 0))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>

              {/* Right summary */}
              <div className="rounded-lg border overflow-hidden h-fit" style={{ borderColor: 'var(--border-subtle)' }}>
                <div
                  className="px-3 py-2 border-b flex items-center justify-between"
                  style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}
                >
                  <p className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Summary
                  </p>
                  <p
                    className={`text-[12px] font-semibold ${
                      hasDue ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {formatCurrency(Number(row.totalDue ?? 0))}
                  </p>
                </div>
                <div className="p-3 text-[12px] space-y-2">
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                    <span className="font-medium">{st.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Credit limit:</span>
                    <span className="font-medium">{formatCurrency(Number(row.creditLimit ?? 0))}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Available:</span>
                    <span className="font-medium">{formatCurrency(creditHeadroom)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Invoices:</span>
                    <span className="font-medium">{invoices.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Payments:</span>
                    <span className="font-medium">{payments.length}</span>
                  </div>
                  <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Outstanding:</span>
                      <span
                        className={`font-semibold ${hasDue ? 'text-rose-600 dark:text-rose-400' : ''}`}
                      >
                        {formatCurrency(Number(row.totalDue ?? 0))}
                      </span>
                    </div>
                    {hasDue && (
                      <Link
                        href={`/dashboard/wholesale/collections?dealerId=${id}`}
                        className="w-full mt-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] rounded-lg font-semibold bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Wallet size={12} /> Collect payment
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom actions */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-end pt-2 flex-wrap">
              <Link
                href={`/dashboard/wholesale/pos`}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-lg border border-sky-500/30 bg-sky-500/15 text-sky-700 dark:text-sky-300 font-semibold"
              >
                <ShoppingCart size={14} />
                Wholesale POS
              </Link>
              <Link
                href={`/dashboard/wholesale/collections?dealerId=${id}`}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-lg border font-semibold"
                style={{ borderColor: 'var(--border-default)', background: 'var(--bg-subtle)', color: 'var(--text-primary)' }}
              >
                <Wallet size={14} />
                Collections
              </Link>
              {canEdit && st !== 'ACTIVE' && st !== 'CLOSED' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act(() => wholesaleApi.approveDealer(id), 'Dealer activated')}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-lg font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Activate
                </button>
              )}
              {canEdit && st === 'ACTIVE' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act(() => wholesaleApi.holdDealer(id), 'On hold')}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-lg font-semibold border border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300 disabled:opacity-50"
                >
                  Hold
                </button>
              )}
              {canEdit && st !== 'SUSPENDED' && st !== 'CLOSED' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act(() => wholesaleApi.suspendDealer(id), 'Suspended')}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-lg font-semibold border border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-300 disabled:opacity-50"
                >
                  Suspend
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-lg border font-semibold"
                style={{ borderColor: 'var(--border-default)', background: 'var(--bg-subtle)', color: 'var(--text-primary)' }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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

  const safeText = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v))
  const st = String(row?.status ?? '')
  const lines = (row?.lines as AnyRow[] | undefined) ?? []
  const orderNum = String(
    (row?.salesOrder as { orderNumber?: string } | undefined)?.orderNumber ??
      row?.salesOrderId ??
      '—',
  )
  const dealer = row?.dealer as
    | { id?: string; tradingName?: string; legalName?: string; dealerCode?: string }
    | undefined
  const dealerName =
    dealer?.tradingName || dealer?.legalName || dealerLabel(row ?? {}) || '—'
  const pickedLines = lines.filter((l) => Number(l.pickedQty ?? 0) > 0).length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="rounded-xl w-full max-w-5xl shadow-2xl max-h-[92vh] overflow-y-auto border"
        style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 sm:px-5 py-3 border-b sticky top-0 z-10"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-start gap-2 min-w-0">
            <Package size={16} className="text-violet-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                Pick List
                {row ? (
                  <>
                    {' '}
                    ( <span className="font-mono">{safeText(row.pickNumber)}</span> )
                  </>
                ) : null}
              </p>
              <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                {loading ? 'Loading…' : `Order ${orderNum} · ${dealerName}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {row && statusChip(st)}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-sky-400" />
          </div>
        )}
        {!loading && !row && (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Failed to load pick list
          </div>
        )}
        {!loading && row && (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="space-y-1 text-[12px]">
                <div className="flex items-center gap-1.5">
                  <Hash size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Pick #:</span>
                  <span className="font-mono font-medium">{safeText(row.pickNumber)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <FileText size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Order:</span>
                  <span className="font-mono font-medium">{orderNum}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Building2 size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Dealer:</span>
                  <span className="font-medium truncate">{dealerName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Created:</span>
                  <span className="font-medium">
                    {row.createdAt ? formatDate(String(row.createdAt)) : '—'}
                  </span>
                </div>
              </div>
              <div className="space-y-1 text-[12px]">
                <div className="flex items-center gap-1.5">
                  <Tag size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                  <span className="font-medium">{st.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Package size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Lines:</span>
                  <span className="font-medium">{lines.length}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Picked lines:</span>
                  <span className="font-medium">{pickedLines}</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <FileText size={13} className="mt-0.5" style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Notes:</span>
                  <span className="font-medium">{safeText(row.notes)}</span>
                </div>
              </div>
              <div
                className="rounded-lg border p-3 text-[12px]"
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}
              >
                <div
                  className="flex items-center justify-between border-b pb-2 mb-2"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    Progress
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Requested lines</span>
                    <span className="font-medium">{lines.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>With pick qty</span>
                    <span className="font-medium">{pickedLines}</span>
                  </div>
                  <div
                    className="flex justify-between pt-2 border-t"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <span className="font-semibold">Status</span>
                    <span className="font-bold text-violet-600 dark:text-violet-400">
                      {st.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {canEdit && (st === 'DRAFT' || st === 'ASSIGNED' || st === 'IN_PROGRESS') && (
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
              {canEdit && st !== 'COMPLETED' && st !== 'CANCELLED' && (
                <ActionBtn busy={busy} onClick={() => act(() => wholesaleApi.completePick(id), 'Pick completed')}>
                  Complete
                </ActionBtn>
              )}
              {canEdit && st === 'COMPLETED' && (
                <>
                  <ActionBtn tone="emerald" busy={busy} onClick={() => act(() => wholesaleApi.packPick(id), 'Packed')}>
                    Pack
                  </ActionBtn>
                  <ActionBtn
                    busy={busy}
                    onClick={() =>
                      act(() => wholesaleApi.createDispatch({ pickListId: id }), 'Dispatch note created')
                    }
                  >
                    Create DN
                  </ActionBtn>
                </>
              )}
              {row.salesOrderId ? (
                <Link
                  href={`/dashboard/wholesale/orders?id=${String(row.salesOrderId)}`}
                  className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg font-semibold border"
                  style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                >
                  View order
                </Link>
              ) : null}
            </div>

            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                Pick lines
              </p>
              <LinesTable lines={lines} columns="pick" />
            </div>
          </div>
        )}
      </div>
    </div>
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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

  const safeText = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v))
  const st = String(row?.status ?? '')
  const lines = (row?.lines as AnyRow[] | undefined) ?? []
  const pickNum = String(
    (row?.pickList as { pickNumber?: string } | undefined)?.pickNumber ?? row?.pickListId ?? '—',
  )
  const serialCount = lines.reduce(
    (s, l) => s + (((l.serials as unknown[] | undefined) ?? []).length),
    0,
  )
  const qtyTotal = lines.reduce((s, l) => s + Number(l.quantity ?? 0), 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="rounded-xl w-full max-w-5xl shadow-2xl max-h-[92vh] overflow-y-auto border"
        style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 sm:px-5 py-3 border-b sticky top-0 z-10"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-start gap-2 min-w-0">
            <Truck size={16} className="text-sky-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                Dispatch Note
                {row ? (
                  <>
                    {' '}
                    ( <span className="font-mono">{safeText(row.dispatchNumber)}</span> )
                  </>
                ) : null}
              </p>
              <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                {loading ? 'Loading…' : `Pick ${pickNum} · ${dealerLabel(row ?? {})}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {row && statusChip(st)}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-sky-400" />
          </div>
        )}
        {!loading && !row && (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Failed to load dispatch
          </div>
        )}
        {!loading && row && (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="space-y-1 text-[12px]">
                <div className="flex items-center gap-1.5">
                  <Hash size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>DN #:</span>
                  <span className="font-mono font-medium">{safeText(row.dispatchNumber)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Package size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Pick:</span>
                  <span className="font-mono font-medium">{pickNum}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Building2 size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Dealer:</span>
                  <span className="font-medium truncate">{dealerLabel(row)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Created:</span>
                  <span className="font-medium">
                    {row.createdAt ? formatDate(String(row.createdAt)) : '—'}
                  </span>
                </div>
              </div>
              <div className="space-y-1 text-[12px]">
                <div className="flex items-center gap-1.5">
                  <Tag size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                  <span className="font-medium">{st.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Truck size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Lines:</span>
                  <span className="font-medium">{lines.length}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Hash size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>IMEIs bound:</span>
                  <span className="font-medium">{serialCount}</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <FileText size={13} className="mt-0.5" style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Notes:</span>
                  <span className="font-medium">{safeText(row.notes)}</span>
                </div>
              </div>
              <div
                className="rounded-lg border p-3 text-[12px]"
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}
              >
                <div
                  className="flex items-center justify-between border-b pb-2 mb-2"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    Quick totals
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Qty units</span>
                    <span className="font-medium">{qtyTotal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Serials</span>
                    <span className="font-medium">{serialCount}</span>
                  </div>
                  <div
                    className="flex justify-between pt-2 border-t"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <span className="font-semibold">Status</span>
                    <span className="font-bold text-sky-600 dark:text-sky-400">
                      {st.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {canEdit && st === 'DRAFT' && (
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
              )}
              {st === 'DISPATCHED' && (
                <Link
                  href="/dashboard/wholesale/delivery"
                  className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg font-semibold bg-sky-600 text-white"
                >
                  <Truck size={12} /> Open delivery
                </Link>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                Dispatch lines
              </p>
              <LinesTable lines={lines} columns="dispatch" />
            </div>
          </div>
        )}
      </div>
    </div>
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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

  const safeText = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v))
  const st = String(row?.status ?? '')
  const lines = (row?.lines as AnyRow[] | undefined) ?? []
  const dealer = row?.dealer as
    | { id?: string; tradingName?: string; legalName?: string; dealerCode?: string }
    | undefined
  const dealerName = dealerLabel(row ?? {})
  const total = Number(row?.total ?? row?.refundAmount ?? 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="rounded-xl w-full max-w-5xl shadow-2xl max-h-[92vh] overflow-y-auto border"
        style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 sm:px-5 py-3 border-b sticky top-0 z-10"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-start gap-2 min-w-0">
            <RotateCcw size={16} className="text-rose-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                Return / RMA
                {row ? (
                  <>
                    {' '}
                    ( <span className="font-mono">{safeText(row.returnNumber)}</span> )
                  </>
                ) : null}
              </p>
              <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                {loading ? 'Loading…' : `${dealerName} · ${safeText(dealer?.dealerCode)}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {row && statusChip(st)}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-sky-400" />
          </div>
        )}
        {!loading && !row && (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Failed to load return
          </div>
        )}
        {!loading && row && (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="space-y-1 text-[12px]">
                <div className="flex items-center gap-1.5">
                  <Hash size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>RMA #:</span>
                  <span className="font-mono font-medium">{safeText(row.returnNumber)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Building2 size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Dealer:</span>
                  <span className="font-medium truncate">{dealerName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Created:</span>
                  <span className="font-medium">
                    {row.createdAt ? formatDate(String(row.createdAt)) : '—'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Received:</span>
                  <span className="font-medium">
                    {row.receivedAt ? formatDate(String(row.receivedAt)) : '—'}
                  </span>
                </div>
              </div>
              <div className="space-y-1 text-[12px]">
                <div className="flex items-center gap-1.5">
                  <Tag size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                  <span className="font-medium">{st.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Package size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Lines:</span>
                  <span className="font-medium">{lines.length}</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <FileText size={13} className="mt-0.5" style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Reason:</span>
                  <span className="font-medium">{safeText(row.reason)}</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <FileText size={13} className="mt-0.5" style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Notes:</span>
                  <span className="font-medium">{safeText(row.notes)}</span>
                </div>
              </div>
              <div
                className="rounded-lg border p-3 text-[12px]"
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}
              >
                <div
                  className="flex items-center justify-between border-b pb-2 mb-2"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    Quick totals
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    LKR
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Lines</span>
                    <span className="font-medium">{lines.length}</span>
                  </div>
                  <div
                    className="flex justify-between pt-2 border-t"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <span className="font-semibold">Return value</span>
                    <span className="font-bold text-rose-600 dark:text-rose-400">
                      {formatCurrency(total)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {canEdit && st === 'DRAFT' && (
                <ActionBtn
                  busy={busy}
                  onClick={() => act(() => wholesaleApi.approveReturn(id), 'Approved (received)')}
                >
                  Approve
                </ActionBtn>
              )}
              {canEdit && st === 'RECEIVED' && (
                <ActionBtn
                  tone="border"
                  busy={busy}
                  onClick={() => act(() => wholesaleApi.qcReturn(id), 'QC recorded')}
                >
                  QC
                </ActionBtn>
              )}
              {canEdit && (st === 'RECEIVED' || st === 'QC') && lines.length > 0 && (
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
              {canEdit && st === 'QC' && (
                <ActionBtn
                  tone="emerald"
                  busy={busy}
                  onClick={() => act(() => wholesaleApi.creditNoteReturn(id), 'Credit note issued')}
                >
                  Credit note
                </ActionBtn>
              )}
              {canEdit && st === 'CREDITED' && (
                <ActionBtn
                  tone="border"
                  busy={busy}
                  onClick={() => act(() => wholesaleApi.closeReturn(id), 'Closed')}
                >
                  Close
                </ActionBtn>
              )}
              {dealer?.id && (
                <Link
                  href={`/dashboard/wholesale/dealers?id=${dealer.id}`}
                  className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg font-semibold border"
                  style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                >
                  <Building2 size={12} /> View dealer
                </Link>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                Return lines
              </p>
              <LinesTable lines={lines} columns="return" />
            </div>
          </div>
        )}
      </div>
    </div>
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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

  const safeText = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v))
  const st = String(row?.status ?? '')
  const stops = (row?.stops as AnyRow[] | undefined) ?? []
  const vehicle = row?.vehicle as { plateNumber?: string; name?: string } | undefined
  const driver = row?.driver as { name?: string; email?: string } | undefined
  const doneStops = stops.filter((s) =>
    ['COMPLETED', 'DELIVERED', 'ACCEPTED'].includes(String(s.status)),
  ).length
  const pendingStops = stops.length - doneStops

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="rounded-xl w-full max-w-5xl shadow-2xl max-h-[92vh] overflow-y-auto border"
        style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 sm:px-5 py-3 border-b sticky top-0 z-10"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-start gap-2 min-w-0">
            <Truck size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                Delivery Trip
                {row ? (
                  <>
                    {' '}
                    ( <span className="font-mono">{safeText(row.tripNumber)}</span> )
                  </>
                ) : null}
              </p>
              <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                {loading
                  ? 'Loading…'
                  : `${safeText(vehicle?.plateNumber || vehicle?.name)} · ${stops.length} stops`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {row && statusChip(st)}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-sky-400" />
          </div>
        )}
        {!loading && !row && (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Failed to load trip
          </div>
        )}
        {!loading && row && (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="space-y-1 text-[12px]">
                <div className="flex items-center gap-1.5">
                  <Hash size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Trip #:</span>
                  <span className="font-mono font-medium">{safeText(row.tripNumber)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Truck size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Vehicle:</span>
                  <span className="font-medium">{safeText(vehicle?.plateNumber || vehicle?.name)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Building2 size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Driver:</span>
                  <span className="font-medium truncate">{safeText(driver?.name)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Planned:</span>
                  <span className="font-medium">
                    {row.plannedDate ? formatDate(String(row.plannedDate)) : '—'}
                  </span>
                </div>
              </div>
              <div className="space-y-1 text-[12px]">
                <div className="flex items-center gap-1.5">
                  <Tag size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                  <span className="font-medium">{st.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Route:</span>
                  <span className="font-medium">{safeText(row.routeName)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Started:</span>
                  <span className="font-medium">
                    {row.startedAt ? formatDate(String(row.startedAt)) : '—'}
                  </span>
                </div>
                <div className="flex items-start gap-1.5">
                  <FileText size={13} className="mt-0.5" style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Notes:</span>
                  <span className="font-medium">{safeText(row.notes)}</span>
                </div>
              </div>
              <div
                className="rounded-lg border p-3 text-[12px]"
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}
              >
                <div
                  className="flex items-center justify-between border-b pb-2 mb-2"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    Stop progress
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Total stops</span>
                    <span className="font-medium">{stops.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Done</span>
                    <span className="font-medium">{doneStops}</span>
                  </div>
                  <div
                    className="flex justify-between pt-2 border-t"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <span className="font-semibold">Remaining</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {pendingStops}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {canEdit && (st === 'PLANNED' || st === 'LOADED' || st === 'DRAFT') && (
                <ActionBtn busy={busy} onClick={() => act(() => wholesaleApi.startTrip(id), 'Trip started')}>
                  Start trip
                </ActionBtn>
              )}
              {canEdit && (st === 'IN_PROGRESS' || st === 'STARTED') && (
                <ActionBtn
                  tone="emerald"
                  busy={busy}
                  onClick={() => act(() => wholesaleApi.completeTrip(id), 'Trip completed')}
                >
                  Complete trip
                </ActionBtn>
              )}
              <Link
                href="/dashboard/wholesale/warehouse?tab=dispatches"
                className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg font-semibold border"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
              >
                <Package size={12} /> Warehouse DNs
              </Link>
            </div>

            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                Stops
              </p>
              {stops.length === 0 ? (
                <p className="text-xs py-4 text-center" style={{ color: 'var(--text-muted)' }}>
                  No stops on this trip
                </p>
              ) : (
                <div className="space-y-2">
                  {stops.map((stop, idx) => {
                    const stopId = String(stop.id)
                    const stopSt = String(stop.status ?? '')
                    return (
                      <div
                        key={stopId}
                        className="rounded-xl border px-3 py-2.5 flex flex-wrap items-center justify-between gap-2"
                        style={{ borderColor: 'var(--border-subtle)' }}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            #{idx + 1} {dealerLabel(stop)}
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            {statusChip(stopSt)}
                            {(stop.salesOrder as { orderNumber?: string } | undefined)?.orderNumber ? (
                              <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                                {(stop.salesOrder as { orderNumber?: string }).orderNumber}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {canEdit && (stopSt === 'PENDING' || stopSt === 'PLANNED') && (
                            <ActionBtn
                              busy={busy}
                              onClick={() => act(() => wholesaleApi.arriveStop(id, stopId), 'Arrived')}
                            >
                              Arrive
                            </ActionBtn>
                          )}
                          {canEdit && (stopSt === 'ARRIVED' || stopSt === 'PENDING') && (
                            <ActionBtn tone="emerald" busy={busy} onClick={() => onPod(id, stopId)}>
                              POD
                            </ActionBtn>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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

  const safeText = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v))
  const st = String(row?.status ?? '')
  const vehicle = row?.vehicle as { plateNumber?: string; name?: string } | undefined
  const declared = Number(row?.declaredCash ?? 0)
  const expected = Number(row?.expectedCash ?? 0)
  const variance = declared - expected

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="rounded-xl w-full max-w-3xl shadow-2xl max-h-[92vh] overflow-y-auto border"
        style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 sm:px-5 py-3 border-b sticky top-0 z-10"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-start gap-2 min-w-0">
            <Wallet size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                Van Settlement
                {row ? (
                  <>
                    {' '}
                    ( <span className="font-mono">{safeText(vehicle?.plateNumber || vehicle?.name)}</span> )
                  </>
                ) : null}
              </p>
              <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                {row
                  ? `${safeText(row.settlementDate || row.createdAt)} · ${st.replace(/_/g, ' ')}`
                  : id}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {row && statusChip(st)}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {!row ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Settlement details unavailable
          </div>
        ) : (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="space-y-1 text-[12px]">
                <div className="flex items-center gap-1.5">
                  <Truck size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Vehicle:</span>
                  <span className="font-medium">{safeText(vehicle?.plateNumber || vehicle?.name)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Date:</span>
                  <span className="font-medium">
                    {row.settlementDate
                      ? formatDate(String(row.settlementDate))
                      : row.createdAt
                        ? formatDate(String(row.createdAt))
                        : '—'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Tag size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                  <span className="font-medium">{st.replace(/_/g, ' ')}</span>
                </div>
              </div>
              <div className="space-y-1 text-[12px]">
                <div className="flex items-start gap-1.5">
                  <FileText size={13} className="mt-0.5" style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Notes:</span>
                  <span className="font-medium">{safeText(row.notes)}</span>
                </div>
              </div>
              <div
                className="rounded-lg border p-3 text-[12px]"
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}
              >
                <div
                  className="flex items-center justify-between border-b pb-2 mb-2"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    Cash totals
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    LKR
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Declared</span>
                    <span className="font-medium">{formatCurrency(declared)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Expected</span>
                    <span className="font-medium">{formatCurrency(expected)}</span>
                  </div>
                  <div
                    className="flex justify-between pt-2 border-t"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <span className="font-semibold">Variance</span>
                    <span
                      className={`font-bold ${
                        variance === 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : variance > 0
                            ? 'text-sky-600 dark:text-sky-400'
                            : 'text-rose-500'
                      }`}
                    >
                      {formatCurrency(variance)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {canEdit && st === 'DRAFT' && (
                <ActionBtn busy={busy} onClick={() => act(() => wholesaleApi.submitSettlement(id), 'Submitted')}>
                  Submit
                </ActionBtn>
              )}
              {canEdit && st === 'SUBMITTED' && (
                <ActionBtn
                  tone="emerald"
                  busy={busy}
                  onClick={() => act(() => wholesaleApi.approveSettlement(id), 'Approved')}
                >
                  Approve
                </ActionBtn>
              )}
              <Link
                href="/dashboard/hr/commission"
                className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg font-semibold border"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
              >
                <Wallet size={12} /> HR commission
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
