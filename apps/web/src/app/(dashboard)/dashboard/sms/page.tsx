'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wifi, WifiOff, AlertTriangle, Settings2, BarChart2, History,
  FileText, Loader2, MessageSquare, Store,
} from 'lucide-react'
import {
  smsApi,
  DEFAULT_SMS_CONFIG,
  type SmsConfig,
  type SmsStatusInfo,
} from '@/lib/sms-api'
import { authStorage } from '@/lib/auth'
import { tenantApi } from '@/lib/api'
import ConnectionTab from '@/components/sms/ConnectionTab'
import TemplatesTab from '@/components/sms/TemplatesTab'
import StatsTab from '@/components/sms/StatsTab'
import HistoryTab from '@/components/sms/HistoryTab'
import { useModuleAccess } from '@/lib/module-access'

type Tab = 'connection' | 'templates' | 'statistics' | 'history'

const TABS: { key: Tab; label: string; labelSi: string; Icon: typeof Settings2 }[] = [
  { key: 'connection', label: 'Connection', labelSi: 'Connection', Icon: Settings2 },
  { key: 'templates', label: 'Templates', labelSi: 'Messages', Icon: FileText },
  { key: 'statistics', label: 'Statistics', labelSi: 'Stats', Icon: BarChart2 },
  { key: 'history', label: 'Send History', labelSi: 'History', Icon: History },
]

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string; border: string; Icon: typeof Wifi }> = {
  connected:      { label: 'Connected',      color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20',  Icon: Wifi },
  disabled:         { label: 'Disabled',       color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', Icon: AlertTriangle },
  not_configured:   { label: 'Not configured', color: 'text-slate-400',  bg: 'bg-slate-500/10',  border: 'border-slate-500/20',  Icon: WifiOff },
}

export default function SmsPage() {
  const { canEdit } = useModuleAccess()
  const tenantId = authStorage.getUser()?.tenantId
  const [activeTab, setActiveTab] = useState<Tab>('connection')
  const [status, setStatus] = useState<SmsStatusInfo | null>(null)
  const [config, setConfig] = useState<SmsConfig>(DEFAULT_SMS_CONFIG)
  const [shopName, setShopName] = useState('')
  const [initialLoad, setInitialLoad] = useState(true)

  const loadSmsHub = useCallback(async () => {
    const tid = authStorage.getUser()?.tenantId
    if (!tid) {
      setStatus(null)
      setConfig(DEFAULT_SMS_CONFIG)
      setInitialLoad(false)
      return
    }

    setInitialLoad(true)
    const [s, c, tenantRes] = await Promise.all([
      smsApi.getStatus().then((r: any) => r?.data ?? r).catch(() => null),
      smsApi.getConfig().then((r: any) => r?.data ?? r).catch(() => null),
      tenantApi.get(tid).catch(() => null),
    ])

    const tenant = (tenantRes as any)?.data ?? tenantRes
    setShopName(tenant?.name ?? tenant?.businessName ?? 'Your shop')
    setStatus(s ?? null)
    setConfig(c ? { ...DEFAULT_SMS_CONFIG, ...c, templates: { ...DEFAULT_SMS_CONFIG.templates, ...c.templates } } : DEFAULT_SMS_CONFIG)
    setInitialLoad(false)
  }, [])

  useEffect(() => {
    loadSmsHub()
  }, [loadSmsHub, tenantId])

  const currentStatus = status?.status ?? 'not_configured'
  const badge = STATUS_BADGE[currentStatus] ?? STATUS_BADGE.not_configured

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/20 flex items-center justify-center">
            <MessageSquare size={20} className="text-brand-400" />
          </div>
          <div>
            <h1 className="page-title">SMS Gateway</h1>
            <p className="page-subtitle">
              Dialog / Mobitel / Hutch SMS — auto messages for sales, repairs & HP reminders
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {initialLoad ? (
            <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-500">
              <Loader2 size={12} className="animate-spin" /> Checking status…
            </span>
          ) : (
            <span className={`badge-status ${badge.bg} border ${badge.border} ${badge.color}`}>
              <badge.Icon size={11} />
              {badge.label}
            </span>
          )}
          {shopName && (
            <span className="text-xs px-2 py-1 rounded-lg border text-gray-700 dark:text-slate-300 bg-white/5 border-white/10 font-medium flex items-center gap-1">
              <Store size={10} /> {shopName}
            </span>
          )}
        </div>
      </div>

      <AnimatePresence>
        {!initialLoad && currentStatus === 'not_configured' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/5 border border-blue-500/15 overflow-hidden">
            <MessageSquare size={15} className="text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-slate-400">
              Configure your SMS provider in the <button onClick={() => setActiveTab('connection')}
                className="text-brand-400 hover:underline font-medium">Connection</button> tab — enter API keys, enable gateway, then send a test SMS.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {TABS.map(({ key, label, labelSi, Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
              activeTab === key
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/20'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/5'
            }`}>
            <Icon size={14} />
            {label}
            <span className="text-[10px] opacity-60 hidden sm:inline">/ {labelSi}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={`${tenantId ?? 'none'}-${activeTab}`}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}>
          {activeTab === 'connection' && (
            <ConnectionTab
              canEdit={canEdit}
              status={status}
              config={config}
              onStatusChange={setStatus}
              onConfigChange={setConfig}
            />
          )}
          {activeTab === 'templates' && (
            <TemplatesTab config={config} canEdit={canEdit} onConfigChange={setConfig} />
          )}
          {activeTab === 'statistics' && <StatsTab />}
          {activeTab === 'history' && <HistoryTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
