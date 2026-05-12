'use client'

import { useState, useEffect } from 'react'
import {
  Save, Building2, User, Bell, Shield, Palette, CreditCard, Users,
  Loader2, Eye, EyeOff, Trash2, Plus, X, CheckCircle, Check, FileText,
} from 'lucide-react'
import { authApi, usersApi, tenantApi } from '@/lib/api'
import { authStorage } from '@/lib/auth'
import { INVOICE_SETTINGS_KEY, type InvoiceSettings, getInvoiceSettings } from '@/lib/invoiceSettings'
import toast from 'react-hot-toast'

const tabs = [
  { key: 'shop',          label: 'Shop Info',       icon: Building2  },
  { key: 'invoice',       label: 'Invoice',         icon: FileText   },
  { key: 'profile',       label: 'Profile',         icon: User       },
  { key: 'notifications', label: 'Notifications',   icon: Bell       },
  { key: 'security',      label: 'Security',        icon: Shield     },
  { key: 'appearance',    label: 'Appearance',      icon: Palette    },
  { key: 'billing',       label: 'Billing',         icon: CreditCard },
  { key: 'team',          label: 'Team',            icon: Users      },
]


const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
  <button onClick={() => onChange(!value)}
    className={`relative w-10 h-5 rounded-full transition-colors ${value ? 'bg-violet-600' : 'bg-white/10'}`}>
    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
  </button>
)

const NOTIF_KEY = 'hx_notif_prefs'
const APPEARANCE_KEY = 'hx_appearance'

