'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Truck, Plus, Search, Filter, RefreshCw, Package, CheckCircle2,
  Clock, Loader2, Bell, Settings, QrCode, Hash, ChevronDown,
  MapPin, Phone, MessageSquare, Printer, MoreVertical, X, Upload,
  Trash2, Eye, Send, AlertCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  deliveryApi, DeliveryOrder, Courier, TrackingNumber,
  DeliveryNotification, DeliveryStats, STATUS_COLORS, STATUS_LABELS,
  DeliveryStatus,
} from '@/lib/delivery-api'
import CreateOrderModal from '@/components/delivery/CreateOrderModal'
import AssignTrackingModal from '@/components/delivery/AssignTrackingModal'
import WaybillPreview from '@/components/delivery/WaybillPreview'
import CourierSettingsModal from '@/components/delivery/CourierSettingsModal'
import TrackingPoolModal from '@/components/delivery/TrackingPoolModal'
import OrderDetailModal from '@/components/delivery/OrderDetailModal'

const TABS = ['Orders', 'Tracking Pool', 'Couriers', 'Notifications'] as const
type Tab = typeof TABS[number]

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: 'ALL',               label: 'All'              },
  { value: 'PENDING',           label: 'Pending'          },
  { value: 'PACKED',            label: 'Packed'           },
  { value: 'AWAITING_TRACKING', label: 'Awaiting Tracking'},
  { value: 'DISPATCHED',        label: 'Dispatched'       },
  { value: 'IN_TRANSIT',        label: 'In Transit'       },
  { value: 'DELIVERED',         label: 'Delivered'        },
  { value: 'CANCELLED',         label: 'Cancelled'        },
]

