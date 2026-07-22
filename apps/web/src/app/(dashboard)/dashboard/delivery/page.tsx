'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { TableActionsRow } from '@/components/table/table-actions-row'
import {
  Truck, Plus, RefreshCw, Package, CheckCircle2,
  Clock, Loader2, Hash, MapPin, Phone, MessageSquare,
  Printer, Upload, Settings,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import toast from 'react-hot-toast'
import {
  deliveryApi, DeliveryOrder, Courier, TrackingNumber,
  DeliveryNotification, DeliveryStats,
} from '@/lib/delivery-api'
import { formatCurrency, formatDate, getDeliveryStatusColor } from '@/lib/utils'
import CreateOrderModal from '@/components/delivery/CreateOrderModal'
import AssignTrackingModal from '@/components/delivery/AssignTrackingModal'
import WaybillPreview from '@/components/delivery/WaybillPreview'
import CourierSettingsModal from '@/components/delivery/CourierSettingsModal'
import TrackingPoolModal from '@/components/delivery/TrackingPoolModal'
import OrderDetailModal from '@/components/delivery/OrderDetailModal'
import { useModuleAccess, EditOnly, viewOnlyToast } from '@/lib/module-access'

const TABS = ['Orders', 'Tracking Pool', 'Couriers', 'Notifications'] as const
type Tab = typeof TABS[number]

const statusLabels: Record<string, string> = {
  PENDING: 'Pending', PACKED: 'Packed', AWAITING_TRACKING: 'Awaiting Tracking',
  DISPATCHED: 'Dispatched', IN_TRANSIT: 'In Transit', DELIVERED: 'Delivered', CANCELLED: 'Cancelled',
}

export default function DeliveryPage() {
  const { canEdit } = useModuleAccess()
  const [tab, setTab]           = useState<Tab>('Orders')
  const [orders, setOrders]     = useState<DeliveryOrder[]>([])
  const [stats, setStats]       = useState<DeliveryStats | null>(null)
  const [couriers, setCouriers] = useState<Courier[]>([])
  const [tracking, setTracking] = useState<TrackingNumber[]>([])
  const [notifs, setNotifs]     = useState<DeliveryNotification[]>([])
  const [loading, setLoading]   = useState(true)

  const [showCreate,   setShowCreate]   = useState(false)
  const [showTracking, setShowTracking] = useState<DeliveryOrder | null>(null)
  const [showWaybill,  setShowWaybill]  = useState<DeliveryOrder | null>(null)
  const [showCouriers, setShowCouriers] = useState(false)
  const [showPool,     setShowPool]     = useState(false)
  const [showDetail,   setShowDetail]   = useState<DeliveryOrder | null>(null)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await deliveryApi.getOrders({ limit: 200 })
      const d = res?.data ?? res
      setOrders(d?.orders ?? d ?? [])
    } catch { toast.error('Failed to load orders') }
    finally { setLoading(false) }
  }, [])

  const loadStats = useCallback(async () => {
    try { const res: any = await deliveryApi.getStats(); setStats(res?.data ?? res) } catch {}
  }, [])

  const loadCouriers = useCallback(async () => {
    try { const res: any = await deliveryApi.getCouriers(); setCouriers(res?.data ?? res ?? []) } catch {}
  }, [])

  const loadTracking = useCallback(async () => {
    try { const res: any = await deliveryApi.getTracking(); setTracking(res?.data ?? res ?? []) } catch {}
  }, [])

  const loadNotifs = useCallback(async () => {
    try { const res: any = await deliveryApi.getNotifications(); setNotifs(res?.data ?? res ?? []) } catch {}
  }, [])

  useEffect(() => { loadOrders(); loadStats(); loadCouriers() }, [loadOrders, loadStats, loadCouriers])
  useEffect(() => { if (tab === 'Tracking Pool') loadTracking() }, [tab, loadTracking])
  useEffect(() => { if (tab === 'Notifications') loadNotifs() }, [tab, loadNotifs])

  const handleGenerateWaybill = async (order: DeliveryOrder) => {
    if (!canEdit) return viewOnlyToast('Delivery')
    try {
      const res: any = await deliveryApi.generateWaybill(order.id)
      setShowWaybill({ ...order, ...(res?.data ?? res) })
    } catch (e: any) { toast.error(e?.message ?? 'Failed to generate waybill') }
  }

  const handleResendWhatsApp = async (id: string) => {
    if (!canEdit) return viewOnlyToast('Delivery')
    try { await deliveryApi.resendWhatsApp(id); toast.success('WhatsApp notification sent') }
    catch (e: any) { toast.error(e?.message ?? 'Failed') }
  }

  const handleMarkDelivered = async (order: DeliveryOrder) => {
    if (!canEdit) return viewOnlyToast('Delivery')
    if (!confirm(`Mark "${order.orderNumber}" as Delivered?`)) return
    try {
      await deliveryApi.updateOrder(order.id, { status: 'DELIVERED' })
      toast.success(`${order.orderNumber} marked as Delivered`)
      loadOrders()
    } catch (e: any) { toast.error(e?.message ?? 'Failed to update status') }
  }

  const handleRetryNotif = async (id: string) => {
    if (!canEdit) return viewOnlyToast('Delivery')
    try { await deliveryApi.retryNotification(id); toast.success('Retried'); loadNotifs() }
    catch (e: any) { toast.error(e?.message ?? 'Failed') }
  }

  const handleSeedCouriers = async () => {
    if (!canEdit) return viewOnlyToast('Delivery')
    try { await deliveryApi.seedCouriers(); loadCouriers(); toast.success('Default couriers added') }
    catch (e: any) { toast.error(e?.message ?? 'Failed') }
  }

  /* ── Order Columns ───────────────────────────────────────────── */
  const orderColumns = useMemo<ColumnDef<DeliveryOrder>[]>(() => [
    {
      accessorKey: 'orderNumber',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Order #" />,
      cell: ({ row }) => (
        <div>
          <button onClick={() => setShowDetail(row.original)}
            className="text-xs font-mono font-semibold text-violet-400 hover:underline">
            {row.original.orderNumber}
          </button>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{formatDate(row.original.createdAt)}</p>
        </div>
      ),
    },
    {
      accessorKey: 'customerName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center text-[11px] font-bold text-violet-300 flex-shrink-0">
            {row.original.customerName.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{row.original.customerName}</p>
            <p className="text-[10px] flex items-center gap-0.5" style={{ color: 'var(--text-muted)' }}>
              <Phone size={9} />{row.original.customerPhone}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'destination',
      accessorFn: (r) => `${r.city} ${r.district ?? ''}`,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Destination" />,
      cell: ({ row }) => (
        <div>
          <p className="text-xs flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
            <MapPin size={10} className="flex-shrink-0 text-violet-400" />
            {row.original.city}{row.original.district ? `, ${row.original.district}` : ''}
          </p>
          <p className="text-[10px] truncate max-w-[140px]" style={{ color: 'var(--text-muted)' }}>
            {row.original.addressLine1}
          </p>
        </div>
      ),
    },
    {
      id: 'courier',
      accessorFn: (r) => r.trackingNumber ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Courier / Tracking" />,
      cell: ({ row }) => row.original.courier ? (
        <div>
          <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{row.original.courier.name}</p>
          <p className="text-[11px] font-mono text-violet-400">{row.original.trackingNumber ?? '—'}</p>
        </div>
      ) : (
        <span className="text-[11px] px-2 py-0.5 rounded border bg-yellow-500/10 border-yellow-500/20 text-yellow-400">
          Not assigned
        </span>
      ),
    },
    {
      accessorKey: 'totalAmount',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
      cell: ({ row }) => (
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {formatCurrency(row.original.totalAmount)}
          </p>
          {row.original.isCOD && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border bg-orange-500/10 border-orange-500/20 text-orange-400">COD</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => (
        <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${getDeliveryStatusColor(row.original.status)}`}>
          {statusLabels[row.original.status] ?? row.original.status}
        </span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <TableActionsRow
            showAction={{ action: () => setShowDetail(row.original) }}
          />
          {canEdit && <button title="Generate Waybill" onClick={() => handleGenerateWaybill(row.original)}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
            style={{ color: 'var(--text-muted)' }}>
            <Printer size={13} />
          </button>}
          {canEdit && !row.original.trackingNumber && (
            <button title="Assign Tracking" onClick={() => setShowTracking(row.original)}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--brand-light)' }}>
              <Hash size={13} />
            </button>
          )}
          {canEdit && row.original.trackingNumber && (
            <button title="Resend WhatsApp" onClick={() => handleResendWhatsApp(row.original.id)}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: '#4ade80' }}>
              <MessageSquare size={13} />
            </button>
          )}
          {canEdit && ['DISPATCHED', 'IN_TRANSIT', 'PACKED'].includes(row.original.status) && (
            <button title="Mark as Delivered" onClick={() => handleMarkDelivered(row.original)}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: '#34d399' }}>
              <CheckCircle2 size={13} />
            </button>
          )}
        </div>
      ),
    },
  ], [canEdit])

  /* ── Tracking Pool Columns ───────────────────────────────────── */
  const trackingColumns = useMemo<ColumnDef<TrackingNumber>[]>(() => [
    {
      accessorKey: 'number',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Tracking Number" />,
      cell: ({ row }) => <span className="text-xs font-mono text-violet-400">{row.original.number}</span>,
    },
    {
      id: 'courierName',
      accessorFn: (r) => r.courier.name,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Courier" />,
      cell: ({ row }) => <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{row.original.courier.name}</span>,
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => (
        <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${
          row.original.status === 'AVAILABLE' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
          row.original.status === 'ASSIGNED'  ? 'bg-violet-500/20 text-violet-400 border-violet-500/30' :
          'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
          {row.original.status}
        </span>
      ),
    },
    {
      accessorKey: 'assignedAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Assigned At" />,
      cell: ({ row }) => <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {row.original.assignedAt ? formatDate(row.original.assignedAt) : '—'}
      </span>,
    },
  ], [])

  /* ── Notification Columns ────────────────────────────────────── */
  const notifColumns = useMemo<ColumnDef<DeliveryNotification>[]>(() => [
    {
      id: 'order',
      accessorFn: (r) => r.deliveryOrder?.orderNumber ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Order" />,
      cell: ({ row }) => (
        <div>
          <p className="text-xs font-mono text-violet-400">{row.original.deliveryOrder?.orderNumber}</p>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{row.original.deliveryOrder?.customerName}</p>
        </div>
      ),
    },
    {
      accessorKey: 'phone',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Phone" />,
      cell: ({ row }) => <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{row.original.phone}</span>,
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => (
        <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${
          row.original.status === 'SENT'     ? 'bg-green-500/20 text-green-400 border-green-500/30' :
          row.original.status === 'FAILED'   ? 'bg-red-500/20 text-red-400 border-red-500/30' :
          row.original.status === 'RETRYING' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
          'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
          {row.original.status}
        </span>
      ),
    },
    {
      accessorKey: 'sentAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Sent At" />,
      cell: ({ row }) => <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {row.original.sentAt ? formatDate(row.original.sentAt, 'long') : '—'}
      </span>,
    },
    {
      accessorKey: 'retryCount',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Retries" />,
      cell: ({ row }) => <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{row.original.retryCount}</span>,
    },
    {
      id: 'actions',
      cell: ({ row }) => canEdit && row.original.status !== 'SENT' ? (
        <button onClick={() => handleRetryNotif(row.original.id)}
          className="text-xs px-2.5 py-1 rounded-lg font-medium text-white"
          style={{ background: 'var(--brand-gradient)' }}>
          Retry
        </button>
      ) : null,
    },
  ], [canEdit])

  return (
    <div className="space-y-6">
      {/* Modals */}
      {canEdit && showCreate && (
        <CreateOrderModal couriers={couriers} onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadOrders(); loadStats() }} />
      )}
      {canEdit && showTracking && (
        <AssignTrackingModal order={showTracking} couriers={couriers}
          onClose={() => setShowTracking(null)}
          onAssigned={() => { setShowTracking(null); loadOrders(); loadStats() }} />
      )}
      {showWaybill  && <WaybillPreview order={showWaybill} onClose={() => setShowWaybill(null)} />}
      {canEdit && showCouriers && <CourierSettingsModal couriers={couriers} onClose={() => setShowCouriers(false)} onRefresh={loadCouriers} />}
      {canEdit && showPool     && <TrackingPoolModal couriers={couriers} onClose={() => setShowPool(false)} onRefresh={loadTracking} />}
      {showDetail   && (
        <OrderDetailModal order={showDetail} onClose={() => setShowDetail(null)}
          onAssignTracking={(o) => { setShowDetail(null); setShowTracking(o) }}
          onGenerateWaybill={handleGenerateWaybill}
          onResendWhatsApp={handleResendWhatsApp} />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Delivery Orders</h1>
          <p className="page-subtitle">Courier dispatch · Waybills · Tracking · WhatsApp notifications</p>
        </div>
        <EditOnly>
        <div className="flex gap-2 sm:ml-auto">
          <button onClick={() => setShowPool(true)} className="btn-secondary text-sm flex items-center gap-2">
            <Hash size={13} /> Tracking Pool
          </button>
          <button onClick={() => setShowCouriers(true)} className="btn-secondary text-sm flex items-center gap-2">
            <Settings size={13} /> Couriers
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary text-sm flex items-center gap-2">
            <Plus size={14} /> New Order
          </button>
        </div>
        </EditOnly>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {([
            { label: 'Total',           value: stats.total,            icon: Package,      color: 'var(--text-secondary)' },
            { label: 'Pending',         value: stats.pending,          icon: Clock,        color: '#facc15' },
            { label: 'Awaiting Track.', value: stats.awaitingTracking, icon: Hash,         color: '#fb923c' },
            { label: 'Dispatched',      value: stats.dispatched,       icon: Truck,        color: 'var(--brand-light)' },
            { label: 'Delivered',       value: stats.delivered,        icon: CheckCircle2, color: '#4ade80' },
          ] as const).map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-xl p-4 flex items-center gap-3"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                <Icon size={16} style={{ color }} />
              </div>
              <div>
                <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px"
            style={{
              borderBottomColor: tab === t ? 'var(--brand-primary)' : 'transparent',
              color: tab === t ? 'var(--brand-light)' : 'var(--text-muted)',
            }}>{t}</button>
        ))}
      </div>

      {/* Orders Tab */}
      {tab === 'Orders' && (
        !loading && orders.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="No delivery orders yet"
            description="Create delivery orders to dispatch products via courier. Assign tracking numbers, generate waybills, and send WhatsApp notifications automatically."
            accentColor="violet"
            actions={canEdit ? [
              { label: 'Create First Order', onClick: () => setShowCreate(true), primary: true },
              { label: 'Setup Couriers', onClick: () => setShowCouriers(true) },
            ] : []}
            hints={[
              'Add couriers (Koombiyo, Domex, etc.) under the Couriers tab first.',
              'Upload tracking numbers in bulk via Tracking Pool.',
              'WhatsApp notifications are sent automatically when order status changes.',
            ]}
          />
        ) : (
          <ClientSideTable
            data={orders}
            columns={orderColumns}
            isLoading={loading}
            pageCount={Math.ceil((orders.length || 1) / 20)}
            searchableColumns={[
              { id: 'orderNumber',  title: 'Order #'  },
              { id: 'customerName', title: 'Customer' },
              { id: 'courier',      title: 'Tracking' },
            ]}
            filterableColumns={[
              {
                id: 'status',
                title: 'Status',
                options: Object.entries(statusLabels).map(([v, l]) => ({ value: v, label: l })),
              },
            ]}
          />
        )
      )}

      {/* Tracking Pool Tab */}
      {tab === 'Tracking Pool' && (
        <div className="space-y-4">
          <EditOnly><div className="flex justify-end">
            <button onClick={() => setShowPool(true)} className="btn-primary text-sm flex items-center gap-2">
              <Upload size={13} /> Bulk Add
            </button>
          </div></EditOnly>
          <ClientSideTable
            data={tracking}
            columns={trackingColumns}
            isLoading={false}
            pageCount={Math.ceil((tracking.length || 1) / 20)}
            searchableColumns={[{ id: 'number', title: 'Tracking #' }]}
            filterableColumns={[{
              id: 'status', title: 'Status',
              options: [
                { label: 'Available', value: 'AVAILABLE' },
                { label: 'Assigned',  value: 'ASSIGNED'  },
                { label: 'Used',      value: 'USED'      },
              ],
            }]}
          />
        </div>
      )}

      {/* Couriers Tab */}
      {tab === 'Couriers' && (
        <div className="space-y-4">
          <EditOnly><div className="flex justify-end gap-2">
            <button onClick={handleSeedCouriers} className="btn-secondary text-sm flex items-center gap-2">
              <RefreshCw size={13} /> Add Defaults
            </button>
            <button onClick={() => setShowCouriers(true)} className="btn-primary text-sm flex items-center gap-2">
              <Plus size={14} /> Add Courier
            </button>
          </div></EditOnly>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {couriers.length === 0 ? (
              <div className="col-span-3">
                <EmptyState
                  icon={Truck}
                  title="No couriers configured"
                  description="Add courier partners to start dispatching orders. Click 'Add Defaults' to instantly add Koombiyo, Domex, Pronto, and CityPak."
                  accentColor="blue"
                  actions={canEdit ? [
                    { label: 'Add Default Couriers', onClick: handleSeedCouriers, primary: true },
                    { label: 'Add Custom Courier', onClick: () => setShowCouriers(true) },
                  ] : []}
                />
              </div>
            ) : couriers.map(c => (
              <div key={c.id} className="rounded-xl p-4 flex items-start gap-3"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center flex-shrink-0">
                  <Truck size={17} className="text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                    {c.isDefault && <span className="text-[10px] px-1.5 py-0.5 rounded border bg-violet-500/10 border-violet-500/20 text-violet-400">Default</span>}
                    {!c.isActive && <span className="text-[10px] px-1.5 py-0.5 rounded border bg-red-500/10 border-red-500/20 text-red-400">Inactive</span>}
                  </div>
                  <p className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>{c.code}</p>
                  {c.phone && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{c.phone}</p>}
                  <div className="flex gap-3 mt-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
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
          <div className="flex justify-end">
            <button onClick={loadNotifs} className="btn-secondary text-sm flex items-center gap-2">
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
          <ClientSideTable
            data={notifs}
            columns={notifColumns}
            isLoading={false}
            pageCount={Math.ceil((notifs.length || 1) / 20)}
            searchableColumns={[{ id: 'phone', title: 'Phone' }]}
            filterableColumns={[{
              id: 'status', title: 'Status',
              options: [
                { label: 'Sent',     value: 'SENT'     },
                { label: 'Failed',   value: 'FAILED'   },
                { label: 'Retrying', value: 'RETRYING' },
                { label: 'Pending',  value: 'PENDING'  },
              ],
            }]}
          />
        </div>
      )}
    </div>
  )
}
