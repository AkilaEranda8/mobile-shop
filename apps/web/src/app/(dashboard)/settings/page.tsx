'use client'

import { useState, useEffect } from 'react'
import {
  Save, Building2, User, Bell, Shield, Palette, CreditCard, Users,
  Loader2, Eye, EyeOff, Trash2, Plus, X, CheckCircle, Check, FileText, Smartphone, ChevronRight,
} from 'lucide-react'
import { authApi, usersApi, tenantApi, uploadApi, deviceCatalogApi } from '@/lib/api'
import { authStorage } from '@/lib/auth'
import { type InvoiceSettings, getInvoiceSettings, fetchInvoiceSettings, pushInvoiceSettings } from '@/lib/invoiceSettings'
import { ImageIcon, Trash2 as TrashIcon } from 'lucide-react'
import toast from 'react-hot-toast'

const tabs = [
  { key: 'shop',          label: 'Shop Info',       icon: Building2  },
  { key: 'invoice',       label: 'Invoice',         icon: FileText   },
  { key: 'devices',       label: 'Devices',         icon: Smartphone },
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
  const [invoiceForm, setInvoiceForm]   = useState<InvoiceSettings>(() => getInvoiceSettings())
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [invoiceSaving, setInvoiceSaving]   = useState(false)
  const setInv = (patch: Partial<InvoiceSettings>) => setInvoiceForm(p => ({ ...p, ...patch }))

  useEffect(() => {
    if (!currentUser?.tenantId) return
    setInvoiceLoading(true)
    fetchInvoiceSettings(currentUser.tenantId)
      .then(s => setInvoiceForm(s))
      .catch(() => {})
      .finally(() => setInvoiceLoading(false))
  }, [currentUser?.tenantId])

  const saveInvoice = async () => {
    if (!currentUser?.tenantId) return
    setInvoiceSaving(true)
    try {
      await pushInvoiceSettings(currentUser.tenantId, invoiceForm)
      toast.success('Invoice settings saved')
    } catch { toast.error('Save failed') }
    finally { setInvoiceSaving(false) }
  }

  const [logoUploading, setLogoUploading] = useState(false)
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error('Logo must be under 2 MB'); return }
    setLogoUploading(true)
    try {
      const { url } = await uploadApi.logo(file)
      setInv({ logo: url })
      toast.success('Logo uploaded')
    } catch (err: any) {
      toast.error(err.message || 'Upload failed')
    } finally {
      setLogoUploading(false)
    }
  }

  const addTerm    = () => setInv({ terms: [...(invoiceForm.terms ?? []), ''] })
  const removeTerm = (i: number) => setInv({ terms: invoiceForm.terms.filter((_, idx) => idx !== i) })
  const updateTerm = (i: number, val: string) => {
    const t = [...invoiceForm.terms]; t[i] = val; setInv({ terms: t })
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

          {/* ── INVOICE CUSTOMIZE ── */}
          {activeTab === 'invoice' && (
            <div className="space-y-5">

              {/* Header */}
              <div className="card p-5 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white flex items-center gap-2"><FileText size={15} className="text-violet-400" /> Invoice Customize</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Saved per tenant in database — shared across all users &amp; devices</p>
                </div>
                <button onClick={saveInvoice} disabled={invoiceSaving || invoiceLoading} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-60">
                  {invoiceSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save All
                </button>
              </div>

              {invoiceLoading && (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={20} className="animate-spin text-violet-400" />
                </div>
              )}

              {/* ── 1. Company Info ── */}
              <div className="card p-5 space-y-4">
                <p className="text-xs font-bold text-violet-400 uppercase tracking-widest">Company Info</p>

                {/* Logo upload */}
                <div>
                  <label className="block text-xs text-slate-400 mb-2">Company Logo</label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-xl border-2 border-dashed border-white/10 flex items-center justify-center bg-white/3 overflow-hidden flex-shrink-0">
                      {invoiceForm.logo
                        ? <img src={invoiceForm.logo} alt="logo" className="w-full h-full object-contain p-1" />
                        : <ImageIcon size={22} className="text-slate-600" />}
                    </div>
                    <div className="space-y-2">
                      <label className={`cursor-pointer flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 transition-colors ${logoUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                        {logoUploading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                        {logoUploading ? 'Uploading…' : 'Upload Logo'}
                        <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={logoUploading} />
                      </label>
                      {invoiceForm.logo && (
                        <button onClick={() => setInv({ logo: '' })} className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors">
                          <TrashIcon size={12} /> Remove
                        </button>
                      )}
                      <p className="text-[10px] text-slate-600">Max 2 MB · PNG, JPG, SVG, WebP</p>
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  {([
                    { k: 'shopName', label: 'Business Name', ph: 'e.g. Akila Mobile Shop' },
                    { k: 'slogan',   label: 'Slogan / Tagline', ph: 'e.g. Your Trusted Store' },
                    { k: 'phone',    label: 'Phone', ph: '+94 77 123 4567' },
                    { k: 'email',    label: 'Email', ph: 'shop@example.com' },
                    { k: 'website',  label: 'Website', ph: 'www.example.com' },
                  ] as { k: keyof InvoiceSettings; label: string; ph: string }[]).map(({ k, label, ph }) => (
                    <div key={k}>
                      <label className="block text-xs text-slate-400 mb-1.5">{label}</label>
                      <input className="input-field" placeholder={ph}
                        value={invoiceForm[k] as string}
                        onChange={e => setInv({ [k]: e.target.value })} />
                    </div>
                  ))}
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-slate-400 mb-1.5">Address</label>
                    <textarea rows={2} className="input-field resize-none" placeholder="123 Main St, Colombo, Sri Lanka"
                      value={invoiceForm.address} onChange={e => setInv({ address: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* ── 2. Payment Details ── */}
              <div className="card p-5 space-y-4">
                <p className="text-xs font-bold text-violet-400 uppercase tracking-widest">Payment Details</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {([
                    { k: 'bankName',  label: 'Bank Name',       ph: 'e.g. Bank of Ceylon' },
                    { k: 'accNumber', label: 'Account Number',  ph: '0012345678901' },
                    { k: 'accHolder', label: 'Account Holder',  ph: 'Akila Eranda' },
                    { k: 'swiftCode', label: 'Swift / Branch Code', ph: 'BCEYLKLX' },
                  ] as { k: keyof InvoiceSettings; label: string; ph: string }[]).map(({ k, label, ph }) => (
                    <div key={k}>
                      <label className="block text-xs text-slate-400 mb-1.5">{label}</label>
                      <input className="input-field" placeholder={ph}
                        value={invoiceForm[k] as string}
                        onChange={e => setInv({ [k]: e.target.value })} />
                    </div>
                  ))}
                </div>
              </div>

              {/* ── 3. Invoice Options ── */}
              <div className="card p-5 space-y-4">
                <p className="text-xs font-bold text-violet-400 uppercase tracking-widest">Invoice Options</p>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Currency</label>
                    <select className="input-field" value={invoiceForm.currency} onChange={e => setInv({ currency: e.target.value })}>
                      {['LKR','USD','EUR','GBP','INR','AUD','CAD','SGD'].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Tax Rate (%)</label>
                    <input type="number" min={0} max={100} className="input-field" placeholder="0"
                      value={invoiceForm.taxRate}
                      onChange={e => setInv({ taxRate: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Default Discount (%)</label>
                    <input type="number" min={0} max={100} className="input-field" placeholder="0"
                      value={invoiceForm.discountRate}
                      onChange={e => setInv({ discountRate: parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>
              </div>

              {/* ── 4. Terms & Conditions ── */}
              <div className="card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-violet-400 uppercase tracking-widest">Terms &amp; Conditions</p>
                  <button onClick={addTerm} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-violet-500/30 text-violet-400 hover:bg-violet-500/10 transition-colors">
                    <Plus size={11} /> Add Line
                  </button>
                </div>
                <div className="space-y-2">
                  {(invoiceForm.terms ?? []).map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-slate-600 w-5 text-right flex-shrink-0">{i + 1}.</span>
                      <input className="input-field flex-1 text-xs py-2"
                        value={t} placeholder={`Term ${i + 1}`}
                        onChange={e => updateTerm(i, e.target.value)} />
                      <button onClick={() => removeTerm(i)} className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {(invoiceForm.terms ?? []).length === 0 && (
                    <p className="text-xs text-slate-600 italic">No terms added. Click &quot;Add Line&quot; to add one.</p>
                  )}
                </div>
              </div>

              {/* ── 5. Signatory ── */}
              <div className="card p-5 space-y-4">
                <p className="text-xs font-bold text-violet-400 uppercase tracking-widest">Signatory</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Signatory Name</label>
                    <input className="input-field" placeholder="e.g. Akila Eranda"
                      value={invoiceForm.signatoryName}
                      onChange={e => setInv({ signatoryName: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Title / Designation</label>
                    <input className="input-field" placeholder="e.g. Authorized Signatory"
                      value={invoiceForm.signatoryTitle}
                      onChange={e => setInv({ signatoryTitle: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-slate-400 mb-1.5">Footer Note</label>
                    <input className="input-field" placeholder="e.g. Thank you for your business!"
                      value={invoiceForm.footerNote}
                      onChange={e => setInv({ footerNote: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* ── Thermal Print Settings ── */}
              <div className="rounded-xl p-4 space-y-4" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Thermal Printer Paper Size</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  {/* POS */}
                  <div>
                    <label className="block text-xs text-slate-400 mb-2">POS Sales Receipt</label>
                    <div className="flex gap-2">
                      {(['58mm', '80mm'] as const).map(w => (
                        <button key={w} onClick={() => setInv({ thermalWidthPOS: w })}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${invoiceForm.thermalWidthPOS === w ? 'bg-violet-600 border-violet-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:border-violet-500/40'}`}>
                          {w}
                          <span className="block text-[10px] font-normal opacity-70">{w === '58mm' ? '~32 chars/line' : '~48 chars/line'}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Repair */}
                  <div>
                    <label className="block text-xs text-slate-400 mb-2">Repair Job Receipt</label>
                    <div className="flex gap-2">
                      {(['58mm', '80mm'] as const).map(w => (
                        <button key={w} onClick={() => setInv({ thermalWidthRepair: w })}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${invoiceForm.thermalWidthRepair === w ? 'bg-violet-600 border-violet-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:border-violet-500/40'}`}>
                          {w}
                          <span className="block text-[10px] font-normal opacity-70">{w === '58mm' ? '~32 chars/line' : '~48 chars/line'}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">Full Invoice &amp; Reports always use <strong className="text-slate-400">A4 PDF</strong></p>
              </div>

              {/* Save button bottom */}
              <div className="flex justify-end">
                <button onClick={saveInvoice} disabled={invoiceSaving || invoiceLoading} className="btn-primary flex items-center gap-2 disabled:opacity-60">
                  {invoiceSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={14} />} Save Invoice Settings
                </button>
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
            <div className="space-y-5">
              <div className="card p-5">
                <h2 className="text-base font-semibold text-white border-b border-white/5 pb-3 mb-4">Billing &amp; Subscription</h2>

                {!tenant ? (
                  <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-violet-400" /></div>
                ) : (
                  <>
                    {/* Current plan banner */}
                    <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20 mb-4">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div>
                          <p className="text-[10px] text-violet-400 font-semibold uppercase tracking-wider">Current Plan</p>
                          <p className="text-2xl font-bold text-white mt-1">{tenant.plan}</p>
                          <p className="text-sm text-slate-400 mt-0.5">{tenant.name}</p>
                        </div>
                        <div className="text-right space-y-1.5">
                          <span className={`text-xs px-2 py-1 rounded-full border ${planColors[tenant.plan] ?? 'bg-slate-500/10 border-slate-500/20 text-slate-400'}`}>
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

                    {/* Usage stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Branches',     value: tenant.branches?.length ?? 0 },
                        { label: 'Team Members', value: teamUsers.length || '—'      },
                        { label: 'MRR',          value: tenant.mrr ? `$${tenant.mrr}` : '—' },
                        { label: 'Member Since', value: new Date(tenant.createdAt).toLocaleDateString() },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-white/3 rounded-xl p-3 border border-white/5">
                          <p className="text-[10px] text-slate-600 uppercase tracking-wide">{label}</p>
                          <p className="text-sm font-semibold text-white mt-0.5">{String(value)}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Plan comparison */}
              <div className="card p-5">
                <p className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-4">Available Plans</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {([
                    {
                      key: 'TRIAL',
                      label: 'Trial',
                      price: 'Free',
                      period: '14 days',
                      color: '#eab308',
                      bg: 'rgba(234,179,8,0.08)',
                      border: 'rgba(234,179,8,0.25)',
                      features: ['1 Branch', '2 Users', 'POS & Sales', 'Basic Reports', 'Repairs'],
                    },
                    {
                      key: 'STARTER',
                      label: 'Starter',
                      price: '$19',
                      period: '/month',
                      color: '#3b82f6',
                      bg: 'rgba(59,130,246,0.08)',
                      border: 'rgba(59,130,246,0.25)',
                      features: ['1 Branch', '5 Users', 'POS & Sales', 'Full Reports', 'Repairs', 'Warranty'],
                    },
                    {
                      key: 'PRO',
                      label: 'Pro',
                      price: '$49',
                      period: '/month',
                      color: '#8b5cf6',
                      bg: 'rgba(139,92,246,0.08)',
                      border: 'rgba(139,92,246,0.30)',
                      features: ['3 Branches', '15 Users', 'Everything in Starter', 'P&L Reports', 'Cash Flow', 'Branch Filtering', 'CSV Exports'],
                      popular: true,
                    },
                    {
                      key: 'ENTERPRISE',
                      label: 'Enterprise',
                      price: 'Custom',
                      period: 'contact us',
                      color: '#10b981',
                      bg: 'rgba(16,185,129,0.08)',
                      border: 'rgba(16,185,129,0.25)',
                      features: ['Unlimited Branches', 'Unlimited Users', 'Everything in Pro', 'Priority Support', 'Custom Integrations', 'SLA Guarantee'],
                    },
                  ] as const).map(plan => {
                    const isCurrent = tenant?.plan === plan.key
                    return (
                      <div key={plan.key} className="relative rounded-xl p-4 flex flex-col gap-3 transition-all"
                        style={{
                          background: isCurrent ? plan.bg : 'var(--bg-subtle)',
                          border: `1px solid ${isCurrent ? plan.border : 'var(--border-subtle)'}`,
                          boxShadow: isCurrent ? `0 0 0 2px ${plan.border}` : undefined,
                        }}>
                        {plan.popular && !isCurrent && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-bold px-2 py-0.5 rounded-full bg-violet-600 text-white tracking-wide">POPULAR</span>
                        )}
                        {isCurrent && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-bold px-2 py-0.5 rounded-full text-white tracking-wide flex items-center gap-1"
                            style={{ background: plan.color }}>
                            <CheckCircle size={8} /> CURRENT
                          </span>
                        )}
                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: plan.color }}>{plan.label}</p>
                          <p className="text-2xl font-black text-white mt-1">{plan.price}</p>
                          <p className="text-[11px] text-slate-500">{plan.period}</p>
                        </div>
                        <ul className="space-y-1.5 flex-1">
                          {plan.features.map(f => (
                            <li key={f} className="flex items-start gap-1.5 text-xs" style={{ color: isCurrent ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                              <Check size={11} className="mt-0.5 flex-shrink-0" style={{ color: plan.color }} />
                              {f}
                            </li>
                          ))}
                        </ul>
                        {isCurrent ? (
                          <div className="text-center text-xs font-semibold py-1.5 rounded-lg border"
                            style={{ color: plan.color, borderColor: plan.border, background: plan.bg }}>
                            Active Plan
                          </div>
                        ) : (
                          <button className="text-center text-xs font-semibold py-1.5 rounded-lg border border-white/10 text-slate-400 hover:border-white/20 hover:text-white transition-colors">
                            {plan.key === 'ENTERPRISE' ? 'Contact Us' : 'Upgrade'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── DEVICES ── */}
          {activeTab === 'devices' && <DevicesTab />}

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

/* ─────────────── Devices Tab ─────────────── */
function DevicesTab() {
  const [brands, setBrands]           = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [selectedBrand, setSelected]  = useState<any>(null)
  const [newBrand, setNewBrand]       = useState('')
  const [newModel, setNewModel]       = useState('')
  const [addingBrand, setAddingBrand] = useState(false)
  const [addingModel, setAddingModel] = useState(false)
  const [deletingId, setDeletingId]   = useState<string | null>(null)

  const load = async () => {
    try {
      const res = await deviceCatalogApi.listBrands()
      setBrands((res as any).data ?? res)
      if (selectedBrand) {
        const updated = ((res as any).data ?? res).find((b: any) => b.id === selectedBrand.id)
        if (updated) setSelected(updated)
      }
    } catch { toast.error('Failed to load devices') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleAddBrand = async () => {
    if (!newBrand.trim()) return
    setAddingBrand(true)
    try {
      await deviceCatalogApi.createBrand(newBrand.trim())
      setNewBrand('')
      toast.success('Brand added')
      load()
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Failed to add brand') }
    finally { setAddingBrand(false) }
  }

  const handleDeleteBrand = async (id: string) => {
    setDeletingId(id)
    try {
      await deviceCatalogApi.deleteBrand(id)
      if (selectedBrand?.id === id) setSelected(null)
      toast.success('Brand deleted')
      load()
    } catch { toast.error('Failed to delete brand') }
    finally { setDeletingId(null) }
  }

  const handleAddModel = async () => {
    if (!selectedBrand || !newModel.trim()) return
    setAddingModel(true)
    try {
      await deviceCatalogApi.createModel(selectedBrand.id, newModel.trim())
      setNewModel('')
      toast.success('Model added')
      load()
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Failed to add model') }
    finally { setAddingModel(false) }
  }

  const handleDeleteModel = async (id: string) => {
    setDeletingId(id)
    try {
      await deviceCatalogApi.deleteModel(id)
      toast.success('Model deleted')
      load()
    } catch { toast.error('Failed to delete model') }
    finally { setDeletingId(null) }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-violet-400" /></div>

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {/* Left — Brands */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-white/5 pb-3">
          <Smartphone size={15} className="text-violet-400" />
          <h3 className="text-sm font-bold text-white">Device Brands</h3>
          <span className="ml-auto text-[11px] bg-white/5 text-slate-400 px-2 py-0.5 rounded-full">{brands.length}</span>
        </div>
        {/* Add brand */}
        <div className="flex gap-2">
          <input
            className="input-field text-xs flex-1"
            placeholder="e.g. Samsung"
            value={newBrand}
            onChange={e => setNewBrand(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddBrand()}
          />
          <button onClick={handleAddBrand} disabled={!newBrand.trim() || addingBrand}
            className="btn-primary text-xs px-3 flex items-center gap-1 disabled:opacity-50">
            {addingBrand ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}Add
          </button>
        </div>
        {/* Brand list */}
        <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
          {brands.length === 0 && <p className="text-xs text-slate-500 text-center py-6">No brands yet</p>}
          {brands.map(b => (
            <button key={b.id} onClick={() => setSelected(b)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all group ${
                selectedBrand?.id === b.id
                  ? 'bg-violet-500/15 border border-violet-500/30'
                  : 'hover:bg-white/5 border border-transparent'
              }`}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${selectedBrand?.id === b.id ? 'bg-violet-500/20' : 'bg-white/5'}`}>
                <Smartphone size={12} className={selectedBrand?.id === b.id ? 'text-violet-400' : 'text-slate-400'} />
              </div>
              <span className="text-sm font-semibold text-white flex-1 truncate">{b.name}</span>
              <span className="text-[10px] text-slate-500 shrink-0">{b.models?.length ?? 0} models</span>
              <ChevronRight size={12} className={`shrink-0 transition-opacity ${selectedBrand?.id === b.id ? 'text-violet-400 opacity-100' : 'opacity-0 group-hover:opacity-50'}`} />
              <button onClick={e => { e.stopPropagation(); handleDeleteBrand(b.id) }} disabled={deletingId === b.id}
                className="shrink-0 w-6 h-6 flex items-center justify-center rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                title="Delete brand">
                {deletingId === b.id ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
              </button>
            </button>
          ))}
        </div>
      </div>

      {/* Right — Models */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-white/5 pb-3">
          <div className="w-5 h-5 rounded-md bg-violet-500/20 flex items-center justify-center"><Smartphone size={11} className="text-violet-400" /></div>
          <h3 className="text-sm font-bold text-white truncate">
            {selectedBrand ? `${selectedBrand.name} — Models` : 'Select a brand'}
          </h3>
          {selectedBrand && <span className="ml-auto text-[11px] bg-white/5 text-slate-400 px-2 py-0.5 rounded-full">{selectedBrand.models?.length ?? 0}</span>}
        </div>
        {!selectedBrand ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <Smartphone size={32} className="text-slate-700" />
            <p className="text-xs text-slate-500">Select a brand to manage its models</p>
          </div>
        ) : (
          <>
            {/* Add model */}
            <div className="flex gap-2">
              <input
                className="input-field text-xs flex-1"
                placeholder={`e.g. ${selectedBrand.name} S24`}
                value={newModel}
                onChange={e => setNewModel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddModel()}
              />
              <button onClick={handleAddModel} disabled={!newModel.trim() || addingModel}
                className="btn-primary text-xs px-3 flex items-center gap-1 disabled:opacity-50">
                {addingModel ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}Add
              </button>
            </div>
            {/* Model list */}
            <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
              {selectedBrand.models?.length === 0 && <p className="text-xs text-slate-500 text-center py-6">No models yet</p>}
              {selectedBrand.models?.map((m: any) => (
                <div key={m.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-white/5 hover:bg-white/3 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-violet-500/60 shrink-0" />
                  <span className="text-sm text-white flex-1 truncate">{m.name}</span>
                  <button onClick={() => handleDeleteModel(m.id)} disabled={deletingId === m.id}
                    className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40">
                    {deletingId === m.id ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