export default function DeliveryPage() {
  const [tab, setTab]           = useState<Tab>('Orders')
  const [orders, setOrders]     = useState<DeliveryOrder[]>([])
  const [stats, setStats]       = useState<DeliveryStats | null>(null)
  const [couriers, setCouriers] = useState<Courier[]>([])
  const [tracking, setTracking] = useState<TrackingNumber[]>([])
  const [notifs, setNotifs]     = useState<DeliveryNotification[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [page, setPage]         = useState(1)
  const [total, setTotal]       = useState(0)

  const [showCreate,   setShowCreate]   = useState(false)
  const [showTracking, setShowTracking] = useState<DeliveryOrder | null>(null)
  const [showWaybill,  setShowWaybill]  = useState<DeliveryOrder | null>(null)
  const [showCouriers, setShowCouriers] = useState(false)
  const [showPool,     setShowPool]     = useState(false)
  const [showDetail,   setShowDetail]   = useState<DeliveryOrder | null>(null)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await deliveryApi.getOrders({ status: statusFilter, search: search || undefined, page, limit: 20 })
      const d = res?.data ?? res
      setOrders(d?.orders ?? [])
      setTotal(d?.total ?? 0)
    } catch { toast.error('Failed to load orders') }
    finally { setLoading(false) }
  }, [statusFilter, search, page])

  const loadStats = useCallback(async () => {
    try {
      const res: any = await deliveryApi.getStats()
      setStats(res?.data ?? res)
    } catch {}
  }, [])

  const loadCouriers = useCallback(async () => {
    try {
      const res: any = await deliveryApi.getCouriers()
      setCouriers(res?.data ?? res ?? [])
    } catch {}
  }, [])

  const loadTracking = useCallback(async () => {
    try {
      const res: any = await deliveryApi.getTracking()
      setTracking(res?.data ?? res ?? [])
    } catch {}
  }, [])

  const loadNotifs = useCallback(async () => {
    try {
      const res: any = await deliveryApi.getNotifications()
      setNotifs(res?.data ?? res ?? [])
    } catch {}
  }, [])

  useEffect(() => { loadOrders(); loadStats() }, [loadOrders, loadStats])
  useEffect(() => { if (tab === 'Couriers') loadCouriers() }, [tab, loadCouriers])
  useEffect(() => { if (tab === 'Tracking Pool') loadTracking() }, [tab, loadTracking])
  useEffect(() => { if (tab === 'Notifications') loadNotifs() }, [tab, loadNotifs])

  const handleSeedCouriers = async () => {
    try {
      await deliveryApi.seedCouriers()
      loadCouriers()
      toast.success('Default couriers added')
    } catch (e: any) { toast.error(e?.message ?? 'Failed') }
  }

  const handleGenerateWaybill = async (order: DeliveryOrder) => {
    try {
      const res: any = await deliveryApi.generateWaybill(order.id)
      setShowWaybill({ ...order, ...(res?.data ?? res) })
    } catch (e: any) { toast.error(e?.message ?? 'Failed to generate waybill') }
  }

  const handleResendWhatsApp = async (id: string) => {
    try {
      await deliveryApi.resendWhatsApp(id)
      toast.success('WhatsApp notification sent')
    } catch (e: any) { toast.error(e?.message ?? 'Failed') }
  }

  const handleRetryNotif = async (id: string) => {
    try {
      await deliveryApi.retryNotification(id)
      toast.success('Retried')
      loadNotifs()
    } catch (e: any) { toast.error(e?.message ?? 'Failed') }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Delivery Orders</h1>
          <p className="text-sm text-slate-400 mt-0.5">Manage courier deliveries, waybills & tracking</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowPool(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors">
            <Hash size={14} /> Tracking Pool
          </button>
          <button onClick={() => setShowCouriers(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors">
            <Settings size={14} /> Couriers
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white transition-colors">
            <Plus size={14} /> New Order
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total',            value: stats.total,            icon: Package,      color: 'text-slate-300' },
            { label: 'Pending',          value: stats.pending,          icon: Clock,        color: 'text-yellow-400' },
            { label: 'Awaiting Track.',  value: stats.awaitingTracking, icon: Hash,         color: 'text-orange-400' },
            { label: 'Dispatched',       value: stats.dispatched,       icon: Truck,        color: 'text-violet-400' },
            { label: 'Delivered',        value: stats.delivered,        icon: CheckCircle2, color: 'text-green-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card p-4 flex items-center gap-3">
              <Icon size={20} className={color} />
              <div>
                <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
                <p className="text-xs text-slate-400">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-700/50">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t ? 'border-violet-500 text-violet-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}>{t}</button>
        ))}
      </div>

      {/* Orders Tab */}
      {tab === 'Orders' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input-field pl-8 text-sm w-full" placeholder="Search orders, customers, tracking..."
                value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
            </div>
            <select className="input-field text-sm w-44"
              value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
              {STATUS_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <button onClick={loadOrders} className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">
              <RefreshCw size={14} />
            </button>
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    {['Order #', 'Customer', 'Destination', 'Courier / Tracking', 'Amount', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center">
                      <Loader2 size={22} className="animate-spin mx-auto text-violet-400" />
                    </td></tr>
                  ) : orders.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                      <Truck size={32} className="mx-auto mb-2 opacity-30" />
                      No delivery orders found
                    </td></tr>
                  ) : orders.map(order => (
                    <tr key={order.id} className="border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <button onClick={() => setShowDetail(order)} className="font-mono font-semibold text-violet-400 hover:underline">
                          {order.orderNumber}
                        </button>
                        <p className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleDateString()}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{order.customerName}</p>
                        <p className="text-xs text-slate-400 flex items-center gap-1"><Phone size={10} />{order.customerPhone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-slate-300 flex items-center gap-1"><MapPin size={10} className="shrink-0" />
                          {order.city}{order.district ? `, ${order.district}` : ''}
                        </p>
                        <p className="text-xs text-slate-500 truncate max-w-32">{order.addressLine1}</p>
                      </td>
                      <td className="px-4 py-3">
                        {order.courier ? (
                          <>
                            <p className="text-xs font-medium text-slate-300">{order.courier.name}</p>
                            <p className="text-xs font-mono text-violet-300">{order.trackingNumber ?? '—'}</p>
                          </>
                        ) : <span className="text-xs text-slate-500">Not assigned</span>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                          LKR {order.totalAmount.toLocaleString()}
                        </p>
                        {order.isCOD && <span className="text-xs bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded">COD</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[order.status]}`}>
                          {STATUS_LABELS[order.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <button title="Generate Waybill" onClick={() => handleGenerateWaybill(order)}
                            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                            <Printer size={13} />
                          </button>
                          {!order.trackingNumber && (
                            <button title="Assign Tracking" onClick={() => setShowTracking(order)}
                              className="p-1.5 rounded hover:bg-violet-700 text-violet-400 hover:text-white transition-colors">
                              <Hash size={13} />
                            </button>
                          )}
                          {order.trackingNumber && (
                            <button title="Resend WhatsApp" onClick={() => handleResendWhatsApp(order.id)}
                              className="p-1.5 rounded hover:bg-green-700 text-green-400 hover:text-white transition-colors">
                              <MessageSquare size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {total > 20 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700/50">
                <p className="text-xs text-slate-400">Showing {(page-1)*20+1}–{Math.min(page*20, total)} of {total}</p>
                <div className="flex gap-2">
                  <button disabled={page === 1} onClick={() => setPage(p => p-1)}
                    className="px-3 py-1.5 rounded text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-300">Prev</button>
                  <button disabled={page*20 >= total} onClick={() => setPage(p => p+1)}
                    className="px-3 py-1.5 rounded text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-300">Next</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tracking Pool Tab */}
      {tab === 'Tracking Pool' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-400">{tracking.length} tracking numbers in pool</p>
            <button onClick={() => setShowPool(true)}
              className="btn-primary flex items-center gap-1.5 text-sm"><Upload size={14} /> Bulk Add</button>
          </div>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-700/50">
                {['Tracking Number', 'Courier', 'Status', 'Assigned At'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {tracking.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-500">No tracking numbers. Add some above.</td></tr>
                ) : tracking.map(t => (
                  <tr key={t.id} className="border-b border-slate-700/30 hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-mono text-violet-300">{t.number}</td>
                    <td className="px-4 py-3 text-slate-300">{t.courier.name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        t.status === 'AVAILABLE' ? 'bg-green-500/20 text-green-300' :
                        t.status === 'ASSIGNED'  ? 'bg-violet-500/20 text-violet-300' :
                        'bg-slate-500/20 text-slate-400'}`}>{t.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {t.assignedAt ? new Date(t.assignedAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Couriers Tab */}
      {tab === 'Couriers' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-400">{couriers.length} couriers configured</p>
            <div className="flex gap-2">
              <button onClick={handleSeedCouriers}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors">
                <RefreshCw size={13} /> Add Defaults
              </button>
              <button onClick={() => setShowCouriers(true)} className="btn-primary flex items-center gap-1.5 text-sm">
                <Plus size={14} /> Add Courier
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {couriers.length === 0 ? (
              <div className="col-span-3 card p-10 text-center text-slate-500">
                No couriers yet. Click "Add Defaults" to add Koombiyo, Domex, Pronto, CityPak.
              </div>
            ) : couriers.map(c => (
              <div key={c.id} className="card p-4 flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center shrink-0">
                  <Truck size={18} className="text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                    {c.isDefault && <span className="text-xs bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded">Default</span>}
                    {!c.isActive && <span className="text-xs bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded">Inactive</span>}
                  </div>
                  <p className="text-xs text-slate-400 font-mono">{c.code}</p>
                  {c.phone && <p className="text-xs text-slate-400 mt-1">{c.phone}</p>}
                  <div className="flex gap-3 mt-2 text-xs text-slate-500">
                    <span>{c._count?.trackingPool ?? 0} tracking #s</span>
                    <span>{c._count?.deliveryOrders ?? 0} orders</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {tab === 'Notifications' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-400">{notifs.length} notification logs</p>
            <button onClick={loadNotifs} className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">
              <RefreshCw size={14} />
            </button>
          </div>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-700/50">
                {['Order', 'Customer', 'Phone', 'Status', 'Sent At', 'Retries', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {notifs.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">No notification logs.</td></tr>
                ) : notifs.map(n => (
                  <tr key={n.id} className="border-b border-slate-700/30 hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-mono text-xs text-violet-300">{n.deliveryOrder?.orderNumber}</td>
                    <td className="px-4 py-3 text-slate-300">{n.deliveryOrder?.customerName}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{n.phone}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        n.status === 'SENT'     ? 'bg-green-500/20 text-green-300' :
                        n.status === 'FAILED'   ? 'bg-red-500/20 text-red-300' :
                        n.status === 'RETRYING' ? 'bg-yellow-500/20 text-yellow-300' :
                        'bg-slate-500/20 text-slate-400'}`}>{n.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {n.sentAt ? new Date(n.sentAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{n.retryCount}</td>
                    <td className="px-4 py-3">
                      {n.status !== 'SENT' && (
                        <button onClick={() => handleRetryNotif(n.id)}
                          className="text-xs px-2 py-1 rounded bg-violet-600 hover:bg-violet-700 text-white">
                          Retry
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateOrderModal
          couriers={couriers}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadOrders(); loadStats() }}
        />
      )}
      {showTracking && (
        <AssignTrackingModal
          order={showTracking}
          couriers={couriers}
          onClose={() => setShowTracking(null)}
          onAssigned={() => { setShowTracking(null); loadOrders(); loadStats() }}
        />
      )}
      {showWaybill && (
        <WaybillPreview
          order={showWaybill}
          onClose={() => setShowWaybill(null)}
        />
      )}
      {showCouriers && (
        <CourierSettingsModal
          couriers={couriers}
          onClose={() => setShowCouriers(false)}
          onRefresh={loadCouriers}
        />
      )}
      {showPool && (
        <TrackingPoolModal
          couriers={couriers}
          onClose={() => setShowPool(false)}
          onRefresh={loadTracking}
        />
      )}
      {showDetail && (
        <OrderDetailModal
          order={showDetail}
          onClose={() => setShowDetail(null)}
          onAssignTracking={(o) => { setShowDetail(null); setShowTracking(o) }}
          onGenerateWaybill={handleGenerateWaybill}
          onResendWhatsApp={handleResendWhatsApp}
        />
      )}
    </div>
  )
}
