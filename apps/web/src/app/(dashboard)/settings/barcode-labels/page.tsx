'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Tag, Save, Loader2,
  Building2, FileText, BookOpen, Smartphone, User, Bell, Shield, Palette, CreditCard, Users,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { authStorage } from '@/lib/auth'
import {
  DEFAULT_BARCODE_LABEL_SETTINGS,
  DEFAULT_INVOICE_SETTINGS,
  fetchInvoiceCustomizeSettings,
  pushInvoiceSettings,
  resolveBarcodeLabelSettings,
  type BarcodeLabelSettings,
  type InvoiceSettings,
} from '@/lib/invoiceSettings'
import BarcodeLabelCustomizer from '@/components/inventory/BarcodeLabelCustomizer'
import { useRolePermissions } from '@/lib/hooks'

const settingsNav = [
  { key: 'shop',          label: 'Shop Info',       icon: Building2,  href: '/settings?tab=shop' },
  { key: 'invoice',       label: 'Invoice',         icon: FileText,   href: '/settings?tab=invoice' },
  { key: 'barcode',       label: 'Barcode Labels',  icon: Tag,        href: '/settings/barcode-labels' },
  { key: 'manual',        label: 'User Manual',     icon: BookOpen,   href: '/settings?tab=manual' },
  { key: 'devices',       label: 'Devices',         icon: Smartphone, href: '/settings?tab=devices' },
  { key: 'profile',       label: 'Profile',         icon: User,       href: '/settings?tab=profile' },
  { key: 'notifications', label: 'Notifications',   icon: Bell,       href: '/settings?tab=notifications' },
  { key: 'security',      label: 'Security',        icon: Shield,     href: '/settings?tab=security' },
  { key: 'appearance',    label: 'Appearance',      icon: Palette,    href: '/settings?tab=appearance' },
  { key: 'billing',       label: 'Billing',         icon: CreditCard, href: '/settings?tab=billing' },
  { key: 'team',          label: 'Team',            icon: Users,      href: '/settings?tab=team' },
]

export default function BarcodeLabelsSettingsPage() {
  const router = useRouter()
  const currentUser = authStorage.getUser()
  const tenantId = currentUser?.tenantId
  const { canEdit } = useRolePermissions()
  const canSave = canEdit('SETTINGS')

  const [invoiceForm, setInvoiceForm] = useState<InvoiceSettings>({ ...DEFAULT_INVOICE_SETTINGS })
  const [barcodeLabel, setBarcodeLabel] = useState<BarcodeLabelSettings>({ ...DEFAULT_BARCODE_LABEL_SETTINGS })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tenantSlug, setTenantSlug] = useState<string | undefined>()

  useEffect(() => {
    if (!tenantId) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const { tenantApi } = await import('@/lib/api')
        const tenantRes: any = await tenantApi.get(tenantId).catch(() => null)
        const tenant = tenantRes?.data ?? tenantRes
        const slug = tenant?.slug as string | undefined
        const settings = await fetchInvoiceCustomizeSettings(tenantId, slug)
        if (cancelled) return
        setTenantSlug(slug)
        setInvoiceForm(settings)
        setBarcodeLabel(resolveBarcodeLabelSettings(settings))
      } catch {
        if (!cancelled) toast.error('Could not load barcode settings')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [tenantId])

  const saveAll = async () => {
    if (!tenantId || !canSave) return
    setSaving(true)
    try {
      const saved = await pushInvoiceSettings(
        tenantId,
        { ...invoiceForm, barcodeLabel },
        tenantSlug,
      )
      setInvoiceForm(saved)
      setBarcodeLabel(resolveBarcodeLabelSettings(saved))
      window.dispatchEvent(new CustomEvent('invoice-settings-updated'))
      toast.success('Barcode design saved — PO Print Barcodes will use this design')
    } catch {
      toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your shop configuration</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-52 flex-shrink-0">
          <nav className="card p-2 space-y-0.5">
            {settingsNav.map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => router.push(tab.href)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                  tab.key === 'barcode'
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <tab.icon size={15} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 min-w-0 space-y-5">
          <div className="card p-5 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Tag size={15} className="text-amber-400" /> Barcode Label Customize
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">
                Sticker size, fields, and barcode density — full customize. PO Print Barcodes uses this layout.
              </p>
            </div>
            <button
              type="button"
              onClick={saveAll}
              disabled={saving || loading || !canSave}
              className="btn-primary text-sm flex items-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Save All
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={22} className="animate-spin text-violet-400" />
            </div>
          ) : (
            <BarcodeLabelCustomizer
              settings={barcodeLabel}
              onChange={patch =>
                setBarcodeLabel(prev =>
                  resolveBarcodeLabelSettings({ barcodeLabel: { ...prev, ...patch } }),
                )
              }
              shopName={invoiceForm.shopName}
              saving={saving}
              canSave={canSave}
            />
          )}

          {!loading && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={saveAll}
                disabled={saving || !canSave}
                className="btn-primary flex items-center gap-2 disabled:opacity-60"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={14} />}
                Save Barcode Settings
              </button>
            </div>
          )}

          {!canSave && (
            <p className="text-xs text-slate-500">You have view-only access to barcode label settings.</p>
          )}

          <p className="text-[11px] text-slate-500">
            Prefer the main settings hub?{' '}
            <Link href="/settings" className="text-violet-400 hover:underline">Back to Settings</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
