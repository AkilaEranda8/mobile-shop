'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Eye, EyeOff, CheckCircle2, WifiOff, AlertTriangle,
  Loader2, Send, Zap, Shield, Key, Phone, Hash,
  RefreshCw, Copy, Check, ChevronRight, QrCode,
} from 'lucide-react'
import QRCode from 'qrcode'
import toast from 'react-hot-toast'
import {
  whatsappApi, saveLocalWAConfig, clearLocalWAData,
  getWhatsAppTenantId,
  type WAStatus, type WAStatusInfo, type WAConfig, type WAConnectionMode,
} from '@/lib/whatsapp-api'
import { Switch } from '@/components/ui/Switch'

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; dot: string; Icon: any }> = {
  connected:     { label: 'Connected',     color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20',   dot: 'bg-green-400',  Icon: CheckCircle2   },
  disconnected:  { label: 'Disconnected',  color: 'text-slate-400',  bg: 'bg-slate-500/10 border-slate-500/20',  dot: 'bg-slate-400',  Icon: WifiOff        },
  token_expired: { label: 'Token Expired', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20',dot: 'bg-yellow-400', Icon: AlertTriangle   },
  qr_pending:    { label: 'Scan QR Code',  color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20',    dot: 'bg-blue-400',   Icon: QrCode         },
  connecting:    { label: 'Connecting…',   color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20',dot: 'bg-violet-400', Icon: Loader2        },
}

interface Props {
  shopName?: string
  status: WAStatusInfo | null
  config: Partial<WAConfig>
  onStatusChange: (s: WAStatusInfo) => void
  onConfigChange: (c: Partial<WAConfig>) => void
}

export default function ConnectionTab({ shopName, status, config, onStatusChange, onConfigChange }: Props) {
  const tenantId = getWhatsAppTenantId()
  const [mode, setMode] = useState<WAConnectionMode>(config.connectionMode ?? 'qr')
  const [qrImage, setQrImage] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrRefreshing, setQrRefreshing] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
  const [enabled,        setEnabled]        = useState(config.enabled ?? false)
  const [copied,         setCopied]          = useState(false)
  const [disconnecting,  setDisconnecting]   = useState(false)

  const currentStatus = status?.status ?? 'disconnected'
  const scfg          = STATUS_CFG[currentStatus] ?? STATUS_CFG.disconnected
  const isQrMode      = mode === 'qr'
  const isConnected   = currentStatus === 'connected'

  const applySession = useCallback((data: WAStatusInfo) => {
    onStatusChange(data)
    if (data.status === 'connected') {
      saveLocalWAConfig({ connectionMode: mode, enabled }, tenantId)
    }
  }, [enabled, mode, onStatusChange, tenantId])

  const renderQr = useCallback(async (qr?: string) => {
    if (!qr) { setQrImage(null); return }
    try {
      const url = await QRCode.toDataURL(qr, { margin: 2, width: 260 })
      setQrImage(url)
    } catch {
      setQrImage(null)
    }
  }, [])

  const pollQrStatus = useCallback(async () => {
    try {
      const res: any = await whatsappApi.getQrSession()
      const data: WAStatusInfo = res?.data ?? res
      if (data.qr) await renderQr(data.qr)
      applySession(data)
      if (data.status === 'connected') {
        if (pollRef.current) clearInterval(pollRef.current)
        pollRef.current = null
      }
    } catch (err: any) {
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = null
      toast.error(err?.message ?? 'QR session error')
    }
  }, [applySession, renderQr])

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(pollQrStatus, 2500)
    pollQrStatus()
  }, [pollQrStatus])

  useEffect(() => {
    if (config.connectionMode) setMode(config.connectionMode)
    if (config.enabled !== undefined) setEnabled(config.enabled)
  }, [config.connectionMode, config.enabled])

  const handleStartQr = useCallback(async () => {
    if (qrLoading || qrRefreshing) return
    setQrLoading(true)
    try {
      await whatsappApi.updateConfig({ connectionMode: 'qr', enabled: true }).catch(() => {})
      setEnabled(true)
      const res: any = await whatsappApi.startQrConnect()
      const data: WAStatusInfo = res?.data ?? res
      onConfigChange({ connectionMode: 'qr', enabled })
      saveLocalWAConfig({ connectionMode: 'qr', enabled }, tenantId)
      if (data.qr) await renderQr(data.qr)
      applySession(data)
      startPolling()
      if (data.qr) toast.success('QR code ready — scan with your phone')
      else if (data.status === 'qr_pending' || data.status === 'connecting') toast.success('Generating QR code…')
      else toast.error('QR not ready yet. Try again or click New QR.')
    } catch (err: any) {
      const msg = err?.message ?? 'Failed to start QR session'
      toast.error(msg.includes('Forbidden') ? 'Only Owner/Manager can connect WhatsApp' : msg)
    } finally { setQrLoading(false) }
  }, [applySession, enabled, onConfigChange, qrLoading, qrRefreshing, renderQr, startPolling, tenantId])

  const selectMode = useCallback((key: WAConnectionMode) => {
    setMode(key)
  }, [])

  useEffect(() => {
    if (!isQrMode) return
    if (currentStatus === 'qr_pending' || currentStatus === 'connecting') startPolling()
    if (status?.qr) renderQr(status.qr)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [isQrMode, currentStatus, status?.qr, startPolling, renderQr])

  const handleRefreshQr = async () => {
    setQrRefreshing(true)
    try {
      await whatsappApi.updateConfig({ connectionMode: 'qr', enabled: true }).catch(() => {})
      setEnabled(true)
      const res: any = await whatsappApi.refreshQrConnect()
      const data: WAStatusInfo = res?.data ?? res
      if (data.qr) await renderQr(data.qr)
      applySession(data)
      startPolling()
      toast.success('New QR code generated')
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to refresh QR')
    } finally { setQrRefreshing(false) }
  }

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
      onConfigChange({ ...form, enabled, connectionMode: 'meta' })
      saveLocalWAConfig({ ...form, enabled, connectionMode: 'meta' }, tenantId)
      setMode('meta')
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

  const normalizePhone = (p: string) => {
    const digits = p.replace(/\D/g, '')
    if (digits.startsWith('0') && digits.length === 10) return '+94' + digits.slice(1)
    if (!p.startsWith('+')) return '+' + digits
    return p.trim()
  }

  const handleSendTest = async () => {
    const normalized = normalizePhone(testPhone)
    if (!/^\+[1-9]\d{6,14}$/.test(normalized)) { toast.error('Enter a valid phone number (e.g. 0771234567 or +94771234567)'); return }
    setSendingTest(true)
    try {
      const res: any = await whatsappApi.sendTestMessage(normalized)
      const r = res?.data ?? res
      toast.success(r?.message ?? 'Test message sent!')
      setShowTestInput(false); setTestPhone('')
    } catch (err: any) { toast.error(err?.message ?? 'Failed to send test message') }
    finally { setSendingTest(false) }
  }

  const handleDisconnect = async () => {
    if (!confirm('Disconnect WhatsApp? You will need to scan the QR code again.')) return
    setDisconnecting(true)
    try {
      await whatsappApi.disconnect().catch(() => {})
      clearLocalWAData(tenantId)
      setForm({ accessToken: '', phoneNumberId: '', wabaId: '', verifyToken: '' })
      setEnabled(false)
      setQrImage(null)
      onStatusChange({ status: 'disconnected', connectionMode: mode })
      onConfigChange({ accessToken: '', phoneNumberId: '', wabaId: '', verifyToken: '', enabled: false, connectionMode: mode })
      toast.success('WhatsApp disconnected')
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to disconnect')
    } finally { setDisconnecting(false) }
  }

  const handleToggle = async (val: boolean) => {
    setEnabled(val)
    try {
      await whatsappApi.updateConfig({ enabled: val })
      saveLocalWAConfig({ ...form, enabled: val, connectionMode: mode }, tenantId)
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
            {isConnected && <div className={`absolute inset-0 rounded-full ${scfg.dot} opacity-40 animate-ping`} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <scfg.Icon size={14} className={`${scfg.color} ${currentStatus === 'connecting' ? 'animate-spin' : ''}`} />
              <span className={`text-sm font-semibold ${scfg.color}`}>{scfg.label}</span>
              {status?.qualityRating && status.qualityRating !== 'UNKNOWN' && (
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
          <Switch checked={enabled} onChange={handleToggle} variant="green" />
        </div>
      </motion.div>

      {/* Mode tabs */}
      <div className="flex gap-2">
        {([
          { key: 'qr' as const, label: 'QR Connect', Icon: QrCode },
          { key: 'meta' as const, label: 'Meta API (Advanced)', Icon: Key },
        ]).map(({ key, label, Icon }) => (
          <button key={key} onClick={() => selectMode(key)}
            disabled={key === 'qr' && qrLoading}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-60 ${
              mode === key ? 'bg-green-600 text-white shadow-lg shadow-green-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {isQrMode ? (
        <div className="grid lg:grid-cols-5 gap-5">
          <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-3 card p-6 space-y-5">
            <div className="border-b border-white/5 pb-3">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>QR Code Connect</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {shopName ? `${shopName} — ` : ''}Scan with your shop phone to connect
              </p>
            </div>

            <div className="flex flex-col items-center gap-4 py-2">
              {isConnected ? (
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 rounded-2xl bg-green-500/15 flex items-center justify-center mx-auto">
                    <CheckCircle2 size={32} className="text-green-400" />
                  </div>
                  <p className="text-sm font-semibold text-green-400">WhatsApp Connected</p>
                  <p className="text-xs text-slate-500">{status?.phoneNumber}</p>
                </div>
              ) : qrImage ? (
                <div className="p-4 rounded-2xl bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrImage} alt="WhatsApp QR Code" width={260} height={260} className="block" />
                </div>
              ) : (
                <div className="w-[260px] h-[260px] rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-3 text-slate-500">
                  {qrLoading ? (
                    <>
                      <Loader2 size={40} className="opacity-50 animate-spin" />
                      <p className="text-xs text-center px-6 text-blue-400">Generating QR code…</p>
                    </>
                  ) : (
                    <>
                      <QrCode size={48} className="opacity-30" />
                      <p className="text-xs text-center px-6">Click QR Connect or Show QR Code, then scan with your phone</p>
                    </>
                  )}
                </div>
              )}

              {(currentStatus === 'qr_pending' || currentStatus === 'connecting') && (
                <p className="text-xs text-blue-400 flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" />
                  {currentStatus === 'connecting' ? 'Connecting on your phone…' : 'Scan the QR code…'}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {!isConnected && (
                <button onClick={handleStartQr} disabled={qrLoading || qrRefreshing}
                  className="btn-primary flex items-center gap-2 disabled:opacity-60">
                  {qrLoading ? <Loader2 size={13} className="animate-spin" /> : <QrCode size={13} />}
                  {qrImage ? 'Reconnect QR' : 'Show QR Code'}
                </button>
              )}
              {!isConnected && qrImage && (
                <button onClick={handleRefreshQr} disabled={qrRefreshing || qrLoading}
                  className="flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-lg border"
                  style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', background: 'var(--bg-subtle)' }}>
                  {qrRefreshing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  New QR
                </button>
              )}
              {isConnected && (
                <>
                  <button onClick={handleDisconnect} disabled={disconnecting}
                    className="flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-lg border"
                    style={{ borderColor: 'rgba(239,68,68,0.4)', color: '#f87171', background: 'rgba(239,68,68,0.08)' }}>
                    {disconnecting ? <Loader2 size={13} className="animate-spin" /> : <WifiOff size={13} />}
                    Disconnect
                  </button>
                  <button onClick={handleTest} disabled={testing}
                    className="flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-lg border"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', background: 'var(--bg-subtle)' }}>
                    {testing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    Test
                  </button>
                  <button onClick={() => setShowTestInput(p => !p)}
                    className="flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-lg border"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', background: 'var(--bg-subtle)' }}>
                    <Send size={13} /> Send Test
                  </button>
                </>
              )}
            </div>

            <AnimatePresence>
              {showTestInput && isConnected && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="flex gap-2 pt-1">
                    <input className="input-field text-sm" placeholder="0771234567 or +94771234567"
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

          <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2 space-y-4">
            <div className="card p-4 space-y-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">How to connect</h3>
              {[
                'Open WhatsApp on your phone',
                'Go to Settings → Linked Devices → Link a Device',
                'Scan the QR code shown here',
                'Once connected, you can send invoices and messages',
              ].map((text, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-green-500/15 border border-green-500/25 text-green-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-xs text-slate-400">{text}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-5 gap-5">
          <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-3 card p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Meta Cloud API</h2>
                <p className="text-xs text-slate-500 mt-0.5">developers.facebook.com credentials</p>
              </div>
              <span className="badge-status bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[10px]">
                <Shield size={9} /> Advanced
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

            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={handleSave} disabled={saving || disconnecting}
                className="btn-primary flex items-center gap-2 disabled:opacity-60">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                {isConnected && mode === 'meta' ? 'Update Credentials' : 'Connect WhatsApp'}
              </button>
              {isConnected && mode === 'meta' && config.connectionMode === 'meta' && (
                <button onClick={handleDisconnect} disabled={disconnecting || saving}
                  className="flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-lg border"
                  style={{ borderColor: 'rgba(239,68,68,0.4)', color: '#f87171', background: 'rgba(239,68,68,0.08)' }}>
                  {disconnecting ? <Loader2 size={13} className="animate-spin" /> : <WifiOff size={13} />}
                  Disconnect
                </button>
              )}
              <button onClick={handleTest} disabled={testing || !isConnected || config.connectionMode !== 'meta'}
                className="flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-lg border disabled:opacity-40"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', background: 'var(--bg-subtle)' }}>
                {testing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                Test Connection
              </button>
              <button onClick={() => setShowTestInput(p => !p)} disabled={!isConnected || config.connectionMode !== 'meta'}
                className="flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-lg border disabled:opacity-40"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', background: 'var(--bg-subtle)' }}>
                <Send size={13} /> Send Test
              </button>
            </div>

            <AnimatePresence>
              {showTestInput && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="flex gap-2 pt-1">
                    <input className="input-field text-sm" placeholder="0771234567 or +94771234567"
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

          <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2 card p-4 space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Meta API Setup</h3>
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
          </motion.div>
        </div>
      )}
    </div>
  )
}