const planColors: Record<string, string> = {
  TRIAL:      'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
  STARTER:    'bg-blue-500/10   border-blue-500/20   text-blue-400',
  PRO:        'bg-violet-500/10 border-violet-500/20 text-violet-400',
  ENTERPRISE: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('shop')
  const currentUser = authStorage.getUser()

  /* ── Shop Info ── */
  const [tenant, setTenant]       = useState<any>(null)
  const [shopForm, setShopForm]   = useState({ name: '', ownerName: '', ownerEmail: '' })
  const [shopSaving, setShopSaving] = useState(false)

  useEffect(() => {
    if (!currentUser?.tenantId) return
    tenantApi.get(currentUser.tenantId).then((r: any) => {
      const t = r?.data ?? r
      setTenant(t)
      setShopForm({ name: t.name ?? '', ownerName: t.ownerName ?? '', ownerEmail: t.ownerEmail ?? '' })
    }).catch(() => {})
  }, [currentUser?.tenantId])

  const saveShop = async () => {
    if (!tenant) return
    setShopSaving(true)
    try {
      await tenantApi.update(tenant.id, shopForm)
      toast.success('Shop info saved')
    } catch { toast.error('Save failed') }
    finally { setShopSaving(false) }
  }

  /* ── Profile ── */
  const [profile, setProfile]       = useState({ name: currentUser?.name ?? '', email: currentUser?.email ?? '' })
  const [profileSaving, setProfileSaving] = useState(false)

  const saveProfile = async () => {
    if (!currentUser?.id) return
    setProfileSaving(true)
    try {
      const res: any = await usersApi.update(currentUser.id, { name: profile.name, email: profile.email })
      const updated = res?.data ?? res
      authStorage.save(
        authStorage.getAccessToken()!,
        authStorage.getRefreshToken()!,
        { ...currentUser, name: updated.name, email: updated.email },
      )
      toast.success('Profile updated')
    } catch { toast.error('Update failed') }
    finally { setProfileSaving(false) }
  }

  /* ── Notifications ── */
  const defaultNotif = { lowStock: true, newRepair: true, repairReady: true, dailySummary: false, paymentReceived: true, warrantyExpiry: true }
  const [notif, setNotif] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return defaultNotif
    try { return { ...defaultNotif, ...JSON.parse(localStorage.getItem(NOTIF_KEY) ?? '{}') } } catch { return defaultNotif }
  })
  const saveNotif = () => {
    localStorage.setItem(NOTIF_KEY, JSON.stringify(notif))
    toast.success('Notification preferences saved')
  }

  /* ── Security ── */
  const [pwForm, setPwForm]     = useState({ current: '', next: '', confirm: '' })
  const [showPw, setShowPw]     = useState(false)
  const [pwSaving, setPwSaving] = useState(false)

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pwForm.next !== pwForm.confirm) { toast.error('Passwords do not match'); return }
    if (pwForm.next.length < 6) { toast.error('Password must be at least 6 characters'); return }
    setPwSaving(true)
    try {
      await authApi.changePassword(pwForm.current, pwForm.next)
      toast.success('Password changed')
      setPwForm({ current: '', next: '', confirm: '' })
    } catch (err: any) { toast.error(err?.message ?? 'Failed') }
    finally { setPwSaving(false) }
  }

  /* ── Appearance ── */
  const defaultAppearance = { accent: 'violet', compactMode: false, animations: true }
  const [appearance, setAppearance] = useState<Record<string, any>>(() => {
    if (typeof window === 'undefined') return defaultAppearance
    try { return { ...defaultAppearance, ...JSON.parse(localStorage.getItem(APPEARANCE_KEY) ?? '{}') } } catch { return defaultAppearance }
  })
  const saveAppearance = () => {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance))
    toast.success('Appearance preferences saved')
  }

  /* ── Team ── */
  const [teamUsers, setTeamUsers] = useState<any[]>([])
  const [teamLoading, setTeamLoading] = useState(false)
  const [showAddUser, setShowAddUser] = useState(false)
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'CASHIER' })
  const [addingUser, setAddingUser] = useState(false)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)

  useEffect(() => {
    if (activeTab !== 'team') return
    setTeamLoading(true)
    usersApi.list().then((r: any) => setTeamUsers(r?.data?.data ?? r?.data ?? [])).catch(() => {}).finally(() => setTeamLoading(false))
  }, [activeTab])

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault(); setAddingUser(true)
    try {
      const res: any = await usersApi.create(newUser)
      setTeamUsers(p => [...p, res?.data ?? res])
      toast.success('User added')
      setNewUser({ name: '', email: '', password: '', role: 'CASHIER' })
      setShowAddUser(false)
    } catch (err: any) { toast.error(err?.message ?? 'Failed') }
    finally { setAddingUser(false) }
  }

  const removeUser = async (id: string) => {
    if (!confirm('Remove this team member?')) return
    setDeletingUserId(id)
    try {
      await usersApi.remove(id)
      setTeamUsers(p => p.filter(u => u.id !== id))
      toast.success('User removed')
    } catch { toast.error('Failed') }
    finally { setDeletingUserId(null) }
  }

  /* ── Invoice Settings ── */
  const [invoiceForm, setInvoiceForm] = useState<InvoiceSettings>(() => getInvoiceSettings())
  const saveInvoice = () => {
    localStorage.setItem(INVOICE_SETTINGS_KEY, JSON.stringify(invoiceForm))
    toast.success('Invoice settings saved')
  }

  const ROLES = ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']
  const roleColors: Record<string, string> = {
    OWNER:      'bg-violet-500/10 border-violet-500/20 text-violet-400',
    MANAGER:    'bg-blue-500/10   border-blue-500/20   text-blue-400',
    CASHIER:    'bg-green-500/10  border-green-500/20  text-green-400',
    TECHNICIAN: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your shop configuration</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="lg:w-52 flex-shrink-0">
          <nav className="card p-2 space-y-0.5">
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${activeTab === tab.key ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                <tab.icon size={15} />{tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">

          {/* ── SHOP INFO ── */}
          {activeTab === 'shop' && (
            <div className="card p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h2 className="text-base font-semibold text-white">Shop Information</h2>
                <button onClick={saveShop} disabled={shopSaving} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-60">
                  {shopSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}Save
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Shop / Business Name</label>
                  <input className="input-field" value={shopForm.name} onChange={e => setShopForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Owner Name</label>
                  <input className="input-field" value={shopForm.ownerName} onChange={e => setShopForm(p => ({ ...p, ownerName: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-400 mb-1.5">Owner Email</label>
                  <input type="email" className="input-field" value={shopForm.ownerEmail} onChange={e => setShopForm(p => ({ ...p, ownerEmail: e.target.value }))} />
                </div>
              </div>
              {tenant && (
                <div className="pt-3 border-t border-white/5">
                  <p className="text-xs text-slate-500 mb-2">Read-only information</p>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {[
                      { label: 'Tenant ID',  value: tenant.id?.slice(0, 12) + '…' },
                      { label: 'Slug',       value: tenant.slug },
                      { label: 'Plan',       value: tenant.plan },
                      { label: 'Status',     value: tenant.status },
                      { label: 'Created',    value: new Date(tenant.createdAt).toLocaleDateString() },
                      { label: 'Branches',   value: tenant.branches?.length ?? '—' },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-white/3 rounded-xl p-3 border border-white/5">
                        <p className="text-[10px] text-slate-600 uppercase tracking-wide">{label}</p>
                        <p className="text-xs text-slate-300 font-medium mt-0.5 truncate">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── INVOICE ── */}
          {activeTab === 'invoice' && (
            <div className="card p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div>
                  <h2 className="text-base font-semibold text-white">Invoice Settings</h2>
                  <p className="text-xs text-slate-500 mt-0.5">These details appear on every downloaded invoice PDF</p>
                </div>
                <button onClick={saveInvoice} className="btn-primary text-sm flex items-center gap-2">
                  <Save size={13} />Save
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { k: 'shopName',   label: 'Shop / Business Name', ph: 'e.g. Akila Mobile Shop',        col: '' },
                  { k: 'slogan',     label: 'Slogan / Tagline',      ph: 'e.g. Your Trusted Mobile Store', col: '' },
                  { k: 'phone',      label: 'Contact Phone',          ph: '+94 77 123 4567',                col: '' },
                  { k: 'email',      label: 'Contact Email',          ph: 'shop@example.com',               col: '' },
                  { k: 'website',    label: 'Website',                ph: 'www.example.com',                col: '' },
                  { k: 'address',    label: 'Address',                ph: '123 Main St, Colombo',           col: '' },
                ].map(({ k, label, ph }) => (
                  <div key={k}>
                    <label className="block text-xs text-slate-400 mb-1.5">{label}</label>
                    <input className="input-field" placeholder={ph}
                      value={(invoiceForm as any)[k]}
                      onChange={e => setInvoiceForm(p => ({ ...p, [k]: e.target.value }))} />
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-400 mb-1.5">Footer Note</label>
                  <input className="input-field" placeholder="e.g. Thank you for your business!"
                    value={invoiceForm.footerNote}
                    onChange={e => setInvoiceForm(p => ({ ...p, footerNote: e.target.value }))} />
                </div>
              </div>
              <div className="pt-3 border-t border-white/5 text-xs text-slate-500 space-y-1">
                <p className="font-semibold text-slate-400">Preview</p>
                <p>These values will appear in the <span className="text-violet-400">Invoice To / From</span>, <span className="text-violet-400">Contact Info</span>, and <span className="text-violet-400">Footer</span> sections of all invoices.</p>
              </div>
            </div>
          )}

          {/* ── PROFILE ── */}
          {activeTab === 'profile' && (
            <div className="card p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h2 className="text-base font-semibold text-white">Profile</h2>
                <button onClick={saveProfile} disabled={profileSaving} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-60">
                  {profileSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}Save
                </button>
              </div>
              <div className="flex items-center gap-4 pb-4 border-b border-white/5">
                <div className="w-16 h-16 rounded-full bg-violet-500/20 flex items-center justify-center text-2xl font-bold text-violet-300">
                  {profile.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{profile.name}</p>
                  <p className="text-xs text-slate-400">{profile.email}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border mt-1 inline-block ${roleColors[currentUser?.role ?? ''] ?? 'bg-slate-500/10 border-slate-500/20 text-slate-400'}`}>
                    {currentUser?.role}
                  </span>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Full Name</label>
                  <input className="input-field" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Email</label>
                  <input type="email" className="input-field" value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} />
                </div>
              </div>
            </div>
          )}

          {/* ── NOTIFICATIONS ── */}
          {activeTab === 'notifications' && (
            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h2 className="text-base font-semibold text-white">Notification Preferences</h2>
                <button onClick={saveNotif} className="btn-primary text-sm flex items-center gap-2">
                  <Save size={13} />Save
                </button>
              </div>
              {[
                { key: 'lowStock',        label: 'Low Stock Alerts',          desc: 'Get notified when products fall below minimum stock' },
                { key: 'newRepair',       label: 'New Repair Intake',         desc: 'Alert when a new repair ticket is created' },
                { key: 'repairReady',     label: 'Repair Ready for Pickup',   desc: 'Notify when a repair is completed and ready' },
                { key: 'dailySummary',    label: 'Daily Summary Report',      desc: 'Receive end-of-day sales and repair summary' },
                { key: 'paymentReceived', label: 'Payment Received',          desc: 'Confirmation when a payment is processed' },
                { key: 'warrantyExpiry',  label: 'Warranty Expiry Reminders', desc: 'Alert 30 days before warranty expires' },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between py-3 border-b border-white/3 last:border-0">
                  <div>
                    <p className="text-sm text-slate-200">{item.label}</p>
                    <p className="text-xs text-slate-500">{item.desc}</p>
                  </div>
                  <Toggle value={notif[item.key] ?? false} onChange={v => setNotif(p => ({ ...p, [item.key]: v }))} />
                </div>
              ))}
            </div>
          )}

          {/* ── SECURITY ── */}
          {activeTab === 'security' && (
            <div className="card p-6 space-y-6">
              <h2 className="text-base font-semibold text-white border-b border-white/5 pb-3">Security Settings</h2>
              <form onSubmit={changePassword} className="space-y-4 max-w-sm">
                {[
                  { key: 'current', label: 'Current Password',     ph: 'Enter current password'  },
                  { key: 'next',    label: 'New Password',          ph: 'Min. 6 characters'       },
                  { key: 'confirm', label: 'Confirm New Password',  ph: 'Repeat new password'     },
                ].map(({ key, label, ph }) => (
                  <div key={key}>
                    <label className="block text-xs text-slate-400 mb-1.5">{label}</label>
                    <div className="relative">
                      <input type={showPw ? 'text' : 'password'} required placeholder={ph}
                        className="input-field pr-9"
                        value={(pwForm as any)[key]}
                        onChange={e => setPwForm(p => ({ ...p, [key]: e.target.value }))} />
                      <button type="button" onClick={() => setShowPw(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                        {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </div>
                ))}
                <button type="submit" disabled={pwSaving} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-60">
                  {pwSaving ? <Loader2 size={13} className="animate-spin" /> : <Shield size={13} />}Update Password
                </button>
              </form>
              <div className="pt-4 border-t border-white/5 max-w-sm">
                <h3 className="text-sm font-semibold text-slate-200 mb-1">Logged-in Account</h3>
                <p className="text-xs text-slate-500">{currentUser?.email}</p>
                <p className="text-xs text-slate-600 mt-0.5">Role: {currentUser?.role}</p>
              </div>
            </div>
          )}

          {/* ── APPEARANCE ── */}
          {activeTab === 'appearance' && (
            <div className="card p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h2 className="text-base font-semibold text-white">Appearance</h2>
                <button onClick={saveAppearance} className="btn-primary text-sm flex items-center gap-2">
                  <Save size={13} />Save
                </button>
              </div>
              <div className="space-y-5">
                <div>
                  <label className="block text-xs text-slate-400 mb-3">Accent Color</label>
                  <div className="flex gap-3 flex-wrap">
                    {[
                      { key: 'violet', color: 'bg-violet-500',  label: 'Violet'  },
                      { key: 'blue',   color: 'bg-blue-500',    label: 'Blue'    },
                      { key: 'cyan',   color: 'bg-cyan-500',    label: 'Cyan'    },
                      { key: 'emerald',color: 'bg-emerald-500', label: 'Green'   },
                      { key: 'rose',   color: 'bg-rose-500',    label: 'Rose'    },
                      { key: 'orange', color: 'bg-orange-500',  label: 'Orange'  },
                    ].map(({ key, color, label }) => (
                      <button key={key} onClick={() => setAppearance(p => ({ ...p, accent: key }))}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-colors ${appearance.accent === key ? 'border-white/30 bg-white/10 text-white' : 'border-white/5 text-slate-400 hover:border-white/15'}`}>
                        <span className={`w-3.5 h-3.5 rounded-full ${color} flex-shrink-0`} />
                        {label}
                        {appearance.accent === key && <Check size={10} className="text-white" />}
                      </button>
                    ))}
                  </div>
                </div>
                {[
                  { key: 'compactMode', label: 'Compact Mode',          desc: 'Reduce spacing and padding throughout the UI' },
                  { key: 'animations',  label: 'Enable Animations',     desc: 'Smooth transitions and micro-interactions'    },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                    <div>
                      <p className="text-sm text-slate-200">{label}</p>
                      <p className="text-xs text-slate-500">{desc}</p>
                    </div>
                    <Toggle value={appearance[key] ?? false} onChange={v => setAppearance(p => ({ ...p, [key]: v }))} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── BILLING ── */}
          {activeTab === 'billing' && (
            <div className="card p-6 space-y-6">
              <h2 className="text-base font-semibold text-white border-b border-white/5 pb-3">Billing & Subscription</h2>
              {tenant ? (
                <>
                  <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-violet-400 font-semibold uppercase tracking-wider">Current Plan</p>
                        <p className="text-2xl font-bold text-white mt-1">{tenant.plan}</p>
                        <p className="text-sm text-slate-400 mt-0.5">{tenant.name}</p>
                      </div>
                      <div className="text-right space-y-1.5">
                        <span className={`text-xs px-2 py-1 rounded-full border ${planColors[tenant.status] ?? 'bg-slate-500/10 border-slate-500/20 text-slate-400'}`}>
                          {tenant.status}
                        </span>
                        {tenant.trialEndsAt && (
                          <p className="text-xs text-slate-500">Trial ends {new Date(tenant.trialEndsAt).toLocaleDateString()}</p>
                        )}
                        {tenant.subscriptionEndsAt && (
                          <p className="text-xs text-slate-500">Renews {new Date(tenant.subscriptionEndsAt).toLocaleDateString()}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {[
                      { label: 'Branches',  value: tenant.branches?.length ?? 0 },
                      { label: 'Users',     value: teamUsers.length || '—'      },
                      { label: 'MRR',       value: tenant.mrr ? `$${tenant.mrr}` : '—' },
                      { label: 'Member Since', value: new Date(tenant.createdAt).toLocaleDateString() },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-white/3 rounded-xl p-3 border border-white/5">
                        <p className="text-[10px] text-slate-600 uppercase tracking-wide">{label}</p>
                        <p className="text-sm font-semibold text-white mt-0.5">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-violet-400" /></div>
              )}
            </div>
          )}

          {/* ── TEAM ── */}
          {activeTab === 'team' && (
            <div className="card p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h2 className="text-base font-semibold text-white">Team Members</h2>
                <button onClick={() => setShowAddUser(v => !v)}
                  className="btn-primary text-sm flex items-center gap-2">
                  {showAddUser ? <X size={13} /> : <Plus size={13} />}{showAddUser ? 'Cancel' : 'Add User'}
                </button>
              </div>

              {/* Add user form */}
              {showAddUser && (
                <form onSubmit={addUser} className="p-4 bg-white/3 rounded-xl border border-white/5 space-y-3">
                  <p className="text-xs font-semibold text-slate-300">New Team Member</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {[
                      { k: 'name',     label: 'Full Name *', type: 'text',     req: true  },
                      { k: 'email',    label: 'Email *',     type: 'email',    req: true  },
                      { k: 'password', label: 'Password *',  type: 'password', req: true  },
                    ].map(({ k, label, type, req }) => (
                      <div key={k}>
                        <label className="block text-[10px] text-slate-500 mb-1">{label}</label>
                        <input type={type} required={req} className="input-field text-xs"
                          value={(newUser as any)[k]} onChange={e => setNewUser(p => ({ ...p, [k]: e.target.value }))} />
                      </div>
                    ))}
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">Role</label>
                      <select className="input-field text-xs" value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}>
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                  <button type="submit" disabled={addingUser} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-60">
                    {addingUser ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}Add Member
                  </button>
                </form>
              )}

              {/* Users list */}
              {teamLoading ? (
                <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-violet-400" /></div>
              ) : teamUsers.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">No team members found</p>
              ) : (
                <div className="space-y-2">
                  {teamUsers.map((u: any) => (
                    <div key={u.id} className="flex items-center gap-3 p-3 bg-white/3 rounded-xl border border-white/5">
                      <div className="w-9 h-9 rounded-full bg-violet-500/20 flex items-center justify-center text-sm font-bold text-violet-300 flex-shrink-0">
                        {u.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-200 truncate">{u.name}</p>
                          {u.id === currentUser?.id && (
                            <span className="text-[9px] bg-violet-500/20 text-violet-400 px-1.5 py-0.5 rounded-full border border-violet-500/30">You</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${roleColors[u.role] ?? 'bg-slate-500/10 border-slate-500/20 text-slate-400'}`}>
                          {u.role}
                        </span>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.isActive !== false ? 'bg-green-400' : 'bg-slate-600'}`} title={u.isActive !== false ? 'Active' : 'Inactive'} />
                        {u.id !== currentUser?.id && (
                          <button onClick={() => removeUser(u.id)} disabled={deletingUserId === u.id}
                            className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-40">
                            {deletingUserId === u.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
