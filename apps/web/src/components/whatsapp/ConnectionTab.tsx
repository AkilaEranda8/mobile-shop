'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Eye, EyeOff, CheckCircle2, WifiOff, AlertTriangle,
  Loader2, Send, Zap, Shield, Key, Phone, Hash,
  RefreshCw, Copy, Check, ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  whatsappApi, saveLocalWAConfig,
  type WAStatus, type WAStatusInfo, type WAConfig,
} from '@/lib/whatsapp-api'

const STATUS_CFG: Record<WAStatus, { label: string; color: string; bg: string; dot: string; Icon: any }> = {
  connected:     { label: 'Connected',     color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20',   dot: 'bg-green-400',  Icon: CheckCircle2   },
  disconnected:  { label: 'Disconnected',  color: 'text-slate-400',  bg: 'bg-slate-500/10 border-slate-500/20',  dot: 'bg-slate-400',  Icon: WifiOff        },
  token_expired: { label: 'Token Expired', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20',dot: 'bg-yellow-400', Icon: AlertTriangle   },
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${value ? 'bg-green-500' : 'bg-white/10'}`}
    >
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

function WAIllustration({ status }: { status: WAStatus }) {
  const isOk = status === 'connected'
  return (
    <div className="card p-5 flex flex-col items-center gap-3 text-center">
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${isOk ? 'bg-green-500/15' : 'bg-white/5'}`}>
        <svg viewBox="0 0 24 24" fill="none" className="w-9 h-9" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.948-1.42A9.956 9.956 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" fill={isOk ? '#22c55e' : '#475569'} opacity={0.15} />
          <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.948-1.42A9.956 9.956 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm4.736 14.092c-.198.557-1.16 1.065-1.59 1.113-.43.049-.44.338-2.774-.578-2.334-.916-3.738-3.211-3.851-3.36-.113-.148-.929-1.233-.929-2.352 0-1.12.587-1.672.795-1.9.208-.228.453-.285.604-.285l.435.008c.14.006.326-.053.51.388.185.44.627 1.52.682 1.63.055.11.09.238.018.384-.072.147-.108.238-.215.368-.107.13-.225.29-.322.39-.107.108-.218.225-.094.442.124.217.552.91 1.186 1.474.815.73 1.502.956 1.72 1.063.218.107.345.09.473-.054.128-.143.548-.638.695-.857.147-.218.294-.182.495-.11.201.072 1.276.602 1.494.71.218.108.363.163.416.254.053.09.053.523-.145 1.08z" fill={isOk ? '#22c55e' : '#475569'} />
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {isOk ? 'WhatsApp Connected' : 'Not Connected'}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          {isOk ? 'Ready to send messages' : 'Enter credentials to connect'}
        </p>
      </div>
      {isOk && (
        <span className="badge-status bg-green-500/10 border border-green-500/20 text-green-400 text-[10px]">
          <CheckCircle2 size={9} /> Active
        </span>
      )}
    </div>
  )
}

interface Props {
  status: WAStatusInfo | null
  config: Partial<WAConfig>
  onStatusChange: (s: WAStatusInfo) => void
  onConfigChange: (c: Partial<WAConfig>) => void
}

