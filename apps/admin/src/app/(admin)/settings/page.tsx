'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Save, Plus, Trash2, Mail, MessageSquare, Shield,
  ToggleLeft, ToggleRight, Send, Loader2, CheckCircle, Eye, EyeOff,
} from 'lucide-react'

import {
  fetchPlatformConfig, savePlatformConfig,
  fetchAdminUsers, createAdminUser, deleteAdminUser,
  type PlatformConfigMap, type AdminUserRow,
} from '@/lib/api'
import { Switch } from '@/components/ui/Switch'

const TABS = ['Platform', 'Admins', 'Email', 'SMS', 'Security']

function SaveFeedback({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <span className="flex items-center gap-1 text-xs text-emerald-600">
      <CheckCircle size={12} />Saved
    </span>
  )
}

/* ── Platform tab ──────────────────────────────────────────────────────────── */
function PlatformTab({ cfg, onChange, onSave, saving }: {
  cfg: PlatformConfigMap; onChange: (k: string, v: string) => void
  onSave: (keys: string[]) => Promise<void>; saving: boolean
}) {
  const [saved, setSaved] = useState(false)
  const [mainSaved, setMainSaved] = useState(false)
  const handleSave = async (keys: string[], setSavedFn: (v: boolean) => void) => {
    await onSave(keys); setSavedFn(true); setTimeout(() => setSavedFn(false), 2000)
  }

  const features: [string, string][] = [
    ['feature.whatsappReceipts',  'WhatsApp Receipts'],
    ['feature.advancedAnalytics', 'Advanced Analytics'],
    ['feature.multiCurrency',     'Multi-Currency'],
    ['feature.apiAccess',         'API Access'],
    ['feature.customDomain',      'Custom Domain'],
  ]

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h3 className="section-title">General</h3>
        <div className="space-y-3 max-w-md">
          {[
            { key: 'platform.name',         label: 'Platform Name',              placeholder: 'Hexalyte' },
            { key: 'platform.supportEmail',  label: 'Support Email',              placeholder: 'support@hexalyte.com' },
            { key: 'platform.trialDays',     label: 'Default Trial Duration (days)', placeholder: '14' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
              <input className="input" value={cfg[f.key] ?? ''} placeholder={f.placeholder}
                onChange={e => onChange(f.key, e.target.value)} />
            </div>
          ))}
          <div className="flex items-center gap-3">
            <button disabled={saving} onClick={() => handleSave(['platform.name','platform.supportEmail','platform.trialDays'], setSaved)}
              className="btn-primary text-sm disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}Save
            </button>
            <SaveFeedback show={saved} />
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="section-title !mb-0">Maintenance Mode</h3>
            <p className="text-xs text-gray-400 mt-0.5">Blocks tenant logins and shows a banner to all logged-in users</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                const next = cfg['maintenance.enabled'] === 'true' ? 'false' : 'true'
                onChange('maintenance.enabled', next)
                await onSave(['maintenance.enabled', 'maintenance.message'])
                setMainSaved(true); setTimeout(() => setMainSaved(false), 2000)
              }}
              className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${cfg['maintenance.enabled'] === 'true' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              {cfg['maintenance.enabled'] === 'true' ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
              {cfg['maintenance.enabled'] === 'true' ? 'ACTIVE' : 'Off'}
            </button>
            <SaveFeedback show={mainSaved} />
          </div>
        </div>
        <div className="mt-4 max-w-xl">
          <label className="block text-xs font-medium text-gray-700 mb-1">User notification message</label>
          <textarea
            className="input resize-none text-sm"
            rows={3}
            value={cfg['maintenance.message'] ?? ''}
            placeholder="Hexalyte is currently in maintenance mode..."
            onChange={e => onChange('maintenance.message', e.target.value)}
          />
          <p className="text-[10px] text-gray-400 mt-1">Shown on login page, dashboard banner, and bell notifications when maintenance is ON.</p>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="section-title !mb-0">Feature Flags</h3>
        </div>
        <div className="space-y-1">
          {features.map(([key, label]) => (
            <div key={key} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
              <span className="text-sm text-gray-700">{label}</span>
              <Switch checked={cfg[key] === 'true'} onChange={async (next) => {
                onChange(key, next ? 'true' : 'false')
                await onSave([key])
              }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Admins tab ─────────────────────────────────────────────────────────────── */
function AdminsTab() {
  const [admins, setAdmins]     = useState<AdminUserRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [showAdd, setShowAdd]   = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [saving, setSaving]     = useState(false)
  const [showPw, setShowPw]     = useState(false)
  const [form, setForm]         = useState({ name: '', email: '', password: '' })

  const reload = useCallback(() => {
    setLoading(true)
    fetchAdminUsers().then(setAdmins).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => { reload() }, [reload])

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) return
    setSaving(true)
    try {
      const a = await createAdminUser(form)
      setAdmins(prev => [...prev, { ...a, isActive: true, lastLoginAt: null }])
      setShowAdd(false)
      setForm({ name: '', email: '', password: '' })
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed') } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deactivate this admin?')) return
    setDeleting(id)
    try { await deleteAdminUser(id); setAdmins(prev => prev.filter(a => a.id !== id)) }
    catch { /* ignore */ } finally { setDeleting(null) }
  }

  const fmtDate = (s: string | null) => s
    ? new Date(s).toLocaleString('en-LK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—'

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowAdd(true)} className="btn-primary text-sm"><Plus size={14} />Add Admin</button>
      </div>

      {loading ? (
        <div className="card p-10 text-center"><Loader2 size={20} className="animate-spin text-gray-400 mx-auto" /></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead><tr className="bg-gray-50">
              <th className="th">Admin</th>
              <th className="th">Status</th>
              <th className="th">Last Login</th>
              <th className="th">Joined</th>
              <th className="th text-center">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {admins.length === 0 && (
                <tr><td colSpan={5} className="td text-center text-sm text-gray-400 py-8">No admin users found</td></tr>
              )}
              {admins.map(a => (
                <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                  <td className="td">
                    <p className="text-xs font-semibold text-gray-800">{a.name}</p>
                    <p className="text-[10px] text-gray-400">{a.email}</p>
                  </td>
                  <td className="td">
                    {a.isActive
                      ? <span className="badge-green text-[10px]">Active</span>
                      : <span className="badge-red text-[10px]">Inactive</span>}
                  </td>
                  <td className="td text-xs text-gray-500">{fmtDate(a.lastLoginAt)}</td>
                  <td className="td text-xs text-gray-500">
                    {new Date(a.createdAt).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </td>
                  <td className="td text-center">
                    <button onClick={() => handleDelete(a.id)} disabled={deleting === a.id}
                      className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      {deleting === a.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Add Admin User</h3>
            <div className="space-y-3">
              {(['name', 'email'] as const).map(field => (
                <div key={field}>
                  <label className="block text-xs font-medium text-gray-700 mb-1 capitalize">{field}</label>
                  <input className="input" value={form[field]} placeholder={field === 'email' ? 'admin@hexalyte.com' : 'Full Name'}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Temporary Password</label>
                <div className="relative">
                  <input className="input pr-10" type={showPw ? 'text' : 'password'} value={form.password}
                    placeholder="Min 8 characters" onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleCreate} disabled={saving || !form.name || !form.email || !form.password}
                className="btn-primary text-sm disabled:opacity-50">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Email tab ──────────────────────────────────────────────────────────────── */
function EmailTab({ cfg, onChange, onSave, saving }: {
  cfg: PlatformConfigMap; onChange: (k: string, v: string) => void
  onSave: (keys: string[]) => Promise<void>; saving: boolean
}) {
  const [saved, setSaved] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const KEYS = ['email.apiKey', 'email.fromEmail', 'email.fromName']

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Mail size={16} className="text-gray-500" />
          <h3 className="section-title !mb-0">SendGrid / SMTP</h3>
        </div>
        <div className="space-y-3 max-w-md">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">API Key</label>
            <div className="relative">
              <input className="input pr-10" type={showKey ? 'text' : 'password'}
                value={cfg['email.apiKey'] ?? ''} placeholder="SG.xxxxxxxxxxxx"
                onChange={e => onChange('email.apiKey', e.target.value)} />
              <button type="button" onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">From Email</label>
            <input className="input" value={cfg['email.fromEmail'] ?? ''} placeholder="noreply@hexalyte.com"
              onChange={e => onChange('email.fromEmail', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">From Name</label>
            <input className="input" value={cfg['email.fromName'] ?? ''} placeholder="Hexalyte Platform"
              onChange={e => onChange('email.fromName', e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <button disabled={saving} onClick={async () => { await onSave(KEYS); setSaved(true); setTimeout(() => setSaved(false), 2000) }}
              className="btn-primary text-sm disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}Save
            </button>
            <button className="btn-secondary text-sm"><Send size={13} />Test Email</button>
            <SaveFeedback show={saved} />
          </div>
        </div>
      </div>
      <div className="card p-5">
        <h3 className="section-title">Email Templates</h3>
        <div className="space-y-1">
          {['Welcome Email', 'Invoice', 'Payment Reminder', 'Trial Expiry Warning', 'Suspension Notice'].map(tpl => (
            <div key={tpl} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
              <span className="text-sm text-gray-700">{tpl}</span>
              <button className="text-xs text-blue-600 hover:underline">Edit Template</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── SMS tab ────────────────────────────────────────────────────────────────── */
function SMSTab({ cfg, onChange, onSave, saving }: {
  cfg: PlatformConfigMap; onChange: (k: string, v: string) => void
  onSave: (keys: string[]) => Promise<void>; saving: boolean
}) {
  const [saved, setSaved] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const KEYS = ['sms.provider', 'sms.apiKey', 'sms.senderId']

  return (
    <div className="card p-5 max-w-lg">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare size={16} className="text-gray-500" />
        <h3 className="section-title !mb-0">SMS Gateway</h3>
      </div>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Provider</label>
          <select className="input text-sm" value={cfg['sms.provider'] ?? 'Twilio'}
            onChange={e => onChange('sms.provider', e.target.value)}>
            <option>Twilio</option>
            <option>Dialog Axiata</option>
            <option>Mobitel (Sri Lanka)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Account SID / API Key</label>
          <div className="relative">
            <input className="input pr-10" type={showKey ? 'text' : 'password'}
              value={cfg['sms.apiKey'] ?? ''} placeholder="API Key…"
              onChange={e => onChange('sms.apiKey', e.target.value)} />
            <button type="button" onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Sender Number / ID</label>
          <input className="input" value={cfg['sms.senderId'] ?? ''} placeholder="+94xxxxxxxxx or HEXALYTE"
            onChange={e => onChange('sms.senderId', e.target.value)} />
        </div>
        <div className="flex items-center gap-3">
          <button disabled={saving} onClick={async () => { await onSave(KEYS); setSaved(true); setTimeout(() => setSaved(false), 2000) }}
            className="btn-primary text-sm disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}Save
          </button>
          <button className="btn-secondary text-sm"><Send size={13} />Test SMS</button>
          <SaveFeedback show={saved} />
        </div>
      </div>
    </div>
  )
}

/* ── Security tab ───────────────────────────────────────────────────────────── */
function SecurityTab({ cfg, onChange, onSave, saving }: {
  cfg: PlatformConfigMap; onChange: (k: string, v: string) => void
  onSave: (keys: string[]) => Promise<void>; saving: boolean
}) {
  const [saved, setSaved] = useState(false)
  const KEYS = ['security.sessionTimeoutMin', 'security.maxLoginAttempts', 'security.ipWhitelist', 'security.enforce2FA']

  return (
    <div className="card p-5 max-w-lg">
      <div className="flex items-center gap-2 mb-4">
        <Shield size={16} className="text-gray-500" />
        <h3 className="section-title !mb-0">Admin Security</h3>
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Session Timeout</label>
            <div className="flex items-center gap-2">
              <input className="input w-20 text-center" value={cfg['security.sessionTimeoutMin'] ?? '120'}
                onChange={e => onChange('security.sessionTimeoutMin', e.target.value)} />
              <span className="text-xs text-gray-400">minutes</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Max Login Attempts</label>
            <div className="flex items-center gap-2">
              <input className="input w-20 text-center" value={cfg['security.maxLoginAttempts'] ?? '5'}
                onChange={e => onChange('security.maxLoginAttempts', e.target.value)} />
              <span className="text-xs text-gray-400">attempts</span>
            </div>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">IP Whitelist (one per line)</label>
          <textarea className="input resize-none font-mono text-xs" rows={4}
            value={cfg['security.ipWhitelist'] ?? ''}
            placeholder="10.0.0.0/8&#10;192.168.1.0/24&#10;Leave empty to allow all"
            onChange={e => onChange('security.ipWhitelist', e.target.value)} />
          <p className="text-[10px] text-gray-400 mt-1">Leave empty to allow all IPs</p>
        </div>
        <div className="flex items-center justify-between py-2 border-t border-gray-100">
          <div>
            <p className="text-sm font-medium text-gray-800">Enforce 2FA for All Admins</p>
            <p className="text-xs text-gray-400">Admins without 2FA will be locked out</p>
          </div>
          <Switch checked={cfg['security.enforce2FA'] === 'true'}
            onChange={next => onChange('security.enforce2FA', next ? 'true' : 'false')} />
        </div>
        <div className="flex items-center gap-3">
          <button disabled={saving} onClick={async () => { await onSave(KEYS); setSaved(true); setTimeout(() => setSaved(false), 2000) }}
            className="btn-primary text-sm disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}Save
          </button>
          <SaveFeedback show={saved} />
        </div>
      </div>
    </div>
  )
}

/* ── Page ──────────────────────────────────────────────────────────────────── */
export default function SettingsPage() {
  const [tab, setTab]     = useState('Platform')
  const [cfg, setCfg]     = useState<PlatformConfigMap>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    fetchPlatformConfig().then(setCfg).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const handleChange = (key: string, value: string) => {
    setCfg(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async (keys: string[]) => {
    setSaving(true)
    try {
      const patch: PlatformConfigMap = {}
      keys.forEach(k => { patch[k] = cfg[k] ?? '' })
      await savePlatformConfig(patch)
    } catch (e) { alert(e instanceof Error ? e.message : 'Save failed') } finally { setSaving(false) }
  }

  return (
    <div className="space-y-5">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Platform configuration, admin users, integrations and security</p>
      </div>

      <div className="flex border-b border-gray-200 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-12 text-center"><Loader2 size={22} className="animate-spin text-gray-400 mx-auto" /></div>
      ) : (
        <>
          {tab === 'Platform' && <PlatformTab cfg={cfg} onChange={handleChange} onSave={handleSave} saving={saving} />}
          {tab === 'Admins'   && <AdminsTab />}
          {tab === 'Email'    && <EmailTab cfg={cfg} onChange={handleChange} onSave={handleSave} saving={saving} />}
          {tab === 'SMS'      && <SMSTab cfg={cfg} onChange={handleChange} onSave={handleSave} saving={saving} />}
          {tab === 'Security' && <SecurityTab cfg={cfg} onChange={handleChange} onSave={handleSave} saving={saving} />}
        </>
      )}
    </div>
  )
}
