'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wifi, WifiOff, AlertTriangle, Settings2, RefreshCw,
  BarChart2, History, FileText, Loader2, MessageSquare, Store,
} from 'lucide-react'
import {
  whatsappApi, getLocalWAConfig, getLocalWAStatus, saveLocalWAStatus, clearLocalWAData,
  getWhatsAppTenantId,
  type WAStatusInfo, type WAConfig,
} from '@/lib/whatsapp-api'
import { authStorage } from '@/lib/auth'
import { tenantApi } from '@/lib/api'
import ConnectionTab     from '@/components/whatsapp/ConnectionTab'
import InvoiceTab        from '@/components/whatsapp/InvoiceTab'
import StatsTab          from '@/components/whatsapp/StatsTab'
import HistoryTab        from '@/components/whatsapp/HistoryTab'

type Tab = 'connection' | 'invoice' | 'statistics' | 'history'

const TABS: { key: Tab; label: string; Icon: any }[] = [
  { key: 'connection',  label: 'Connection',        Icon: Settings2  },
  { key: 'invoice',     label: 'Invoice Automation', Icon: FileText   },
  { key: 'statistics',  label: 'Statistics',         Icon: BarChart2  },
  { key: 'history',     label: 'Send History',       Icon: History    },
]

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string; border: string; Icon: any }> = {
  connected:     { label: 'Connected',     color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20',  Icon: Wifi          },
  disconnected:  { label: 'Disconnected',  color: 'text-slate-400',  bg: 'bg-slate-500/10',  border: 'border-slate-500/20',  Icon: WifiOff       },
  token_expired: { label: 'Token Expired', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', Icon: AlertTriangle  },
  qr_pending:    { label: 'Scan QR',       color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   Icon: MessageSquare },
  connecting:    { label: 'Connecting',    color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', Icon: Loader2       },
}

export default function WhatsAppPage() {
  const tenantId = getWhatsAppTenantId()
  const [activeTab,   setActiveTab]   = useState<Tab>('connection')
  const [status,      setStatus]      = useState<WAStatusInfo | null>(null)
  const [config,      setConfig]      = useState<Partial<WAConfig>>({})
  const [shopName,    setShopName]    = useState<string>('')
  const [initialLoad, setInitialLoad] = useState(true)

  const silentMetaReconnect = useCallback(async (
    tid: string,
    savedConfig: Partial<WAConfig>,
  ): Promise<WAStatusInfo | null> => {
    if (savedConfig.connectionMode === 'qr') return null
    if (!savedConfig.accessToken || !savedConfig.phoneNumberId || !savedConfig.wabaId) return null
    try {
      const r: any = await whatsappApi.connect(savedConfig)
      const info: WAStatusInfo = r?.data ?? r
      if (info?.status === 'connected') {
        saveLocalWAStatus(info, tid)
        return info
      }
    } catch {}
    return null
  }, [])

  const loadTenantWhatsApp = useCallback(async () => {
    const tid = authStorage.getUser()?.tenantId
    if (!tid) {
      setStatus(null)
      setConfig({})
      setInitialLoad(false)
      return
    }

    setInitialLoad(true)
    const localStatus = getLocalWAStatus(tid)
    const localConfig = getLocalWAConfig(tid)

    const [s, c, tenantRes] = await Promise.all([
      whatsappApi.getStatus().then((r: any) => r?.data ?? r).catch(() => null),
      whatsappApi.getConfig().then((r: any) => r?.data ?? r).catch(() => null),
      tenantApi.get(tid).catch(() => null),
    ])

    const tenant = (tenantRes as any)?.data ?? tenantRes
    setShopName(tenant?.name ?? tenant?.businessName ?? 'Your shop')

    let resolved: WAStatusInfo | null = s ?? localStatus
    if (
      resolved?.status !== 'connected' &&
      localConfig.connectionMode !== 'qr' &&
      localStatus?.status === 'connected' &&
      localConfig?.accessToken
    ) {
      const reconnected = await silentMetaReconnect(tid, localConfig)
      if (reconnected) resolved = reconnected
    }

    setStatus(resolved)
    setConfig(c ?? localConfig ?? {})
    if (resolved?.status === 'connected') saveLocalWAStatus(resolved, tid)
    setInitialLoad(false)
  }, [silentMetaReconnect])

  useEffect(() => {
    loadTenantWhatsApp()
  }, [loadTenantWhatsApp, tenantId])

  useEffect(() => {
    const poll = async () => {
      const tid = authStorage.getUser()?.tenantId
      if (!tid) return
      const localConfig = getLocalWAConfig(tid)
      const s: any = await whatsappApi.getStatus().then((r: any) => r?.data ?? r).catch(() => null)
      if (!s) return
      if (s.status === 'connected') {
        setStatus(s)
        saveLocalWAStatus(s, tid)
      } else if (localConfig.connectionMode !== 'qr' && localConfig?.accessToken) {
        const reconnected = await silentMetaReconnect(tid, localConfig)
        setStatus(reconnected ?? s)
      } else {
        setStatus(s)
      }
    }
    const id = setInterval(poll, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [silentMetaReconnect])

  const handleStatusChange = (s: WAStatusInfo) => {
    const tid = authStorage.getUser()?.tenantId
    setStatus(s)
    if (!tid) return
    if (s.status === 'connected') saveLocalWAStatus(s, tid)
    else clearLocalWAData(tid)
  }

  const currentStatus = status?.status ?? 'disconnected'
  const badge         = STATUS_BADGE[currentStatus] ?? STATUS_BADGE.disconnected

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/15 border border-green-500/20 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.948-1.42A9.956 9.956 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" fill="#22c55e" opacity={0.2} />
              <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.948-1.42A9.956 9.956 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm4.736 14.092c-.198.557-1.16 1.065-1.59 1.113-.43.049-.44.338-2.774-.578-2.334-.916-3.738-3.211-3.851-3.36-.113-.148-.929-1.233-.929-2.352 0-1.12.587-1.672.795-1.9.208-.228.453-.285.604-.285l.435.008c.14.006.326-.053.51.388.185.44.627 1.52.682 1.63.055.11.09.238.018.384-.072.147-.108.238-.215.368-.107.13-.225.29-.322.39-.107.108-.218.225-.094.442.124.217.552.91 1.186 1.474.815.73 1.502.956 1.72 1.063.218.107.345.09.473-.054.128-.143.548-.638.695-.857.147-.218.294-.182.495-.11.201.072 1.276.602 1.494.71.218.108.363.163.416.254.053.09.053.523-.145 1.08z" fill="#22c55e" />
            </svg>
          </div>
          <div>
            <h1 className="page-title">WhatsApp Integration</h1>
            <p className="page-subtitle">සෑම shop එකකටම වෙනම WhatsApp number එකක් connect කරන්න</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {initialLoad ? (
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <Loader2 size={12} className="animate-spin" /> Checking status…
            </span>
          ) : (
            <span className={`badge-status ${badge.bg} border ${badge.border} ${badge.color}`}>
              <badge.Icon size={11} className={currentStatus === 'connecting' ? 'animate-spin' : ''} />
              {badge.label}
              {status?.phoneNumber && (
                <span className="ml-1 opacity-70">· {status.phoneNumber}</span>
              )}
            </span>
          )}
          {shopName && (
            <span className="text-xs px-2 py-1 rounded-lg border text-slate-300 bg-white/5 border-white/10 font-medium flex items-center gap-1">
              <Store size={10} /> {shopName}
            </span>
          )}
          <span className="text-xs px-2 py-1 rounded-lg border text-violet-400 bg-violet-500/10 border-violet-500/20 font-medium">
            Per-tenant
          </span>
        </div>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-xl bg-violet-500/5 border border-violet-500/15">
        <Store size={15} className="text-violet-400 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-slate-400">
          <strong className="text-slate-300 font-medium">{shopName || 'මෙම shop'}</strong> සඳහා වෙනම WhatsApp connect වෙනවා.
          වෙන shop එකකට login වුණාම ඒ shop එකේ WhatsApp settings පෙන්වයි — tenants අතර mix වෙන්නේ නැහැ.
        </p>
      </div>

      <AnimatePresence>
        {!initialLoad && currentStatus === 'disconnected' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/5 border border-blue-500/15 overflow-hidden">
            <MessageSquare size={15} className="text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-slate-400">
              {shopName ? `${shopName} ` : ''}සඳහා QR scan කරන්න හෝ Meta API credentials දාන්න.
              <button onClick={() => setActiveTab('connection')} className="text-blue-400 hover:underline ml-1">Connection tab</button> එකට යන්න.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {TABS.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
              activeTab === key
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={`${tenantId ?? 'none'}-${activeTab}`}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}>
          {activeTab === 'connection' && (
            <ConnectionTab
              shopName={shopName}
              status={status}
              config={config}
              onStatusChange={handleStatusChange}
              onConfigChange={c => setConfig(prev => ({ ...prev, ...c }))}
            />
          )}
          {activeTab === 'invoice' && (
            <InvoiceTab
              config={config}
              onConfigChange={c => setConfig(prev => ({ ...prev, ...c }))}
            />
          )}
          {activeTab === 'statistics' && <StatsTab />}
          {activeTab === 'history'    && <HistoryTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
