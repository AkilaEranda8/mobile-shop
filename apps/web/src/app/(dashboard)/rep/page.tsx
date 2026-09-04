'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Lock, MapPin, Package, ShoppingBag, Truck, Wallet, Loader2, Search, ChevronRight, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useFeatureFlag, useActiveBranchId } from '@/lib/hooks'
import { formatCurrency } from '@/lib/utils'
import { wholesaleApi, type WholesaleDealer } from '@/lib/wholesale-api'
import { isNetworkError } from '@/lib/offline/sync'
import { queueOfflineVanSale, queueOfflineVanPayment } from '@/lib/offline/queue-van'

export default function RepShellPage() {
  const enabled = useFeatureFlag('REP_VAN_SALES')
  const branchId = useActiveBranchId()
  const [dealers, setDealers] = useState<WholesaleDealer[]>([])
  const [vehicleList, setVehicleList] = useState<Array<{ id: string; plateNumber?: string; name?: string }>>([])
  const [vehicleId, setVehicleId] = useState('')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [collectDealer, setCollectDealer] = useState<WholesaleDealer | null>(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('CASH')
  const [saving, setSaving] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)
  const [saleProduct, setSaleProduct] = useState('')
  const [saleQty, setSaleQty] = useState('1')
  const [saleUnitPrice, setSaleUnitPrice] = useState('0')
  const [saleCash, setSaleCash] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      wholesaleApi.dealers({ limit: '200', isActive: 'true' }).catch(() => ({ data: [] as WholesaleDealer[] })),
      wholesaleApi.vehicles({ limit: '50' }).catch(() => ({ data: [] })),
    ])
      .then(([d, v]) => {
        setDealers((d as { data?: WholesaleDealer[] }).data ?? [])
        const vr = v as { data?: unknown }
        const vArr = Array.isArray(vr.data)
          ? (vr.data as Array<{ id: string; plateNumber?: string; name?: string }>)
          : []
        setVehicleList(vArr)
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (enabled) load()
  }, [enabled, branchId, load])

  // Auto-select first vehicle
  useEffect(() => {
    if (vehicleList.length > 0 && !vehicleId) setVehicleId(vehicleList[0].id)
  }, [vehicleList, vehicleId])

  useEffect(() => {
    if (!collectDealer) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCollectDealer(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [collectDealer])

  const handleCheckIn = async (dealer: WholesaleDealer) => {
    if (!vehicleId) { toast.error('Select a vehicle first'); return }
    setCheckingIn(true)
    try {
      await wholesaleApi.upsertVisit({ dealerId: dealer.id, vehicleId })
      toast.success('Checked in')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setCheckingIn(false)
    }
  }

  const submitVanSale = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!collectDealer) return
    if (!vehicleId) { toast.error('Select a vehicle first'); return }
    if (!saleProduct.trim()) { toast.error('Product ID required'); return }
    const qty = Number(saleQty)
    const unitPrice = Number(saleUnitPrice)
    const cash = Number(saleCash)
    if (!(qty > 0)) { toast.error('Qty must be positive'); return }
    if (!(cash > 0)) { toast.error('Cash received must be positive'); return }
    setSaving(true)
    const saleBody = {
      vehicleId,
      dealerId: collectDealer.id,
      lines: [
        {
          productId: saleProduct.trim(),
          quantity: qty,
          unitPrice: unitPrice >= 0 ? unitPrice : 0,
          sellUnit: 'PIECE' as const,
        },
      ],
      payments: [{ method: 'CASH' as const, amount: cash }],
    }
    try {
      await wholesaleApi.vanSale(saleBody)
      toast.success('Sale recorded')
      setSaleProduct('')
      setSaleQty('1')
      setSaleUnitPrice('0')
      setSaleCash('')
    } catch (err) {
      if (isNetworkError(err)) {
        await queueOfflineVanSale(saleBody)
        toast.success('Queued offline')
        setSaleProduct('')
        setSaleQty('1')
        setSaleUnitPrice('0')
        setSaleCash('')
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed')
      }
    } finally {
      setSaving(false)
    }
  }

  const submitCollect = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!collectDealer || !amount) {
      toast.error('Amount required')
      return
    }
    setSaving(true)
    const payBody = { dealerId: collectDealer.id, amount: Number(amount), method }
    try {
      await wholesaleApi.createPayment(payBody)
      toast.success('Payment recorded')
      setCollectDealer(null)
      setAmount('')
      load()
    } catch (err) {
      if (isNetworkError(err)) {
        await queueOfflineVanPayment(payBody)
        toast.success('Queued offline')
        setCollectDealer(null)
        setAmount('')
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed')
      }
    } finally {
      setSaving(false)
    }
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return dealers.slice(0, 20)
    return dealers
      .filter(
        (d) =>
          d.legalName.toLowerCase().includes(s) ||
          (d.tradingName ?? '').toLowerCase().includes(s) ||
          d.dealerCode.toLowerCase().includes(s) ||
          d.phone.includes(s),
      )
      .slice(0, 20)
  }, [dealers, q])

  if (!enabled) {
    return (
      <div className="mx-auto mt-20 max-w-md px-4 text-center">
        <Lock className="mx-auto text-sky-600" />
        <h1 className="mt-4 text-xl font-bold">Rep / Van Sales is not enabled</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          Ask a platform administrator to enable the REP_VAN_SALES tenant feature.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-5 space-y-5 pb-28">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-600">Hexalyte Rep</p>
          <h1 className="mt-1 text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Field sales
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Visit dealers, sell from van stock, collect outstanding.
          </p>
        </div>
        <Link
          href="/dashboard/wholesale"
          className="text-[11px] font-medium text-sky-700 shrink-0 pt-1"
        >
          Desktop
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {[
          {
            href: '/dashboard/wholesale/van',
            icon: Truck,
            label: 'Vehicles',
            hint: vehicleList.length ? `${vehicleList.length} assigned` : 'Manage vans',
          },
          {
            href: '/dashboard/wholesale/pos',
            icon: ShoppingBag,
            label: 'Sell (POS)',
            hint: 'Counter / van sale',
          },
          {
            href: '/dashboard/wholesale/collections',
            icon: Wallet,
            label: 'AR desk',
            hint: 'Ageing & tasks',
          },
          {
            href: '/dashboard/wholesale/van',
            icon: Package,
            label: 'Settlements',
            hint: 'End of day',
          },
        ].map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="card p-3.5 flex flex-col gap-1.5 active:scale-[0.98] transition-transform"
          >
            <item.icon size={18} className="text-sky-600" />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {item.label}
            </span>
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {item.hint}
            </span>
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Truck size={14} className="text-sky-600 shrink-0" />
        <label className="text-xs font-medium shrink-0" style={{ color: 'var(--text-muted)' }}>
          Active vehicle
        </label>
        <select
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
          className="flex-1 text-xs rounded-lg px-2 py-1.5"
          style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
        >
          <option value="">No vehicle selected</option>
          {vehicleList.map((v) => (
            <option key={v.id} value={v.id}>
              {v.plateNumber || v.name || v.id}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-sky-600" />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Dealer visit
          </h2>
        </div>
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2.5"
          style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}
        >
          <Search size={16} style={{ color: 'var(--text-muted)' }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search dealer…"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-sky-500" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>
            No dealers match. Create dealers in Wholesale → Dealers.
          </p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => {
                    setCollectDealer(d)
                    setAmount(Number(d.totalDue) > 0 ? String(d.totalDue) : '')
                  }}
                  className="card p-3 w-full flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {d.tradingName || d.legalName}
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {d.dealerCode} · {d.phone}
                    </p>
                    {Number(d.totalDue) > 0 && (
                      <p className="text-[11px] font-semibold text-amber-600 mt-0.5">
                        Due {formatCurrency(Number(d.totalDue))}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {collectDealer && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close"
            onClick={() => setCollectDealer(null)}
          />
          <div
            className="relative w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-5 max-h-[92dvh] overflow-y-auto"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {collectDealer.tradingName || collectDealer.legalName}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {collectDealer.dealerCode} · {collectDealer.phone}
                  {Number(collectDealer.totalDue) > 0
                    ? ` · due ${formatCurrency(Number(collectDealer.totalDue))}`
                    : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={checkingIn}
                  onClick={() => handleCheckIn(collectDealer)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 disabled:opacity-60"
                >
                  {checkingIn ? 'Checking in…' : 'Check in'}
                </button>
                <button type="button" onClick={() => setCollectDealer(null)} className="p-1">
                  <X size={18} style={{ color: 'var(--text-muted)' }} />
                </button>
              </div>
            </div>

            {/* Quick van sale */}
            <div className="space-y-2.5">
              <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Quick van sale</p>
              <form onSubmit={submitVanSale} className="space-y-2">
                <input
                  value={saleProduct}
                  onChange={(e) => setSaleProduct(e.target.value)}
                  placeholder="Product ID / SKU"
                  className="w-full rounded-xl px-3 py-2.5 text-sm"
                  style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    min={0.001}
                    step="any"
                    value={saleQty}
                    onChange={(e) => setSaleQty(e.target.value)}
                    placeholder="Qty"
                    className="rounded-xl px-3 py-2.5 text-sm"
                    style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                  />
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={saleUnitPrice}
                    onChange={(e) => setSaleUnitPrice(e.target.value)}
                    placeholder="Unit price"
                    className="rounded-xl px-3 py-2.5 text-sm"
                    style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                  />
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={saleCash}
                    onChange={(e) => setSaleCash(e.target.value)}
                    placeholder="CASH rcvd"
                    className="rounded-xl px-3 py-2.5 text-sm"
                    style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving || !saleProduct.trim()}
                  className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold text-white bg-emerald-600 disabled:opacity-50"
                >
                  {saving ? 'Recording…' : 'Record sale'}
                </button>
              </form>
            </div>

            <hr style={{ borderColor: 'var(--border-subtle)' }} />

            {/* Collect payment */}
            <div className="space-y-2.5">
              <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Collect payment</p>
              <form onSubmit={submitCollect} className="space-y-2">
                <input
                  type="number"
                  min={0.01}
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Amount"
                  className="w-full rounded-xl px-3 py-2.5 text-sm"
                  style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                  required
                />
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm"
                  style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                >
                  {['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'UPI', 'WALLET'].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/dashboard/wholesale/pos"
                    className="rounded-xl px-3 py-2.5 text-sm font-medium text-center border"
                    style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                  >
                    Open POS
                  </Link>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl px-3 py-2.5 text-sm font-semibold text-white bg-sky-600 disabled:opacity-60"
                  >
                    {saving ? 'Saving…' : 'Record payment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
