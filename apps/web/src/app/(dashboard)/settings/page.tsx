'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Save, Building2, User, Bell, Shield, Palette, CreditCard, Users,
  Loader2, Eye, EyeOff, Trash2, Plus, X, CheckCircle, Check, FileText, Smartphone, ChevronRight, BookOpen,
  Package, Tag, Wallet, Copy, Monitor,
} from 'lucide-react'
import { authApi, usersApi, tenantApi, uploadApi, deviceCatalogApi, plansApi, branchesApi } from '@/lib/api'
import { authStorage } from '@/lib/auth'
import { getActiveBranchId } from '@/lib/active-branch'
import {
  type InvoiceSettings,
  getInvoiceSettings,
  saveInvoiceSettings,
  fetchInvoiceCustomizeSettings,
  pushInvoiceSettings,
  DEFAULT_REPAIR_INTAKE_TERMS,
} from '@/lib/invoiceSettings'
import ThermalReceiptCustomizer, { ThermalReceiptPreview, ThermalLogoSizePicker } from '@/components/invoice/ThermalReceiptCustomizer'
import InvoiceTemplatePicker from '@/components/invoice/InvoiceTemplatePicker'
import { Switch } from '@/components/ui/Switch'
import {
  type ProductVariantSettings,
  DEFAULT_PRODUCT_VARIANT_SETTINGS,
  fetchProductVariantSettings,
  pushProductVariantSettings,
} from '@/lib/productVariantSettings'
import {
  type AppearanceSettings,
  getStoredAppearance,
  saveAppearance as persistAppearance,
  type AccentKey,
  type TextSizeKey,
  type UiFontKey,
  ACCENT_PALETTES,
  TEXT_SIZE_OPTIONS,
  UI_FONT_OPTIONS,
  ensureAllUiFontsLoaded,
} from '@/lib/appearance'
import {
  type ProductCodeSettingsView,
  DEFAULT_PRODUCT_CODE_SETTINGS,
  fetchProductCodeSettings,
  pushProductCodeSettings,
} from '@/lib/productCodeSettings'
import { ImageIcon, Trash2 as TrashIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import UserManualPanel from '@/components/settings/UserManualPanel'
import {
  PAYMENT_METHOD_KEYS,
  DEFAULT_PAYMENT_METHOD_LABELS,
  DEFAULT_PAYMENT_METHODS,
  type PaymentMethodKey,
  type TenantPaymentMethod,
} from '@/lib/payment-methods'
import {
  DEFAULT_POS_UI_SETTINGS,
  POS_BOTTOM_ACTION_IDS,
  POS_BOTTOM_ACTION_LABELS,
  POS_SHORTCUT_KEYS,
  POS_SHORTCUT_ACTIONS,
  POS_SHORTCUT_ACTION_LABELS,
  fetchPosUiSettings,
  pushPosUiSettings,
  type PosBottomActionId,
  type PosShortcutActionId,
  type PosShortcutKey,
  type PosUiSettings,
} from '@/lib/posUiSettings'

const tabs = [
  { key: 'shop',          label: 'Shop Info',       icon: Building2  },
  { key: 'invoice',       label: 'Invoice',         icon: FileText   },
  { key: 'pos',           label: 'POS Display',     icon: Monitor    },
  { key: 'barcode',       label: 'Barcode Labels',  icon: Tag        },
  { key: 'manual',        label: 'User Manual',     icon: BookOpen   },
  { key: 'devices',       label: 'Devices',         icon: Smartphone },
  { key: 'payments',      label: 'Payment Methods', icon: Wallet     },
  { key: 'profile',       label: 'Profile',         icon: User       },
  { key: 'notifications', label: 'Notifications',   icon: Bell       },
  { key: 'security',      label: 'Security',        icon: Shield     },
  { key: 'appearance',    label: 'Appearance',      icon: Palette    },
  { key: 'billing',       label: 'Billing',         icon: CreditCard },
  { key: 'team',          label: 'Team',            icon: Users      },
]



const NOTIF_KEY = 'hx_notif_prefs'

const planColors: Record<string, string> = {
  TRIAL:      'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
  STARTER:    'bg-blue-500/10   border-blue-500/20   text-blue-400',
  PRO:        'bg-violet-500/10 border-violet-500/20 text-violet-400',
  ENTERPRISE: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
}

export default function SettingsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('shop')
  const currentUser = authStorage.getUser()
  const tenantId = currentUser?.tenantId
  const userBranchId = getActiveBranchId() ?? currentUser?.branchIds?.[0]

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'barcode') {
      router.replace('/settings/barcode-labels')
      return
    }
    if (tab && tabs.some(t => t.key === tab)) setActiveTab(tab)
  }, [searchParams, router])
  const canManageFeatures = currentUser?.role === 'OWNER' || currentUser?.role === 'MANAGER'

  /* ── Plans ── */
  const [plans, setPlans] = useState<any[]>([])
  const [upgradePlan, setUpgradePlan] = useState<any>(null)
  useEffect(() => {
    plansApi.list().then((r: any) => setPlans(r?.data ?? [])).catch(() => {})
  }, [])

  /* ── Payment Methods ── */
  const [payMethods, setPayMethods] = useState<TenantPaymentMethod[]>(DEFAULT_PAYMENT_METHODS)
  const [payMethodsSaving, setPayMethodsSaving] = useState(false)
  const [newPayKey, setNewPayKey] = useState<PaymentMethodKey | ''>('')
  const [newPayLabel, setNewPayLabel] = useState('')

  /* ── POS Display ── */
  const [posUiForm, setPosUiForm] = useState<PosUiSettings>(() => ({
    ...DEFAULT_POS_UI_SETTINGS,
    productGrid: { ...DEFAULT_POS_UI_SETTINGS.productGrid },
    layout: { ...DEFAULT_POS_UI_SETTINGS.layout },
    bottomActions: { visible: [...DEFAULT_POS_UI_SETTINGS.bottomActions.visible] },
    shortcuts: { ...DEFAULT_POS_UI_SETTINGS.shortcuts },
    behavior: { ...DEFAULT_POS_UI_SETTINGS.behavior },
  }))
  const [posUiLoading, setPosUiLoading] = useState(false)
  const [posUiSaving, setPosUiSaving] = useState(false)

  useEffect(() => {
    if (activeTab !== 'pos') return
    setPosUiLoading(true)
    fetchPosUiSettings()
      .then(setPosUiForm)
      .finally(() => setPosUiLoading(false))
  }, [activeTab])

  const savePosUi = async () => {
    setPosUiSaving(true)
    try {
      const saved = await pushPosUiSettings(posUiForm)
      setPosUiForm(saved)
      toast.success('POS display settings saved')
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save POS settings')
    } finally {
      setPosUiSaving(false)
    }
  }

  const toggleBottomAction = (id: PosBottomActionId) => {
    setPosUiForm(prev => {
      const has = prev.bottomActions.visible.includes(id)
      if (has && id === 'newSale') return prev
      const visible = has
        ? prev.bottomActions.visible.filter(x => x !== id)
        : [...prev.bottomActions.visible, id]
      return { ...prev, bottomActions: { visible } }
    })
  }

  useEffect(() => {
    if (!tenantId) return
    tenantApi.getPaymentMethodSettings(tenantId)
      .then((r: any) => {
        const methods = (r?.data ?? r)?.methods
        if (Array.isArray(methods) && methods.length) setPayMethods(methods)
      })
      .catch(() => {})
  }, [tenantId])

  const availablePayKeys = PAYMENT_METHOD_KEYS.filter(k => !payMethods.some(m => m.key === k))

  const savePayMethods = async (methods: TenantPaymentMethod[]) => {
    if (!tenantId) return
    setPayMethodsSaving(true)
    try {
      const res: any = await tenantApi.updatePaymentMethodSettings(tenantId, { methods })
      const saved = (res?.data ?? res)?.methods
      if (Array.isArray(saved) && saved.length) setPayMethods(saved)
      toast.success('Payment methods saved')
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save payment methods')
    } finally {
      setPayMethodsSaving(false)
    }
  }

  /* ── Shop Info ── */
  const [tenant, setTenant]       = useState<any>(null)
  const [showFullTenantId, setShowFullTenantId] = useState(false)
  const [shopForm, setShopForm]   = useState({ name: '', ownerName: '', ownerEmail: '', phone: '', address: '', city: '' })
  const [shopBranchId, setShopBranchId] = useState('')
  const [shopSaving, setShopSaving] = useState(false)
  const [productCodeSettings, setProductCodeSettings] = useState<ProductCodeSettingsView>(DEFAULT_PRODUCT_CODE_SETTINGS)
  const [productCodeSaving, setProductCodeSaving] = useState(false)

  useEffect(() => {
    if (!tenantId) return
    let cancelled = false
    tenantApi.get(tenantId).then((r: any) => {
      if (cancelled) return
      const t = r?.data ?? r
      setTenant(t)
      const branch =
        (userBranchId ? t.branches?.find((b: any) => b.id === userBranchId) : undefined)
        ?? t.branches?.find((b: any) => b.isHeadquarters)
        ?? t.branches?.[0]
      if (branch?.id) setShopBranchId(branch.id)
      setShopForm({
        name: t.name ?? '',
        ownerName: t.ownerName ?? '',
        ownerEmail: t.ownerEmail ?? '',
        phone: branch?.phone ?? '',
        address: branch?.address ?? '',
        city: branch?.city ?? '',
      })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [tenantId, userBranchId])

  useEffect(() => {
    if (!tenantId) return
    fetchProductCodeSettings(tenantId)
      .then(setProductCodeSettings)
      .catch(() => {})
  }, [tenantId])

  const saveProductCodeSettings = async () => {
    if (!tenant) return
    setProductCodeSaving(true)
    try {
      const saved = await pushProductCodeSettings(tenant.id, {
        skuStartNumber: productCodeSettings.skuStartNumber,
        barcodeStartNumber: productCodeSettings.barcodeStartNumber,
        skuPad: productCodeSettings.skuPad,
      })
      setProductCodeSettings(saved)
      toast.success('Product SKU & barcode settings saved')
    } catch {
      toast.error('Failed to save product code settings')
    } finally {
      setProductCodeSaving(false)
    }
  }

  const saveShop = async () => {
    if (!tenant) return
    setShopSaving(true)
    try {
      await tenantApi.update(tenant.id, {
        name: shopForm.name,
        ownerName: shopForm.ownerName,
        ownerEmail: shopForm.ownerEmail,
      })
      if (shopBranchId) {
        await branchesApi.update(shopBranchId, {
          phone: shopForm.phone,
          address: shopForm.address,
          city: shopForm.city,
        })
      }
      const nextInvoiceSettings = {
        ...getInvoiceSettings(),
        shopName: shopForm.name,
        phone: shopForm.phone,
        address: [shopForm.address, shopForm.city].filter(Boolean).join(', '),
      }
      saveInvoiceSettings(nextInvoiceSettings)
      const syncedInvoiceSettings = await pushInvoiceSettings(tenant.id, nextInvoiceSettings, tenant?.slug).catch(() => nextInvoiceSettings)
      setInvoiceForm(syncedInvoiceSettings)
      setTenant((prev: any) => prev ? { ...prev, name: shopForm.name, ownerName: shopForm.ownerName, ownerEmail: shopForm.ownerEmail } : prev)
      window.dispatchEvent(new CustomEvent('shop-settings-updated'))
      window.dispatchEvent(new CustomEvent('invoice-settings-updated'))
      toast.success('Shop info saved — thermal receipts will use these details')
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
  const [appearance, setAppearance] = useState<AppearanceSettings>(() => getStoredAppearance())
  const saveAppearance = () => {
    persistAppearance(appearance)
    toast.success('Appearance preferences saved')
  }
  const selectAccent = (accent: AccentKey) => {
    const next = { ...appearance, accent }
    setAppearance(next)
    persistAppearance(next)
  }
  const selectTextSize = (textSize: TextSizeKey) => {
    const next = { ...appearance, textSize }
    setAppearance(next)
    persistAppearance(next)
  }
  const selectUiFont = (uiFont: UiFontKey) => {
    const next = { ...appearance, uiFont }
    setAppearance(next)
    persistAppearance(next)
  }

  useEffect(() => {
    if (activeTab === 'appearance') ensureAllUiFontsLoaded()
  }, [activeTab])

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
      const res: any = await usersApi.create({
        ...newUser,
        ...(userBranchId ? { branchIds: [userBranchId] } : {}),
      })
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
    fetchInvoiceCustomizeSettings(currentUser.tenantId, tenant?.slug)
      .then(s => setInvoiceForm(s))
      .catch(() => {})
      .finally(() => setInvoiceLoading(false))
  }, [currentUser?.tenantId, tenant?.slug])

  const saveInvoice = async () => {
    if (!currentUser?.tenantId) return
    setInvoiceSaving(true)
    try {
      await pushInvoiceSettings(currentUser.tenantId, invoiceForm, tenant?.slug).then(saved => setInvoiceForm(saved))
      window.dispatchEvent(new CustomEvent('invoice-settings-updated'))
      toast.success('Invoice settings saved — receipts will use these details')
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

  const addWarrantyTerm    = () => setInv({ warrantyServiceTerms: [...(invoiceForm.warrantyServiceTerms ?? []), ''] })
  const removeWarrantyTerm = (i: number) => setInv({ warrantyServiceTerms: (invoiceForm.warrantyServiceTerms ?? []).filter((_, idx) => idx !== i) })
  const updateWarrantyTerm = (i: number, val: string) => {
    const t = [...(invoiceForm.warrantyServiceTerms ?? [])]; t[i] = val; setInv({ warrantyServiceTerms: t })
  }

  const addIntakeTerm = () => setInv({ repairIntakeTerms: [...(invoiceForm.repairIntakeTerms ?? []), ''] })
  const removeIntakeTerm = (i: number) => setInv({ repairIntakeTerms: (invoiceForm.repairIntakeTerms ?? []).filter((_, idx) => idx !== i) })
  const updateIntakeTerm = (i: number, val: string) => {
    const t = [...(invoiceForm.repairIntakeTerms ?? [])]; t[i] = val; setInv({ repairIntakeTerms: t })
  }
  const resetIntakeTerms = () => setInv({ repairIntakeTerms: [...DEFAULT_REPAIR_INTAKE_TERMS] })

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
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  if (tab.key === 'barcode') {
                    router.push('/settings/barcode-labels')
                    return
                  }
                  setActiveTab(tab.key)
                }}
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
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">Shop Information</h2>
                  <p className="text-[11px] text-gray-500 dark:text-slate-500 mt-0.5">Account &amp; branch profile — receipt header uses Invoice Customize</p>
                </div>
                <button onClick={saveShop} disabled={shopSaving} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-60">
                  {shopSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}Save
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1.5">Shop / Business Name</label>
                  <input className="input-field" value={shopForm.name} onChange={e => setShopForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1.5">Phone</label>
                  <input className="input-field" placeholder="+94 77 123 4567" value={shopForm.phone} onChange={e => setShopForm(p => ({ ...p, phone: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1.5">Address</label>
                  <input className="input-field" placeholder="123 Main St, Colombo" value={shopForm.address} onChange={e => setShopForm(p => ({ ...p, address: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1.5">City</label>
                  <input className="input-field" placeholder="Colombo" value={shopForm.city} onChange={e => setShopForm(p => ({ ...p, city: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1.5">Owner Name</label>
                  <input className="input-field" value={shopForm.ownerName} onChange={e => setShopForm(p => ({ ...p, ownerName: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1.5">Owner Email</label>
                  <input type="email" className="input-field" value={shopForm.ownerEmail} onChange={e => setShopForm(p => ({ ...p, ownerEmail: e.target.value }))} />
                </div>
              </div>

              {canManageFeatures && (
                <div
                  className="rounded-xl p-4 border space-y-4"
                  style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}
                >
                  <div>
                    <p className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                      <Package size={14} style={{ color: 'var(--text-muted)' }} />
                      Product SKU & Barcode Numbers
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      Set the starting numbers for your shop. Each new product auto-generates the next SKU and barcode from these values.
                    </p>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <label className="block">
                      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>SKU starting number</span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={productCodeSettings.skuStartNumber}
                        onChange={e => setProductCodeSettings(prev => ({
                          ...prev,
                          skuStartNumber: Math.max(1, parseInt(e.target.value, 10) || 1),
                        }))}
                        className="input-field mt-1"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Barcode starting number</span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={productCodeSettings.barcodeStartNumber}
                        onChange={e => setProductCodeSettings(prev => ({
                          ...prev,
                          barcodeStartNumber: Math.max(1, parseInt(e.target.value, 10) || 1),
                        }))}
                        className="input-field mt-1"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>SKU digit padding</span>
                      <input
                        type="number"
                        min={3}
                        max={12}
                        step={1}
                        value={productCodeSettings.skuPad}
                        onChange={e => setProductCodeSettings(prev => ({
                          ...prev,
                          skuPad: Math.min(12, Math.max(3, parseInt(e.target.value, 10) || 5)),
                        }))}
                        className="input-field mt-1"
                      />
                    </label>
                  </div>
                  {(productCodeSettings.nextSku || productCodeSettings.nextBarcode) && (
                    <div className="grid sm:grid-cols-2 gap-2 text-[11px]">
                      <div
                        className="rounded-lg px-3 py-2 border"
                        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
                      >
                        <span style={{ color: 'var(--text-muted)' }}>Next SKU: </span>
                        <span className="font-mono font-semibold" style={{ color: 'var(--brand-primary-light)' }}>{productCodeSettings.nextSku}</span>
                      </div>
                      <div
                        className="rounded-lg px-3 py-2 border"
                        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
                      >
                        <span style={{ color: 'var(--text-muted)' }}>Next barcode: </span>
                        <span className="font-mono font-semibold" style={{ color: 'var(--brand-primary-light)' }}>{productCodeSettings.nextBarcode}</span>
                      </div>
                    </div>
                  )}
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    Example: starting number 1 with 5-digit padding gives 00001, 00002, … Barcodes use your shop prefix (e.g. {productCodeSettings.prefix ?? 'SHOP'}-BC-00001).
                  </p>
                  <button
                    type="button"
                    onClick={saveProductCodeSettings}
                    disabled={productCodeSaving}
                    className="btn-primary text-sm inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    {productCodeSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Save Product Numbers
                  </button>
                </div>
              )}

              {tenant && (
                <div className="pt-3 border-t border-white/5">
                  <p className="text-xs text-gray-500 dark:text-slate-500 mb-2">Read-only information</p>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div className="bg-white/3 rounded-xl p-3 border border-white/5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] text-slate-600 uppercase tracking-wide">Tenant ID</p>
                        <button
                          type="button"
                          title="Copy Tenant ID"
                          onClick={() => {
                            navigator.clipboard.writeText(tenant.id ?? '')
                              .then(() => toast.success('Tenant ID copied'))
                              .catch(() => toast.error('Copy failed'))
                          }}
                          className="p-1 rounded-md text-slate-500 hover:text-violet-500 hover:bg-violet-500/10 transition-colors flex-shrink-0"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                      <p
                        title={showFullTenantId ? 'Click to shorten' : 'Click to show full ID'}
                        onClick={() => setShowFullTenantId(p => !p)}
                        className={`text-xs text-gray-700 dark:text-slate-300 font-medium mt-0.5 cursor-pointer select-all ${showFullTenantId ? 'break-all' : 'truncate'}`}
                      >
                        {showFullTenantId ? tenant.id : tenant.id?.slice(0, 12) + '…'}
                      </p>
                    </div>
                    {[
                      { label: 'Slug',       value: tenant.slug },
                      { label: 'Plan',       value: tenant.plan },
                      { label: 'Status',     value: tenant.status },
                      { label: 'Created',    value: new Date(tenant.createdAt).toLocaleDateString() },
                      { label: 'Branches',   value: tenant.branches?.length ?? '—' },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-white/3 rounded-xl p-3 border border-white/5">
                        <p className="text-[10px] text-slate-600 uppercase tracking-wide">{label}</p>
                        <p className="text-xs text-gray-700 dark:text-slate-300 font-medium mt-0.5 truncate">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── USER MANUAL ── */}
          {activeTab === 'manual' && <UserManualPanel embedded />}

          {/* ── INVOICE CUSTOMIZE ── */}
          {activeTab === 'invoice' && (
            <div className="space-y-5">
              <div className="card p-5 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2"><FileText size={15} className="text-violet-400" /> Invoice Customize</h2>
                  <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">Company details, thermal layout, and live receipt preview</p>
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

              {!invoiceLoading && (
              <div className="grid lg:grid-cols-[1fr_320px] gap-5 items-start">
              <div className="order-1 lg:order-2 min-w-0 self-start lg:sticky lg:top-4">
                <ThermalReceiptPreview settings={invoiceForm} />
              </div>
              <div className="order-2 lg:order-1 space-y-5 min-w-0">

              <InvoiceTemplatePicker
                settings={invoiceForm}
                tenantSlug={tenant?.slug}
                onChange={template => setInv({ invoiceTemplate: template })}
              />

              {/* ── 1. Company Info ── */}
              <div className="card p-5 space-y-4">
                <p className="text-xs font-bold text-violet-400 uppercase tracking-widest">Company Info</p>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-slate-400 mb-2">Company Logo</label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-xl border-2 border-dashed border-white/10 flex items-center justify-center bg-white/3 overflow-hidden flex-shrink-0">
                      {invoiceForm.logo
                        ? <img src={invoiceForm.logo} alt="logo" className="w-full h-full object-contain p-1" />
                        : <ImageIcon size={22} className="text-slate-600" />}
                    </div>
                    <div className="space-y-2">
                      <label className={`cursor-pointer flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-white/10 text-gray-700 dark:text-slate-300 hover:bg-white/5 transition-colors ${logoUploading ? 'opacity-50 pointer-events-none' : ''}`}>
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
                  {invoiceForm.logo && (
                    <ThermalLogoSizePicker settings={invoiceForm} onChange={setInv} compact />
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  {([
                    { k: 'shopName', label: 'Business Name', ph: 'e.g. Akila Mobile Shop' },
                    { k: 'companyLegalName', label: 'Legal Company Name', ph: 'e.g. YOUR SHOP (PVT) LTD' },
                    { k: 'slogan',   label: 'Slogan / Tagline', ph: 'e.g. Your Trusted Store' },
                    { k: 'phone',    label: 'Phone', ph: '+94 77 123 4567' },
                    { k: 'email',    label: 'Email', ph: 'shop@example.com' },
                    { k: 'website',  label: 'Website', ph: 'www.example.com' },
                  ] as { k: keyof InvoiceSettings; label: string; ph: string }[]).map(({ k, label, ph }) => (
                    <div key={k}>
                      <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1.5">{label}</label>
                      <input className="input-field" placeholder={ph}
                        value={invoiceForm[k] as string}
                        onChange={e => setInv({ [k]: e.target.value })} />
                    </div>
                  ))}
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1.5">Address</label>
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
                      <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1.5">{label}</label>
                      <input className="input-field" placeholder={ph}
                        value={invoiceForm[k] as string}
                        onChange={e => setInv({ [k]: e.target.value })} />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1.5">Extended Bank / Payment Info</label>
                  <textarea rows={4} className="input-field resize-none text-xs" placeholder="Add multiple bank accounts, branch names, and payment remarks (shown on Payment Receipt template)."
                    value={invoiceForm.bankDetails} onChange={e => setInv({ bankDetails: e.target.value })} />
                </div>
              </div>

              {/* ── 3. Invoice Options ── */}
              <div className="card p-5 space-y-4">
                <p className="text-xs font-bold text-violet-400 uppercase tracking-widest">Invoice Options</p>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1.5">Currency</label>
                    <select className="input-field" value={invoiceForm.currency} onChange={e => setInv({ currency: e.target.value })}>
                      {['LKR','USD','EUR','GBP','INR','AUD','CAD','SGD'].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1.5">Tax Rate (%)</label>
                    <input type="number" min={0} max={100} className="input-field" placeholder="0"
                      value={invoiceForm.taxRate}
                      onChange={e => setInv({ taxRate: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1.5">Default Discount (%)</label>
                    <input type="number" min={0} max={100} className="input-field" placeholder="0"
                      value={invoiceForm.discountRate}
                      onChange={e => setInv({ discountRate: parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>
              </div>

              {/* ── 4. Terms & Conditions ── */}
              <div className="card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-violet-400 uppercase tracking-widest">Terms &amp; Conditions</p>
                    <p className="text-[11px] text-gray-500 dark:text-slate-500 mt-1">Printed on stock form invoices below warranty terms.</p>
                  </div>
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

              {/* ── 4c. Warranty & Service Terms ── */}
              <div className="card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-violet-400 uppercase tracking-widest">Warranty &amp; Service Terms</p>
                    <p className="text-[11px] text-gray-500 dark:text-slate-500 mt-1">Shown on POS stock form bills (e.g. phone warranty, software coverage).</p>
                  </div>
                  <button onClick={addWarrantyTerm} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-violet-500/30 text-violet-400 hover:bg-violet-500/10 transition-colors">
                    <Plus size={11} /> Add Line
                  </button>
                </div>
                <div className="space-y-2">
                  {(invoiceForm.warrantyServiceTerms ?? []).map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-slate-600 w-5 text-right flex-shrink-0">{i + 1}.</span>
                      <input className="input-field flex-1 text-xs py-2"
                        value={t} placeholder={`Warranty term ${i + 1}`}
                        onChange={e => updateWarrantyTerm(i, e.target.value)} />
                      <button onClick={() => removeWarrantyTerm(i)} className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {(invoiceForm.warrantyServiceTerms ?? []).length === 0 && (
                    <p className="text-xs text-slate-600 italic">No warranty terms added. Click &quot;Add Line&quot; to add one.</p>
                  )}
                </div>
              </div>

              {/* ── 4d. Repair Intake / Custody Terms ── */}
              <div className="card p-5 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-xs font-bold text-violet-400 uppercase tracking-widest">Repair Intake Terms</p>
                    <p className="text-[11px] text-gray-500 dark:text-slate-500 mt-1">
                      Printed on the device intake / custody thermal slip when a phone is received for repair. Edit in any language.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={resetIntakeTerms} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-white/10 text-slate-400 hover:bg-white/5 transition-colors">
                      Reset Default
                    </button>
                    <button type="button" onClick={addIntakeTerm} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-violet-500/30 text-violet-400 hover:bg-violet-500/10 transition-colors">
                      <Plus size={11} /> Add Line
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {(invoiceForm.repairIntakeTerms ?? []).map((t, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-xs text-slate-600 w-5 text-right flex-shrink-0 mt-2.5">{i + 1}.</span>
                      <textarea
                        className="input-field flex-1 text-xs py-2 min-h-[64px] resize-y"
                        value={t}
                        placeholder={`Intake term ${i + 1} (English / Sinhala / any language)`}
                        onChange={e => updateIntakeTerm(i, e.target.value)}
                      />
                      <button type="button" onClick={() => removeIntakeTerm(i)} className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors mt-1">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {(invoiceForm.repairIntakeTerms ?? []).length === 0 && (
                    <p className="text-xs text-slate-600 italic">No intake terms. Click &quot;Add Line&quot; or &quot;Reset Default&quot; for the 14-day notice.</p>
                  )}
                </div>
              </div>

              {/* ── 5. Signatory ── */}
              <div className="card p-5 space-y-4">
                <p className="text-xs font-bold text-violet-400 uppercase tracking-widest">Signatory</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1.5">Signatory Name</label>
                    <input className="input-field" placeholder="e.g. Akila Eranda"
                      value={invoiceForm.signatoryName}
                      onChange={e => setInv({ signatoryName: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1.5">Title / Designation</label>
                    <input className="input-field" placeholder="e.g. Authorized Signatory"
                      value={invoiceForm.signatoryTitle}
                      onChange={e => setInv({ signatoryTitle: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1.5">Footer Note</label>
                    <input className="input-field" placeholder="e.g. Thank you for your business!"
                      value={invoiceForm.footerNote}
                      onChange={e => setInv({ footerNote: e.target.value })} />
                  </div>
                </div>
              </div>

              <ThermalReceiptCustomizer settings={invoiceForm} onChange={setInv} showPreview={false} />

              {/* Save button bottom */}
              <div className="flex justify-end">
                <button onClick={saveInvoice} disabled={invoiceSaving || invoiceLoading} className="btn-primary flex items-center gap-2 disabled:opacity-60">
                  {invoiceSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={14} />} Save Invoice Settings
                </button>
              </div>
              </div>
              </div>
              )}

            </div>
          )}

          {/* ── BARCODE LABELS ── (dedicated page) */}

          {activeTab === 'profile' && (
            <div className="card p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Profile</h2>
                <button onClick={saveProfile} disabled={profileSaving} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-60">
                  {profileSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}Save
                </button>
              </div>
              <div className="flex items-center gap-4 pb-4 border-b border-white/5">
                <div className="w-16 h-16 rounded-full bg-violet-500/20 flex items-center justify-center text-2xl font-bold text-violet-300">
                  {profile.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{profile.name}</p>
                  <p className="text-xs text-gray-600 dark:text-slate-400">{profile.email}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border mt-1 inline-block ${roleColors[currentUser?.role ?? ''] ?? 'bg-slate-500/10 border-slate-500/20 text-slate-400'}`}>
                    {currentUser?.role}
                  </span>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1.5">Full Name</label>
                  <input className="input-field" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1.5">Email</label>
                  <input type="email" className="input-field" value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} />
                </div>
              </div>
            </div>
          )}

          {/* ── POS DISPLAY ── */}
          {activeTab === 'pos' && (
            <div className="card p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Monitor size={15} className="text-violet-400" /> POS Display
                  </h2>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Customize POS theme, product cards, bottom bar, and F-key shortcuts. Defaults match current Hexa POS.
                  </p>
                </div>
                <button onClick={savePosUi} disabled={posUiSaving || posUiLoading} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-60">
                  {posUiSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save POS Settings
                </button>
              </div>

              {posUiLoading ? (
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                  <Loader2 size={14} className="animate-spin" /> Loading…
                </div>
              ) : (
                <>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Theme</label>
                      <select
                        className="input-field"
                        value={posUiForm.theme}
                        onChange={e => setPosUiForm(p => ({ ...p, theme: e.target.value as PosUiSettings['theme'] }))}
                      >
                        <option value="hexa-dark">Hexa Dark</option>
                        <option value="hexa-light">Hexa Light</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Accent color (hex)</label>
                      <input
                        className="input-field font-mono"
                        placeholder="#7C3AED"
                        value={posUiForm.accent}
                        onChange={e => setPosUiForm(p => ({ ...p, accent: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Density</label>
                      <select
                        className="input-field"
                        value={posUiForm.density}
                        onChange={e => setPosUiForm(p => ({ ...p, density: e.target.value as PosUiSettings['density'] }))}
                      >
                        <option value="comfortable">Comfortable</option>
                        <option value="compact">Compact</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Desktop columns</label>
                      <select
                        className="input-field"
                        value={posUiForm.productGrid.columnsDesktop}
                        onChange={e => setPosUiForm(p => ({
                          ...p,
                          productGrid: { ...p.productGrid, columnsDesktop: Number(e.target.value) as 3 | 4 | 5 | 6 },
                        }))}
                      >
                        {[3, 4, 5, 6].map(n => <option key={n} value={n}>{n} columns</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Cart position</label>
                      <select
                        className="input-field"
                        value={posUiForm.layout.cartPosition}
                        onChange={e => setPosUiForm(p => ({
                          ...p,
                          layout: { ...p.layout, cartPosition: e.target.value as 'right' | 'left' },
                        }))}
                      >
                        <option value="right">Right</option>
                        <option value="left">Left</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Default price mode</label>
                      <select
                        className="input-field"
                        value={posUiForm.behavior.defaultPriceMode}
                        onChange={e => setPosUiForm(p => ({
                          ...p,
                          behavior: { ...p.behavior, defaultPriceMode: e.target.value as PosUiSettings['behavior']['defaultPriceMode'] },
                        }))}
                      >
                        <option value="retail">Retail</option>
                        <option value="wholesale">Wholesale</option>
                        <option value="credit">Credit</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    {([
                      ['showSidebar', 'Show left sidebar', posUiForm.layout.showSidebar, (v: boolean) => setPosUiForm(p => ({ ...p, layout: { ...p.layout, showSidebar: v } }))],
                      ['showBottom', 'Show bottom action bar', posUiForm.layout.showBottomActions, (v: boolean) => setPosUiForm(p => ({ ...p, layout: { ...p.layout, showBottomActions: v } }))],
                      ['showSku', 'Show SKU on cards', posUiForm.productGrid.showSku, (v: boolean) => setPosUiForm(p => ({ ...p, productGrid: { ...p.productGrid, showSku: v } }))],
                      ['showStock', 'Show stock badge', posUiForm.productGrid.showStockBadge, (v: boolean) => setPosUiForm(p => ({ ...p, productGrid: { ...p.productGrid, showStockBadge: v } }))],
                      ['showHot', 'Show HOT badge', posUiForm.productGrid.showHotBadge, (v: boolean) => setPosUiForm(p => ({ ...p, productGrid: { ...p.productGrid, showHotBadge: v } }))],
                      ['showWarranty', 'Show warranty badge', posUiForm.productGrid.showWarrantyBadge, (v: boolean) => setPosUiForm(p => ({ ...p, productGrid: { ...p.productGrid, showWarrantyBadge: v } }))],
                      ['confirmLeave', 'Confirm leave with cart', posUiForm.behavior.confirmLeaveWithCart, (v: boolean) => setPosUiForm(p => ({ ...p, behavior: { ...p.behavior, confirmLeaveWithCart: v } }))],
                      ['focusSearch', 'Focus search on open', posUiForm.behavior.focusSearchOnOpen, (v: boolean) => setPosUiForm(p => ({ ...p, behavior: { ...p.behavior, focusSearchOnOpen: v } }))],
                    ] as Array<[string, string, boolean, (v: boolean) => void]>).map(([key, label, checked, onChange]) => (
                      <label key={key} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 cursor-pointer" style={{ borderColor: 'var(--border)' }}>
                        <span className="text-sm text-gray-900 dark:text-white">{label}</span>
                        <Switch checked={checked} onChange={onChange} />
                      </label>
                    ))}
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-violet-400 mb-2">Bottom actions</p>
                    <div className="flex flex-wrap gap-2">
                      {POS_BOTTOM_ACTION_IDS.map(id => {
                        const on = posUiForm.bottomActions.visible.includes(id)
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => toggleBottomAction(id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${on ? 'bg-violet-500/20 border-violet-500/40 text-violet-200' : 'border-white/10 text-slate-400'}`}
                          >
                            {POS_BOTTOM_ACTION_LABELS[id]}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-violet-400 mb-2">Keyboard shortcuts</p>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {POS_SHORTCUT_KEYS.map(key => (
                        <div key={key} className="flex items-center gap-2">
                          <span className="w-10 text-xs font-mono font-bold text-violet-300">{key}</span>
                          <select
                            className="input-field text-xs flex-1"
                            value={posUiForm.shortcuts[key] ?? ''}
                            onChange={e => setPosUiForm(p => ({
                              ...p,
                              shortcuts: {
                                ...p.shortcuts,
                                [key]: e.target.value as PosShortcutActionId,
                              },
                            }))}
                          >
                            {POS_SHORTCUT_ACTIONS.map(a => (
                              <option key={a} value={a}>{POS_SHORTCUT_ACTION_LABELS[a]}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── PAYMENT METHODS ── */}
          {activeTab === 'payments' && (
            <div className="card p-6 space-y-5">
              <div className="border-b border-white/5 pb-3">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Payment Methods</h2>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Methods shown at POS checkout and repair payments. Cash cannot be removed.
                </p>
              </div>

              <div className="space-y-2">
                {payMethods.map(m => (
                  <div
                    key={m.key}
                    className="flex items-center gap-3 rounded-xl border px-4 py-3"
                    style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'var(--brand-glow)' }}>
                      <Wallet size={14} className="text-violet-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <input
                        className="input-field h-9 text-sm"
                        value={m.label}
                        maxLength={40}
                        onChange={e => setPayMethods(prev => prev.map(x => x.key === m.key ? { ...x, label: e.target.value } : x))}
                      />
                    </div>
                    <span className="text-[10px] font-mono px-2 py-1 rounded-md flex-shrink-0"
                      style={{ background: 'var(--bg-subtle-md)', color: 'var(--text-muted)' }}>
                      {m.key}
                    </span>
                    <button
                      type="button"
                      disabled={m.key === 'CASH'}
                      title={m.key === 'CASH' ? 'Cash cannot be removed' : 'Remove method'}
                      onClick={() => setPayMethods(prev => prev.filter(x => x.key !== m.key))}
                      className="p-2 rounded-lg transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {availablePayKeys.length > 0 && (
                <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--border-default)' }}>
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Add payment method</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      className="input-field h-10 sm:w-48"
                      value={newPayKey}
                      onChange={e => {
                        const k = e.target.value as PaymentMethodKey | ''
                        setNewPayKey(k)
                        if (k) setNewPayLabel(DEFAULT_PAYMENT_METHOD_LABELS[k])
                      }}
                    >
                      <option value="">Select type…</option>
                      {availablePayKeys.map(k => (
                        <option key={k} value={k}>{DEFAULT_PAYMENT_METHOD_LABELS[k]}</option>
                      ))}
                    </select>
                    <input
                      className="input-field h-10 flex-1"
                      placeholder="Display name (e.g. Genie / eZ Cash)"
                      value={newPayLabel}
                      maxLength={40}
                      onChange={e => setNewPayLabel(e.target.value)}
                    />
                    <button
                      type="button"
                      disabled={!newPayKey}
                      onClick={() => {
                        if (!newPayKey) return
                        setPayMethods(prev => [...prev, { key: newPayKey, label: newPayLabel.trim() || DEFAULT_PAYMENT_METHOD_LABELS[newPayKey] }])
                        setNewPayKey(''); setNewPayLabel('')
                      }}
                      className="btn-primary text-sm flex items-center justify-center gap-1.5 h-10 px-4 disabled:opacity-50"
                    >
                      <Plus size={14} />Add
                    </button>
                  </div>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    The type controls how payments are recorded in reports and accounting; the display name is what staff see.
                  </p>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => savePayMethods(payMethods)}
                  disabled={payMethodsSaving}
                  className="btn-primary text-sm flex items-center gap-2 disabled:opacity-60"
                >
                  {payMethodsSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={13} />}
                  Save Payment Methods
                </button>
              </div>
            </div>
          )}

          {/* ── NOTIFICATIONS ── */}
          {activeTab === 'notifications' && (
            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Notification Preferences</h2>
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
                    <p className="text-sm text-gray-800 dark:text-slate-200">{item.label}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-500">{item.desc}</p>
                  </div>
                  <Switch checked={notif[item.key] ?? false} onChange={v => setNotif(p => ({ ...p, [item.key]: v }))} />
                </div>
              ))}
            </div>
          )}

          {/* ── SECURITY ── */}
          {activeTab === 'security' && (
            <div className="card p-6 space-y-6">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white border-b border-white/5 pb-3">Security Settings</h2>
              <form onSubmit={changePassword} className="space-y-4 max-w-sm">
                {[
                  { key: 'current', label: 'Current Password',     ph: 'Enter current password'  },
                  { key: 'next',    label: 'New Password',          ph: 'Min. 6 characters'       },
                  { key: 'confirm', label: 'Confirm New Password',  ph: 'Repeat new password'     },
                ].map(({ key, label, ph }) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1.5">{label}</label>
                    <div className="relative">
                      <input type={showPw ? 'text' : 'password'} required placeholder={ph}
                        className="input-field pr-9"
                        value={(pwForm as any)[key]}
                        onChange={e => setPwForm(p => ({ ...p, [key]: e.target.value }))} />
                      <button type="button" onClick={() => setShowPw(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-500 hover:text-gray-900 dark:hover:text-white">
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
                <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200 mb-1">Logged-in Account</h3>
                <p className="text-xs text-gray-500 dark:text-slate-500">{currentUser?.email}</p>
                <p className="text-xs text-slate-600 mt-0.5">Role: {currentUser?.role}</p>
              </div>
            </div>
          )}

          {/* ── APPEARANCE ── */}
          {activeTab === 'appearance' && (
            <div className="card p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div>
                  <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Appearance</h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Colors, Google Fonts, and system-wide text size for the whole app
                  </p>
                </div>
                <button onClick={saveAppearance} className="btn-primary text-sm flex items-center gap-2">
                  <Save size={13} />Save
                </button>
              </div>
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>Accent Color</label>
                  <div className="flex gap-3 flex-wrap">
                    {([
                      { key: 'violet' as const,  label: 'Violet'  },
                      { key: 'blue' as const,    label: 'Blue'    },
                      { key: 'cyan' as const,    label: 'Cyan'    },
                      { key: 'emerald' as const, label: 'Green'   },
                      { key: 'rose' as const,    label: 'Rose'    },
                      { key: 'orange' as const,  label: 'Orange'  },
                    ]).map(({ key, label }) => (
                      <button key={key} type="button" onClick={() => selectAccent(key)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-colors"
                        style={appearance.accent === key
                          ? { borderColor: 'var(--sidebar-active-border)', background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)' }
                          : { borderColor: 'var(--border-default)', color: 'var(--text-muted)' }}>
                        <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: ACCENT_PALETTES[key].primary }} />
                        {label}
                        {appearance.accent === key && <Check size={10} />}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    System font (Google Fonts)
                  </label>
                  <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                    Loads from Google Fonts and applies to the whole dashboard immediately.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {UI_FONT_OPTIONS.map(font => {
                      const active = appearance.uiFont === font.key
                      return (
                        <button
                          key={font.key}
                          type="button"
                          onClick={() => selectUiFont(font.key)}
                          className="rounded-xl border px-3 py-3 text-left transition-colors"
                          style={active
                            ? { borderColor: 'var(--sidebar-active-border)', background: 'var(--sidebar-active-bg)' }
                            : { borderColor: 'var(--border-default)', background: 'var(--bg-subtle)' }}
                        >
                          <p
                            className="text-sm font-semibold truncate"
                            style={{
                              color: active ? 'var(--sidebar-active-text)' : 'var(--text-primary)',
                              fontFamily: font.family,
                            }}
                          >
                            {font.label}
                          </p>
                          <p
                            className="text-[11px] mt-1 truncate"
                            style={{ color: 'var(--text-muted)', fontFamily: font.family }}
                          >
                            ABC abc 123
                          </p>
                        </button>
                      )
                    })}
                  </div>
                  <p
                    className="text-sm mt-3 rounded-lg border px-3 py-2.5"
                    style={{
                      borderColor: 'var(--border-subtle)',
                      background: 'var(--bg-subtle)',
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    Preview: The quick brown fox jumps over the lazy dog — Hexalyte POS · Repair Jobs
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    System Text size
                  </label>
                  <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                    Applies to the whole dashboard — menus, tables, forms, and modals. Changes apply immediately.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {TEXT_SIZE_OPTIONS.map(({ key, label, hint }) => {
                      const active = appearance.textSize === key
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => selectTextSize(key)}
                          className="rounded-xl border px-3 py-3 text-left transition-colors"
                          style={active
                            ? { borderColor: 'var(--sidebar-active-border)', background: 'var(--sidebar-active-bg)' }
                            : { borderColor: 'var(--border-default)', background: 'var(--bg-subtle)' }}
                        >
                          <p className="text-sm font-semibold" style={{ color: active ? 'var(--sidebar-active-text)' : 'var(--text-primary)' }}>
                            {label}
                          </p>
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{hint}</p>
                          <p
                            className="mt-2 font-medium leading-none"
                            style={{
                              color: 'var(--text-secondary)',
                              fontSize: key === 'sm' ? '0.8rem' : key === 'md' ? '0.9rem' : key === 'lg' ? '1rem' : '1.1rem',
                            }}
                          >
                            Aa
                          </p>
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-xs mt-3 rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}>
                    Preview: The quick brown fox jumps over the lazy dog. Ticket #TKT-202607-0307
                  </p>
                </div>

                {([
                  { key: 'compactMode' as const, label: 'Compact Mode',          desc: 'Reduce spacing and padding throughout the UI' },
                  { key: 'animations' as const,  label: 'Enable Animations',     desc: 'Smooth transitions and micro-interactions'    },
                ]).map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between py-3 border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div>
                      <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{label}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                    </div>
                    <Switch
                      checked={appearance[key]}
                      onChange={v => {
                        const next = { ...appearance, [key]: v }
                        setAppearance(next)
                        persistAppearance(next)
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── BILLING ── */}
          {activeTab === 'billing' && (
            <div className="space-y-5">
              <div className="card p-5">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white border-b border-white/5 pb-3 mb-4">Billing &amp; Subscription</h2>

                {!tenant ? (
                  <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-violet-400" /></div>
                ) : (
                  <>
                    {/* Current plan banner */}
                    <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20 mb-4">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div>
                          <p className="text-[10px] text-violet-400 font-semibold uppercase tracking-wider">Current Plan</p>
                          <p className="text-2xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{tenant.plan}</p>
                          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{tenant.name}</p>
                        </div>
                        <div className="text-right space-y-1.5">
                          <span className={`text-xs px-2 py-1 rounded-full border ${planColors[tenant.plan] ?? 'bg-slate-500/10 border-slate-500/20 text-slate-400'}`}>
                            {tenant.status}
                          </span>
                          {tenant.trialEndsAt && (
                            <p className="text-xs text-gray-500 dark:text-slate-500">Trial ends {new Date(tenant.trialEndsAt).toLocaleDateString()}</p>
                          )}
                          {tenant.subscriptionEndsAt && (
                            <p className="text-xs text-gray-500 dark:text-slate-500">Renews {new Date(tenant.subscriptionEndsAt).toLocaleDateString()}</p>
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
                          <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">{String(value)}</p>
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
                  {(plans.length ? plans : ([
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
                      price: 'Rs. 2,999',
                      period: '/month',
                      color: '#3b82f6',
                      bg: 'rgba(59,130,246,0.08)',
                      border: 'rgba(59,130,246,0.25)',
                      features: ['1 Branch', '5 Users', 'POS & Sales', 'Full Reports', 'Repairs', 'Warranty'],
                    },
                    {
                      key: 'PRO',
                      label: 'Pro',
                      price: 'Rs. 4,999',
                      period: '/month',
                      color: 'var(--brand-light)',
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
                  ] as const) as any[]).map((plan: any) => {
                    const isCurrent = tenant?.plan === plan.key
                    return (
                      <div key={plan.key} className="relative rounded-xl p-4 flex flex-col gap-3 transition-all"
                        style={{
                          background: isCurrent ? plan.bg : 'var(--bg-subtle)',
                          border: `1px solid ${isCurrent ? plan.border : 'var(--border-subtle)'}`,
                          boxShadow: isCurrent ? `0 0 0 2px ${plan.border}` : undefined,
                        }}>
                        {'popular' in plan && plan.popular && !isCurrent && (
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
                          <p className="text-[11px] text-gray-500 dark:text-slate-500">{plan.period}</p>
                        </div>
                        <ul className="space-y-1.5 flex-1">
                          {(plan.features as string[]).map(f => (
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
                          <button
                            onClick={() => setUpgradePlan(plan)}
                            className="text-center text-xs font-semibold py-1.5 rounded-lg border border-white/10 text-slate-400 hover:border-white/20 hover:text-white transition-colors">
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

          {/* ── UPGRADE MODAL ── */}
          {upgradePlan && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setUpgradePlan(null)}>
              <div className="rounded-2xl w-full max-w-md shadow-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
                onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: upgradePlan.color }}>Upgrade to {upgradePlan.label}</p>
                    <p className="text-lg font-black mt-0.5" style={{ color: 'var(--text-primary)' }}>{upgradePlan.price}<span className="text-xs font-normal text-slate-400 ml-1">{upgradePlan.period}</span></p>
                  </div>
                  <button onClick={() => setUpgradePlan(null)} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
                </div>
                <div className="p-5 space-y-4">
                  <ul className="space-y-2">
                    {(upgradePlan.features as string[])?.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        <Check size={13} style={{ color: upgradePlan.color }} />{f}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Contact us to activate the <strong>{upgradePlan.label}</strong> plan for your account.</p>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <a href={`https://wa.me/94768874215?text=${encodeURIComponent(`Hi, I want to upgrade to the ${upgradePlan.label} plan (${upgradePlan.price}${upgradePlan.period}). Shop: ${tenant?.name ?? ''} | Email: ${tenant?.ownerEmail ?? ''}`)}`} className="flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white transition-colors" target="_blank" rel="noreferrer">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      WhatsApp
                    </a>
                    <a href="mailto:support@hexalyte.com?subject=Upgrade%20to%20" className="flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl border" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                      Email Us
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TEAM ── */}
          {activeTab === 'team' && (
            <div className="card p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Team Members</h2>
                <button onClick={() => setShowAddUser(v => !v)}
                  className="btn-primary text-sm flex items-center gap-2">
                  {showAddUser ? <X size={13} /> : <Plus size={13} />}{showAddUser ? 'Cancel' : 'Add User'}
                </button>
              </div>

              {/* Add user form */}
              {showAddUser && (
                <form onSubmit={addUser} className="p-4 bg-white/3 rounded-xl border border-white/5 space-y-3">
                  <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">New Team Member</p>
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
                          <p className="text-sm font-semibold text-gray-800 dark:text-slate-200 truncate">{u.name}</p>
                          {u.id === currentUser?.id && (
                            <span className="text-[9px] bg-violet-500/20 text-violet-400 px-1.5 py-0.5 rounded-full border border-violet-500/30">You</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-slate-500 truncate">{u.email}</p>
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
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
      {/* Left — Brands */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-white/5 pb-3">
          <Smartphone size={15} className="text-violet-400" />
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Device Brands</h3>
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
          {brands.length === 0 && <p className="text-xs text-gray-500 dark:text-slate-500 text-center py-6">No brands yet</p>}
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
              <span className="text-sm font-semibold flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{b.name}</span>
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
          <h3 className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
            {selectedBrand ? `${selectedBrand.name} — Models` : 'Select a brand'}
          </h3>
          {selectedBrand && <span className="ml-auto text-[11px] bg-white/5 text-slate-400 px-2 py-0.5 rounded-full">{selectedBrand.models?.length ?? 0}</span>}
        </div>
        {!selectedBrand ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <Smartphone size={32} className="text-slate-700" />
            <p className="text-xs text-gray-500 dark:text-slate-500">Select a brand to manage its models</p>
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
              {selectedBrand.models?.length === 0 && <p className="text-xs text-gray-500 dark:text-slate-500 text-center py-6">No models yet</p>}
              {selectedBrand.models?.map((m: any) => (
                <div key={m.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-white/5 hover:bg-white/3 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-violet-500/60 shrink-0" />
                  <span className="text-sm flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{m.name}</span>
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

      <ProductVariantOptionsSection />
    </div>
  )
}

/* ─────────────── Product Variant Options ─────────────── */
function ProductVariantOptionsSection() {
  const tenantId = authStorage.getUser()?.tenantId
  const [settings, setSettings] = useState<ProductVariantSettings>(DEFAULT_PRODUCT_VARIANT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newStorage, setNewStorage] = useState('')
  const [newColorName, setNewColorName] = useState('')
  const [newColorHex, setNewColorHex] = useState('#1a1a1a')

  useEffect(() => {
    if (!tenantId) { setLoading(false); return }
    fetchProductVariantSettings(tenantId)
      .then(setSettings)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tenantId])

  const save = async () => {
    if (!tenantId) return
    setSaving(true)
    try {
      const saved = await pushProductVariantSettings(tenantId, settings)
      setSettings(saved)
      toast.success('Variant options saved')
    } catch {
      toast.error('Failed to save variant options')
    } finally {
      setSaving(false)
    }
  }

  const addStorage = () => {
    const v = newStorage.trim()
    if (!v) return
    if (settings.storageOptions.some(s => s.toLowerCase() === v.toLowerCase())) {
      toast.error('Storage option already exists')
      return
    }
    setSettings(p => ({ ...p, storageOptions: [...p.storageOptions, v] }))
    setNewStorage('')
  }

  const removeStorage = (value: string) => {
    setSettings(p => ({ ...p, storageOptions: p.storageOptions.filter(s => s !== value) }))
  }

  const addColor = () => {
    const name = newColorName.trim()
    if (!name) return
    if (settings.colorOptions.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      toast.error('Color already exists')
      return
    }
    setSettings(p => ({ ...p, colorOptions: [...p.colorOptions, { name, hex: newColorHex }] }))
    setNewColorName('')
    setNewColorHex('#1a1a1a')
  }

  const removeColor = (name: string) => {
    setSettings(p => ({ ...p, colorOptions: p.colorOptions.filter(c => c.name !== name) }))
  }

  const updateColorHex = (name: string, hex: string) => {
    setSettings(p => ({
      ...p,
      colorOptions: p.colorOptions.map(c => c.name === name ? { ...c, hex } : c),
    }))
  }

  if (loading) {
    return (
      <div className="card p-5 flex justify-center">
        <Loader2 size={20} className="animate-spin text-violet-400" />
      </div>
    )
  }

  return (
    <div className="card p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/5 pb-3">
        <div>
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Product Variant Options</h3>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Storage (Model) and Color lists used in Create New Product → Variant Combinations.
          </p>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary text-xs flex items-center gap-1.5">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          Save Options
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Storage (Model)</h4>
          <div className="flex gap-2">
            <input
              className="input-field text-xs flex-1"
              placeholder="e.g. 256GB, Pro Max"
              value={newStorage}
              onChange={e => setNewStorage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addStorage()}
            />
            <button onClick={addStorage} disabled={!newStorage.trim()} className="btn-primary text-xs px-3 flex items-center gap-1 disabled:opacity-50">
              <Plus size={11} /> Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {settings.storageOptions.map(s => (
              <span key={s} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border"
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)', color: 'var(--text-primary)' }}>
                {s}
                <button type="button" onClick={() => removeStorage(s)} className="text-slate-500 hover:text-red-400">
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Colors</h4>
          <div className="flex gap-2">
            <input
              className="input-field text-xs flex-1"
              placeholder="Color name"
              value={newColorName}
              onChange={e => setNewColorName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addColor()}
            />
            <input
              type="color"
              value={newColorHex}
              onChange={e => setNewColorHex(e.target.value)}
              className="w-10 h-9 rounded-lg border cursor-pointer shrink-0"
              style={{ borderColor: 'var(--border-subtle)', background: 'transparent' }}
              title="Pick color"
            />
            <button onClick={addColor} disabled={!newColorName.trim()} className="btn-primary text-xs px-3 flex items-center gap-1 disabled:opacity-50">
              <Plus size={11} /> Add
            </button>
          </div>
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {settings.colorOptions.map(c => (
              <div key={c.name} className="flex items-center gap-2 px-3 py-2 rounded-xl border"
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                <span className="w-4 h-4 rounded-full border shrink-0" style={{ background: c.hex, borderColor: 'rgba(255,255,255,0.2)' }} />
                <span className="text-sm flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                <input
                  type="color"
                  value={c.hex}
                  onChange={e => updateColorHex(c.name, e.target.value)}
                  className="w-8 h-7 rounded border-0 cursor-pointer bg-transparent"
                  title="Edit swatch"
                />
                <button type="button" onClick={() => removeColor(c.name)} className="text-slate-500 hover:text-red-400">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
