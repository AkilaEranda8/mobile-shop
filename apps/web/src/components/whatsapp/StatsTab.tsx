'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Send, CheckCircle2, XCircle, TrendingUp, Clock,
  MessageSquare, FileText, Eye, Loader2,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { whatsappApi, type WAStats, type RecentMessage } from '@/lib/whatsapp-api'


const MSG_STATUS: Record<string, { color: string; bg: string; border: string }> = {
  read:      { color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20'   },
  delivered: { color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20'  },
  sent:      { color: 'text-slate-400',  bg: 'bg-slate-500/10',  border: 'border-slate-500/20'  },
  failed:    { color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20'    },
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)    return `${Math.floor(diff)}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="card p-3 text-xs space-y-1.5 shadow-lg" style={{ minWidth: 110 }}>
      <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
          <span style={{ color: 'var(--text-muted)' }}>{p.name}:</span>
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function StatsTab() {
  const [stats,    setStats]    = useState<WAStats | null>(null)
  const [messages, setMessages] = useState<RecentMessage[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [s, m] = await Promise.all([
        whatsappApi.getStats().then((r: any) => r?.data ?? r).catch(() => null),
        whatsappApi.getRecentMessages().then((r: any) => r?.data ?? r).catch(() => null),
      ])
      setStats(s ?? null)
      setMessages(Array.isArray(m) ? m : [])
      setLoading(false)
    }
    load()
  }, [])

  const statCards = stats ? [
    { label: 'Total Sent',      value: stats.totalSent,    icon: Send,         color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { label: 'Delivered',       value: stats.delivered,    icon: CheckCircle2, color: 'text-green-400',  bg: 'bg-green-500/10'  },
    { label: 'Failed',          value: stats.failed,       icon: XCircle,      color: 'text-red-400',    bg: 'bg-red-500/10'    },
    { label: 'Delivery Rate',   value: `${stats.deliveryRate.toFixed(1)}%`, icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Invoices Sent',   value: stats.invoicesSent, icon: FileText,     color: 'text-cyan-400',   bg: 'bg-cyan-500/10'   },
    { label: 'Pending',         value: stats.pending,      icon: Clock,        color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  ] : []

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 size={22} className="animate-spin text-violet-400" />
    </div>
  )

  if (!stats) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <MessageSquare size={36} className="text-slate-600" />
      <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No statistics yet</p>
      <p className="text-xs text-slate-500">Connect WhatsApp and send messages to see stats here</p>
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map(({ label, value, icon: Icon, color, bg }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }} className="card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon size={13} className={color} />
              </div>
            </div>
            <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
            <p className="text-[11px] text-slate-500 leading-tight">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Chart + Recent Messages */}
      <div className="grid lg:grid-cols-5 gap-5">
        {/* Bar Chart */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="lg:col-span-3 card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Monthly Activity</h3>
              <p className="text-xs text-slate-500 mt-0.5">Messages sent vs delivered per month</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats?.monthlyData ?? []} barGap={4} barSize={10}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--brand-glow)' }} />
              <Bar dataKey="sent"      name="Sent"      fill="var(--brand-primary)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="delivered" name="Delivered" fill="#22c55e" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-3 justify-center">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-violet-600" /><span className="text-xs text-slate-500">Sent</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-green-500" /><span className="text-xs text-slate-500">Delivered</span></div>
          </div>
        </motion.div>

        {/* Recent Messages */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="lg:col-span-2 card p-5">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare size={14} className="text-violet-400" />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Recent Messages</h3>
          </div>
          <div className="space-y-2.5">
            {messages.slice(0, 5).map(msg => {
              const sc = MSG_STATUS[msg.status]
              return (
                <div key={msg.id} className="flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-white/3 transition-colors">
                  <div className={`w-7 h-7 rounded-lg ${sc.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    {msg.type === 'invoice' ? <FileText size={12} className={sc.color} /> : msg.type === 'test' ? <Eye size={12} className={sc.color} /> : <MessageSquare size={12} className={sc.color} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{msg.customerName}</span>
                      <span className="text-[10px] text-slate-600 flex-shrink-0">{timeAgo(msg.timestamp)}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{msg.preview}</p>
                    <span className={`badge-status ${sc.bg} border ${sc.border} ${sc.color} text-[9px] mt-1`}>{msg.status}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
