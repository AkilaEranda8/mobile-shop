'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  CheckCircle2, WifiOff, AlertTriangle, Loader2, RefreshCw, QrCode, Key,
  Phone, Hash, Shield, Eye, EyeOff, Send, FileText, CheckSquare,
} from 'lucide-react'
import QRCode from 'qrcode'
import { Switch } from '@/components/ui/Switch'
import {
  type AdminWhatsappApi,
  type WAStatusInfo, type WAConfig, type WAConnectionMode,
} from '@/lib/api'

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; dot: string; Icon: typeof CheckCircle2 }> = {
  connected:     { label: 'Connected',     color: 'text-green-700',  bg: 'bg-green-50 border-green-200',   dot: 'bg-green-500',  Icon: CheckCircle2 },
  disconnected:  { label: 'Disconnected',  color: 'text-gray-600',   bg: 'bg-gray-50 border-gray-200',    dot: 'bg-gray-400',   Icon: WifiOff },
  token_expired: { label: 'Token Expired', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200',dot: 'bg-yellow-500', Icon: AlertTriangle },
  qr_pending:    { label: 'Scan QR Code',  color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',     dot: 'bg-blue-500',   Icon: QrCode },
  connecting:    { label: 'Connecting…',   color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200', dot: 'bg-violet-500', Icon: Loader2 },
}

interface Props {
  api: AdminWhatsappApi
  shopName?: string
}

/** Platform billing WhatsApp only — shop tenants manage WhatsApp in their own dashboard. */
export default function TenantWhatsAppPanel({ api, shopName = 'Hexalyte Billing' }: Props) {
  const [status, setStatus] = useState<WAStatusInfo | null>(null)
  const [config, setConfig] = useState<Partial<WAConfig>>({})
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [mode, setMode] = useState<WAConnectionMode>('qr')
  const [qrImage, setQrImage] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrRefreshing, setQrRefreshing] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [form, setForm] = useState({ accessToken: '', phoneNumberId: '', wabaId: '', verifyToken: '' })
  const [showToken, setShowToken] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [sendPdfInvoice, setSendPdfInvoice] = useState(false)
  const [savingInvoice, setSavingInvoice] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [sendingTest, setSendingTest] = useState(false)

  const currentStatus = status?.status ?? 'disconnected'
  const scfg = STATUS_CFG[currentStatus] ?? STATUS_CFG.disconnected
  const isQrMode = mode === 'qr'
  const isConnected = currentStatus === 'connected'

  const flash = (type: 'ok' | 'err', text: string) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 3500)
  }

  const renderQr = useCallback(async (qr?: string) => {
    if (!qr) { setQrImage(null); return }
    try {
      setQrImage(await QRCode.toDataURL(qr, { margin: 2, width: 260 }))
    } catch {
      setQrImage(null)
    }
  }, [])

  const applySession = useCallback((data: WAStatusInfo) => {
    setStatus(data)
  }, [])

  const pollQrStatus = useCallback(async () => {
    try {
      const data = await api.getQrSession()
      if (data.qr) await renderQr(data.qr)
      applySession(data)
      if (data.status === 'connected') {
        if (pollRef.current) clearInterval(pollRef.current)
        pollRef.current = null
        flash('ok', 'WhatsApp connected successfully')
      }
    } catch (e) {
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = null
      flash('err', e instanceof Error ? e.message : 'QR session error')
    }
  }, [api, applySession, renderQr])

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(pollQrStatus, 2500)
    pollQrStatus()
  }, [pollQrStatus])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [st, cfg] = await Promise.all([api.getStatus(), api.getConfig()])
      setStatus(st)
      setConfig(cfg ?? {})
      setMode(cfg?.connectionMode ?? 'qr')
      setEnabled(cfg?.enabled ?? false)
      setSendPdfInvoice(cfg?.sendPdfInvoice ?? false)
      setForm({
        accessToken: cfg?.accessToken ?? '',
        phoneNumberId: cfg?.phoneNumberId ?? '',
        wabaId: cfg?.wabaId ?? '',
        verifyToken: cfg?.verifyToken ?? '',
      })
      if (st.qr) await renderQr(st.qr)
    } catch (e) {
      flash('err', e instanceof Error ? e.message : 'Failed to load WhatsApp status')
    } finally {
      setLoading(false)
    }
  }, [api, renderQr])

  useEffect(() => {
    load()
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [load])

  const handleStartQr = useCallback(async () => {
    if (qrLoading || qrRefreshing) return
    setQrLoading(true)
    try {
      const data = await api.startQrConnect()
      await api.updateConfig({ connectionMode: 'qr', enabled: true }).catch(() => {})
      setMode('qr')
      setEnabled(true)
      if (data.qr) await renderQr(data.qr)
      applySession(data)
      startPolling()
      flash('ok', data.qr ? 'QR ready — scan with Hexalyte business phone' : 'Generating QR code…')
    } catch (e) {
      flash('err', e instanceof Error ? e.message : 'Failed to start QR session')
    } finally {
      setQrLoading(false)
    }
  }, [api, applySession, qrLoading, qrRefreshing, renderQr, startPolling])

  useEffect(() => {
    if (!isQrMode || loading) return
    if (currentStatus === 'qr_pending' || currentStatus === 'connecting') startPolling()
    if (status?.qr) renderQr(status.qr)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [isQrMode, currentStatus, status?.qr, startPolling, renderQr, loading])

  async function handleRefreshQr() {
    setQrRefreshing(true)
    try {
      const data = await api.refreshQrConnect()
      if (data.qr) await renderQr(data.qr)
      applySession(data)
      startPolling()
      flash('ok', 'New QR code generated')
    } catch (e) {
      flash('err', e instanceof Error ? e.message : 'Failed to refresh QR')
    } finally {
      setQrRefreshing(false)
    }
  }

  async function handleSaveMeta() {
    if (!form.accessToken || !form.phoneNumberId || !form.wabaId) {
      flash('err', 'Access Token, Phone Number ID and WABA ID are required')
      return
    }
    setSaving(true)
    try {
      const info = await api.connect({ ...form, enabled: true })
      setStatus(info)
      setMode('meta')
      setEnabled(true)
      flash('ok', 'WhatsApp credentials saved')
    } catch (e) {
      flash('err', e instanceof Error ? e.message : 'Failed to connect')
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    try {
      const r = await api.testConnection()
      flash(r.success ? 'ok' : 'err', r.message ?? (r.success ? 'Connection OK' : 'Test failed'))
    } catch (e) {
      flash('err', e instanceof Error ? e.message : 'Test failed')
    } finally {
      setTesting(false)
    }
  }

  function normalizePhone(p: string) {
    const digits = p.replace(/\D/g, '')
    if (digits.startsWith('0') && digits.length === 10) return '+94' + digits.slice(1)
    if (!p.startsWith('+')) return '+' + digits
    return p.trim()
  }

  async function handleSendTest() {
    const normalized = normalizePhone(testPhone)
    if (!/^\+[1-9]\d{6,14}$/.test(normalized)) {
      flash('err', 'Enter a valid phone (e.g. 0771234567)')
      return
    }
    setSendingTest(true)
    try {
      const r = await api.sendTestMessage(normalized)
      flash('ok', r.message ?? 'Test message sent')
      setTestPhone('')
    } catch (e) {
      flash('err', e instanceof Error ? e.message : 'Failed to send test message')
    } finally {
      setSendingTest(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect Hexalyte billing WhatsApp? You will need to scan the QR code again.')) return
    setDisconnecting(true)
    try {
      await api.disconnect()
      setQrImage(null)
      setStatus({ status: 'disconnected', connectionMode: mode })
      setEnabled(false)
      flash('ok', 'WhatsApp disconnected')
    } catch (e) {
      flash('err', e instanceof Error ? e.message : 'Failed to disconnect')
    } finally {
      setDisconnecting(false)
    }
  }

  async function handleToggle(val: boolean) {
    setEnabled(val)
    try {
      await api.updateConfig({ enabled: val })
      flash('ok', val ? 'Integration enabled' : 'Integration disabled')
    } catch {
      setEnabled(!val)
      flash('err', 'Failed to update')
    }
  }

  async function handlePdfToggle(val: boolean) {
    const prev = sendPdfInvoice
    setSendPdfInvoice(val)
    setSavingInvoice(true)
    try {
      const updated = await api.updateConfig({ sendPdfInvoice: val })
      setSendPdfInvoice(updated.sendPdfInvoice ?? false)
      flash('ok', 'Invoice settings saved')
    } catch {
      setSendPdfInvoice(prev)
      flash('err', 'Failed to save invoice settings')
    } finally {
      setSavingInvoice(false)
    }
  }

  if (loading) {
    return (
      <div className="card p-8 flex items-center justify-center gap-2 text-sm text-gray-500">
        <Loader2 size={16} className="animate-spin" /> Loading WhatsApp…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 border-blue-200 bg-blue-50 text-sm text-blue-900">
        <strong>Platform billing WhatsApp.</strong> Connect Hexalyte&apos;s business number here for subscription invoices.
        Shop tenants manage their own WhatsApp in the shop app — <strong>Settings → WhatsApp</strong>.
      </div>

      {msg && (
        <div className={`text-sm px-4 py-2.5 rounded-lg border ${
          msg.type === 'ok' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {msg.text}
        </div>
      )}

      <div className={`card p-4 flex flex-wrap items-center justify-between gap-3 border ${scfg.bg}`}>
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${scfg.dot}`} />
          <div>
            <div className="flex items-center gap-2">
              <scfg.Icon size={14} className={`${scfg.color} ${currentStatus === 'connecting' ? 'animate-spin' : ''}`} />
              <span className={`text-sm font-semibold ${scfg.color}`}>{scfg.label}</span>
            </div>
            {status?.phoneNumber && (
              <p className="text-xs text-gray-500 mt-0.5">
                {status.displayName ?? shopName} · {status.phoneNumber}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            {status?.lastChecked
              ? `Checked ${new Date(status.lastChecked).toLocaleTimeString()}`
              : 'Not checked'}
          </span>
          <Switch checked={enabled} onChange={handleToggle} />
        </div>
      </div>

      <div className="flex gap-2">
        {([
          { key: 'qr' as const, label: 'QR Connect', Icon: QrCode },
          { key: 'meta' as const, label: 'Meta API', Icon: Key },
        ]).map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            disabled={key === 'qr' && qrLoading}
            onClick={() => setMode(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 ${
              mode === key
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {isQrMode ? (
        <div className="card p-6">
          <h3 className="section-title">Scan with Hexalyte business WhatsApp</h3>
          <p className="text-xs text-gray-500 mb-4">
            Open WhatsApp on the business phone → Linked devices → Link a device → scan this QR.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-[280px] h-[280px] flex items-center justify-center bg-gray-50 border border-gray-200 rounded-xl">
              {qrImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrImage} alt="WhatsApp QR" className="w-[260px] h-[260px]" />
              ) : (
                <div className="text-center text-gray-400 text-sm px-4">
                  {qrLoading ? (
                    <span className="flex items-center gap-2 justify-center"><Loader2 size={16} className="animate-spin" /> Generating…</span>
                  ) : (
                    'No QR yet'
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={qrLoading || isConnected}
                onClick={handleStartQr}
                className="btn-primary text-sm"
              >
                {qrLoading ? 'Starting…' : 'Generate QR'}
              </button>
              <button
                type="button"
                disabled={qrRefreshing || isConnected}
                onClick={handleRefreshQr}
                className="btn-secondary text-sm flex items-center justify-center gap-2"
              >
                <RefreshCw size={14} className={qrRefreshing ? 'animate-spin' : ''} />
                New QR
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-5 space-y-3">
          <h3 className="section-title">Meta Cloud API credentials</h3>
          {([
            { key: 'accessToken' as const, label: 'Access Token', Icon: Key, secret: true },
            { key: 'phoneNumberId' as const, label: 'Phone Number ID', Icon: Phone, secret: false },
            { key: 'wabaId' as const, label: 'WABA ID', Icon: Hash, secret: false },
            { key: 'verifyToken' as const, label: 'Verify Token', Icon: Shield, secret: true },
          ]).map(({ key, label, Icon, secret }) => (
            <div key={key}>
              <label className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                <Icon size={12} /> {label}
              </label>
              <div className="relative">
                <input
                  type={secret && !showToken ? 'password' : 'text'}
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="input w-full text-sm font-mono pr-10"
                  placeholder={key === 'accessToken' ? 'EAAxxxxx…' : ''}
                />
                {secret && key === 'accessToken' && (
                  <button
                    type="button"
                    onClick={() => setShowToken(s => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                )}
              </div>
            </div>
          ))}
          <button
            type="button"
            disabled={saving}
            onClick={handleSaveMeta}
            className="btn-primary text-sm"
          >
            {saving ? 'Saving…' : 'Save & Connect'}
          </button>
        </div>
      )}

      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="section-title !mb-0">Subscription invoices</h3>
            <p className="text-xs text-gray-500 mt-0.5">Control PDF attachments for subscription billing messages.</p>
          </div>
          {savingInvoice && (
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" /> Saving…
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3 bg-white rounded-xl border border-gray-100">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <FileText size={14} className="text-gray-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900">Attach PDF to subscription invoices</p>
              <p className="text-xs text-gray-500 mt-0.5">Send subscription billing invoices as PDF documents (not text only)</p>
            </div>
          </div>
          <Switch
            checked={sendPdfInvoice}
            onChange={handlePdfToggle}
            disabled={savingInvoice}
          />
        </div>
        <p className="text-[10px] text-gray-400 flex items-start gap-1.5">
          <CheckSquare size={12} className="mt-0.5 flex-shrink-0" />
          Shop POS and repair invoices are configured only in the shop app.
        </p>
      </div>

      {isConnected && (
        <div className="card p-5 space-y-3">
          <h3 className="section-title">Test & manage</h3>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleTest} disabled={testing} className="btn-secondary text-sm">
              {testing ? 'Testing…' : 'Test connection'}
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-sm px-4 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
            >
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </div>
          <div className="flex gap-2 max-w-md">
            <input
              type="tel"
              value={testPhone}
              onChange={e => setTestPhone(e.target.value)}
              placeholder="0771234567"
              className="input flex-1 text-sm"
            />
            <button
              type="button"
              onClick={handleSendTest}
              disabled={sendingTest || !testPhone.trim()}
              className="btn-primary text-sm flex items-center gap-1"
            >
              <Send size={14} />
              {sendingTest ? '…' : 'Send test'}
            </button>
          </div>
        </div>
      )}

      {config.connectionMode && (
        <p className="text-[10px] text-gray-400">
          Mode: {config.connectionMode}
        </p>
      )}
    </div>
  )
}
