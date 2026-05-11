'use client'

import { useState } from 'react'
import { Save, Plus, Trash2, Mail, MessageSquare, Shield, Users, Globe, ToggleLeft, ToggleRight, Send } from 'lucide-react'
import type { AdminRole } from '@/types'

const ROLE_BADGE: Record<AdminRole, string> = {
  SUPER_ADMIN: 'badge-red',
  BILLING_ADMIN: 'badge-blue',
  SUPPORT_ADMIN: 'badge-green',
}
const ROLE_LABEL: Record<AdminRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  BILLING_ADMIN: 'Billing Admin',
  SUPPORT_ADMIN: 'Support Admin',
}

function fmtDateTime(s: string) {
  return new Date(s).toLocaleString('en-LK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const TABS = ['Platform', 'Admins', 'Email', 'SMS', 'Security']

export default function SettingsPage() {
  const [tab, setTab] = useState('Platform')
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<AdminRole>('SUPPORT_ADMIN')
  const [testEmailSent, setTestEmailSent] = useState(false)
  const [testSmsSent, setTestSmsSent] = useState(false)

  const [flags, setFlags] = useState({
    whatsappReceipts: true,
    advancedAnalytics: true,
    multiCurrency: false,
    apiAccess: false,
    customDomain: false,
  })

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Platform settings */}
      {tab === 'Platform' && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="section-title">General</h3>
            <div className="space-y-4">
              {[
                { label: 'Platform Name', defaultValue: 'Hexalyte', placeholder: 'Platform name' },
                { label: 'Support Email', defaultValue: 'support@hexalyte.com', placeholder: 'support@...' },
                { label: 'Default Trial Duration (days)', defaultValue: '14', placeholder: '14' },
              ].map(f => (
                <div key={f.label}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
                  <input className="input max-w-sm" defaultValue={f.defaultValue} placeholder={f.placeholder} />
                </div>
              ))}
              <button className="btn-primary text-sm"><Save size={14} />Save Changes</button>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="section-title !mb-0">Maintenance Mode</h3>
                <p className="text-xs text-gray-400 mt-0.5">Blocks all tenant logins with a maintenance message</p>
              </div>
              <button onClick={() => setMaintenanceMode(!maintenanceMode)} className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${maintenanceMode ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                {maintenanceMode ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                {maintenanceMode ? 'ACTIVE' : 'Off'}
              </button>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="section-title">Feature Flags</h3>
            <div className="space-y-3">
              {(Object.entries(flags) as [keyof typeof flags, boolean][]).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-700 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={val} onChange={() => setFlags(f => ({ ...f, [key]: !val }))} className="sr-only peer" />
                    <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gray-900" />
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Admin management */}
      {tab === 'Admins' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowInvite(true)} className="btn-primary text-sm">
              <Plus size={14} />Invite Admin
            </button>
          </div>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="th">Admin</th>
                  <th className="th">Role</th>
                  <th className="th text-center">2FA</th>
                  <th className="th">Last Login</th>
                  <th className="th">Joined</th>
                  <th className="th text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {([] as { id: string; name: string; email: string; role: AdminRole; mfaEnabled: boolean; lastLoginAt: string; createdAt: string }[]).map(a => (
                  <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                    <td className="td">
                      <p className="text-xs font-medium text-gray-800">{a.name}</p>
                      <p className="text-[10px] text-gray-400">{a.email}</p>
                    </td>
                    <td className="td"><span className={ROLE_BADGE[a.role]}>{ROLE_LABEL[a.role]}</span></td>
                    <td className="td text-center">
                      {a.mfaEnabled
                        ? <span className="badge-green text-[10px]">Enabled</span>
                        : <span className="badge-red text-[10px]">Disabled</span>}
                    </td>
                    <td className="td text-xs text-gray-500">{fmtDateTime(a.lastLoginAt)}</td>
                    <td className="td text-xs text-gray-500">{new Date(a.createdAt).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                    <td className="td text-center">
                      <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Email */}
      {tab === 'Email' && (
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Mail size={16} className="text-gray-500" />
              <h3 className="section-title !mb-0">SMTP / SendGrid</h3>
            </div>
            <div className="space-y-3 max-w-md">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">SendGrid API Key</label>
                <input className="input" type="password" defaultValue="SG.xxxxxxxxxxxxxxxxxxx" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">From Email</label>
                <input className="input" defaultValue="noreply@hexalyte.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">From Name</label>
                <input className="input" defaultValue="Hexalyte Platform" />
              </div>
              <div className="flex gap-2">
                <button className="btn-primary text-sm"><Save size={14} />Save</button>
                <button onClick={() => { setTestEmailSent(true); setTimeout(() => setTestEmailSent(false), 3000) }}
                  className="btn-secondary text-sm">
                  <Send size={14} />{testEmailSent ? '✓ Sent!' : 'Send Test Email'}
                </button>
              </div>
            </div>
          </div>
          <div className="card p-5">
            <h3 className="section-title">Email Templates</h3>
            <div className="space-y-2">
              {['Welcome Email', 'Invoice', 'Payment Reminder', 'Trial Expiry Warning', 'Suspension Notice'].map(tpl => (
                <div key={tpl} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-700">{tpl}</span>
                  <button className="text-xs text-blue-600 hover:underline">Edit Template</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SMS */}
      {tab === 'SMS' && (
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare size={16} className="text-gray-500" />
              <h3 className="section-title !mb-0">SMS Gateway</h3>
            </div>
            <div className="space-y-3 max-w-md">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Provider</label>
                <select className="input text-sm">
                  <option>Twilio</option>
                  <option>Dialog Axiata</option>
                  <option>Mobitel (Sri Lanka)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Account SID / API Key</label>
                <input className="input" type="password" placeholder="API Key..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Sender Number / ID</label>
                <input className="input" placeholder="+94xxxxxxxxx or HEXALYTE" />
              </div>
              <div className="flex gap-2">
                <button className="btn-primary text-sm"><Save size={14} />Save</button>
                <button onClick={() => { setTestSmsSent(true); setTimeout(() => setTestSmsSent(false), 3000) }}
                  className="btn-secondary text-sm">
                  <Send size={14} />{testSmsSent ? '✓ Sent!' : 'Send Test SMS'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security */}
      {tab === 'Security' && (
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={16} className="text-gray-500" />
              <h3 className="section-title !mb-0">Admin Security</h3>
            </div>
            <div className="space-y-4 max-w-md">
              {[
                { label: 'Admin Session Timeout', defaultValue: '120', unit: 'minutes' },
                { label: 'Max Login Attempts', defaultValue: '5', unit: 'attempts' },
              ].map(f => (
                <div key={f.label} className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
                    <div className="flex items-center gap-2">
                      <input className="input w-24 text-center" defaultValue={f.defaultValue} />
                      <span className="text-sm text-gray-400">{f.unit}</span>
                    </div>
                  </div>
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">IP Whitelist (one per line)</label>
                <textarea className="input resize-none" rows={4}
                  defaultValue="10.0.0.0/8&#10;203.94.112.0/24&#10;192.168.1.0/24" />
                <p className="text-[10px] text-gray-400 mt-1">Leave empty to allow all IPs (not recommended for production)</p>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-800">Enforce 2FA for All Admins</p>
                  <p className="text-xs text-gray-400">Admins without 2FA will be locked out</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gray-900" />
                </label>
              </div>
              <button className="btn-primary text-sm"><Save size={14} />Save Security Settings</button>
            </div>
          </div>
        </div>
      )}

      {/* Invite admin modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Invite Admin</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input className="input" placeholder="admin@hexalyte.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                <select className="input text-sm" value={inviteRole} onChange={e => setInviteRole(e.target.value as AdminRole)}>
                  <option value="SUPER_ADMIN">Super Admin</option>
                  <option value="BILLING_ADMIN">Billing Admin</option>
                  <option value="SUPPORT_ADMIN">Support Admin</option>
                </select>
              </div>
              <p className="text-xs text-gray-400">An invitation email with 2FA setup instructions will be sent.</p>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => setShowInvite(false)} className="btn-secondary">Cancel</button>
              <button onClick={() => setShowInvite(false)} className="btn-primary text-sm">
                <Send size={13} />Send Invite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