export default function ConnectionTab({ status, config, onStatusChange, onConfigChange }: Props) {
  const [form, setForm] = useState({
    accessToken:   config.accessToken   ?? '',
    phoneNumberId: config.phoneNumberId ?? '',
    wabaId:        config.wabaId        ?? '',
    verifyToken:   config.verifyToken   ?? '',
  })
  const [showToken,  setShowToken]  = useState(false)
  const [showVerify, setShowVerify] = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [testing,    setTesting]    = useState(false)
  const [sendingTest,setSendingTest]= useState(false)
  const [testPhone,  setTestPhone]  = useState('')
  const [showTestInput, setShowTestInput] = useState(false)
  const [enabled, setEnabled] = useState(config.enabled ?? false)
  const [copied, setCopied]   = useState(false)

  const currentStatus = status?.status ?? 'disconnected'
  const scfg          = STATUS_CFG[currentStatus]

  const handleSave = async () => {
    if (!form.accessToken || !form.phoneNumberId || !form.wabaId) {
      toast.error('Access Token, Phone Number ID and WABA ID are required')
      return
    }
    setSaving(true)
    try {
      const res: any = await whatsappApi.connect({ ...form, enabled })
      const info: WAStatusInfo = res?.data ?? res
      onStatusChange(info)
      onConfigChange({ ...form, enabled })
      saveLocalWAConfig({ ...form, enabled })
      toast.success('WhatsApp credentials saved!')
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to connect WhatsApp')
    } finally { setSaving(false) }
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const res: any = await whatsappApi.testConnection()
      const r = res?.data ?? res
      r?.success ? toast.success(r.message ?? 'Connection test passed!') : toast.error(r?.message ?? 'Test failed')
    } catch (err: any) { toast.error(err?.message ?? 'Test failed') }
    finally { setTesting(false) }
  }

  const handleSendTest = async () => {
    if (!/^\+?[1-9]\d{6,14}$/.test(testPhone)) { toast.error('Enter a valid phone number (e.g. +94771234567)'); return }
    setSendingTest(true)
    try {
      const res: any = await whatsappApi.sendTestMessage(testPhone)
      const r = res?.data ?? res
      toast.success(r?.message ?? 'Test message sent!')
      setShowTestInput(false); setTestPhone('')
    } catch (err: any) { toast.error(err?.message ?? 'Failed to send test message') }
    finally { setSendingTest(false) }
  }

  const handleToggle = async (val: boolean) => {
    setEnabled(val)
    try {
      await whatsappApi.updateConfig({ enabled: val })
      saveLocalWAConfig({ ...form, enabled: val })
      toast.success(val ? 'Integration enabled' : 'Integration disabled')
    } catch { setEnabled(!val); toast.error('Failed to update') }
  }

  const copyToken = () => {
    if (!form.verifyToken) return
    navigator.clipboard.writeText(form.verifyToken)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
    toast.success('Verify token copied!')
  }

  const fields = [
    { key: 'accessToken',   label: 'Access Token',                    ph: 'EAAxxxxx...',          Icon: Key,    secret: true,  toggle: () => setShowToken(p => !p),   show: showToken  },
    { key: 'phoneNumberId', label: 'Phone Number ID',                  ph: '123456789012345',      Icon: Phone,  secret: false, toggle: undefined,                     show: false      },
    { key: 'wabaId',        label: 'WhatsApp Business Account ID',     ph: '987654321098765',      Icon: Hash,   secret: false, toggle: undefined,                     show: false      },
    { key: 'verifyToken',   label: 'Verify Token',                     ph: 'your_verify_token',    Icon: Shield, secret: true,  toggle: () => setShowVerify(p => !p),  show: showVerify },
  ] as const

  return (
    <div className="space-y-5">
      {/* Status Banner */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className={`card p-4 flex items-center justify-between border ${scfg.bg}`}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={`w-2.5 h-2.5 rounded-full ${scfg.dot}`} />
            {currentStatus === 'connected' && <div className={`absolute inset-0 rounded-full ${scfg.dot} opacity-40 animate-ping`} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <scfg.Icon size={14} className={scfg.color} />
              <span className={`text-sm font-semibold ${scfg.color}`}>{scfg.label}</span>
              {status?.qualityRating && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${status.qualityRating === 'GREEN' ? 'bg-green-500/10 border-green-500/20 text-green-400' : status.qualityRating === 'YELLOW' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                  {status.qualityRating}
                </span>
              )}
            </div>
            {status?.phoneNumber && <p className="text-xs text-slate-500 mt-0.5">{status.displayName} · {status.phoneNumber}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 hidden sm:block">
            {status?.lastChecked ? `Checked ${new Date(status.lastChecked).toLocaleTimeString()}` : 'Not checked'}
          </span>
          <Toggle value={enabled} onChange={handleToggle} />
        </div>
      </motion.div>

      {/* Content Grid */}
      <div className="grid lg:grid-cols-5 gap-5">
        {/* Credentials Form */}
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 }}
          className="lg:col-span-3 card p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>API Credentials</h2>
              <p className="text-xs text-slate-500 mt-0.5">Your WhatsApp Cloud API configuration</p>
            </div>
            <span className="badge-status bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[10px]">
              <Shield size={9} /> Secure
            </span>
          </div>

          <div className="space-y-4">
            {fields.map(({ key, label, ph, Icon, secret, toggle, show }) => (
              <div key={key}>
                <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5">
                  <Icon size={11} /> {label}
                  {(key === 'accessToken' || key === 'phoneNumberId' || key === 'wabaId') && <span className="text-red-400">*</span>}
                </label>
                <div className="relative">
                  <input
                    type={secret && !show ? 'password' : 'text'}
                    className="input-field font-mono text-xs pr-10"
                    placeholder={ph}
                    value={form[key] as string}
                    onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  />
                  {secret && toggle && (
                    <button type="button" onClick={toggle}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                      {show ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  )}
                  {key === 'verifyToken' && (
                    <button type="button" onClick={copyToken}
                      className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                      {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={handleSave} disabled={saving}
              className="btn-primary flex items-center gap-2 disabled:opacity-60">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
              {currentStatus === 'connected' ? 'Update Credentials' : 'Connect WhatsApp'}
            </button>
            <button onClick={handleTest} disabled={testing || currentStatus !== 'connected'}
              className="flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-lg border transition-all disabled:opacity-40"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', background: 'var(--bg-subtle)' }}>
              {testing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Test Connection
            </button>
            <button onClick={() => setShowTestInput(p => !p)} disabled={currentStatus !== 'connected'}
              className="flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-lg border transition-all disabled:opacity-40"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', background: 'var(--bg-subtle)' }}>
              <Send size={13} /> Send Test
            </button>
          </div>

          {/* Test message input */}
          <AnimatePresence>
            {showTestInput && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="flex gap-2 pt-1">
                  <input className="input-field text-sm" placeholder="+94771234567"
                    value={testPhone} onChange={e => setTestPhone(e.target.value)} />
                  <button onClick={handleSendTest} disabled={sendingTest}
                    className="btn-primary flex items-center gap-1.5 whitespace-nowrap disabled:opacity-60">
                    {sendingTest ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Send
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Right side */}
        <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
          className="lg:col-span-2 space-y-4">
          <WAIllustration status={currentStatus} />
          <div className="card p-4 space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Quick Setup Guide</h3>
            {[
              'Go to developers.facebook.com',
              'Create or open your Meta App',
              'Enable WhatsApp Business API product',
              'Copy credentials from the dashboard',
              'Paste them in the form and connect',
            ].map((text, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-violet-500/15 border border-violet-500/25 text-violet-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                <span className="text-xs text-slate-400">{text}</span>
              </div>
            ))}
            <a href="https://developers.facebook.com/docs/whatsapp" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors pt-1">
              View full documentation <ChevronRight size={11} />
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
