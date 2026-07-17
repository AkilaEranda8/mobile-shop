'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Save, Settings, Shield } from 'lucide-react'
import toast from 'react-hot-toast'
import { useFeatureFlag } from '@/lib/hooks'
import { accountingApi } from '@/lib/api'
import {
  AccountingPageShell,
  AccountingFeatureGate,
  AccountingPageHeader,
  AccountingPanel,
} from '@/components/accounting/accounting-ui'

const EXPENSE_CATEGORIES = ['Rent', 'Salary', 'Utilities', 'Marketing', 'Inventory', 'Repairs', 'Misc']

const DEFAULT_ACCOUNT_FIELDS: Array<{ key: string; label: string; types?: string[] }> = [
  { key: 'cash', label: 'Cash on Hand', types: ['ASSET'] },
  { key: 'pettyCash', label: 'Petty Cash', types: ['ASSET'] },
  { key: 'bank', label: 'Bank — Main', types: ['ASSET'] },
  { key: 'cardClearing', label: 'Card Clearing', types: ['ASSET'] },
  { key: 'upiClearing', label: 'UPI / Wallet Clearing', types: ['ASSET'] },
  { key: 'ar', label: 'Accounts Receivable', types: ['ASSET'] },
  { key: 'inventoryMobile', label: 'Inventory — Mobile', types: ['ASSET'] },
  { key: 'inventoryAccessory', label: 'Inventory — Accessories', types: ['ASSET'] },
  { key: 'inventoryParts', label: 'Inventory — Spare Parts', types: ['ASSET'] },
  { key: 'ap', label: 'Accounts Payable', types: ['LIABILITY'] },
  { key: 'vatOutput', label: 'VAT Output', types: ['LIABILITY'] },
  { key: 'vatInput', label: 'VAT Input', types: ['ASSET'] },
  { key: 'salaryPayable', label: 'Salary Payable', types: ['LIABILITY'] },
  { key: 'epfPayable', label: 'EPF Payable', types: ['LIABILITY'] },
  { key: 'etfPayable', label: 'ETF Payable', types: ['LIABILITY'] },
  { key: 'salesMobile', label: 'Sales — Mobile', types: ['INCOME'] },
  { key: 'salesAccessory', label: 'Sales — Accessories', types: ['INCOME'] },
  { key: 'serviceIncome', label: 'Service Income', types: ['INCOME'] },
  { key: 'repairIncome', label: 'Repair Income', types: ['INCOME'] },
  { key: 'reloadCommission', label: 'Reload Commission', types: ['INCOME'] },
  { key: 'cogsMobile', label: 'COGS — Mobile', types: ['EXPENSE'] },
  { key: 'cogsAccessory', label: 'COGS — Accessories', types: ['EXPENSE'] },
  { key: 'repairCogs', label: 'Repair Parts COGS', types: ['EXPENSE'] },
  { key: 'opex', label: 'Operating Expenses', types: ['EXPENSE'] },
  { key: 'cashVariance', label: 'Cash Over / Short', types: ['EXPENSE'] },
  { key: 'salesReturns', label: 'Sales Returns', types: ['INCOME'] },
  { key: 'retainedEarnings', label: 'Retained Earnings', types: ['EQUITY'] },
]

type GlAccount = { id: string; code: string; name: string; type: string }

type SettingsData = {
  baseCurrency: string
  autoPostEnabled: boolean
  vatEnabled: boolean
  requireApprovalAbove: number | null
  expenseCategoryMap: Record<string, string>
  defaultAccounts: Record<string, string>
}

export default function AccountingSettingsPage() {
  const hasAccess = useFeatureFlag('ACCOUNTING')
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [accounts, setAccounts] = useState<GlAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({})
  const [defaultAccounts, setDefaultAccounts] = useState<Record<string, string>>({})
  const [approvalAbove, setApprovalAbove] = useState('')
  const [autoPost, setAutoPost] = useState(true)
  const [vatEnabled, setVatEnabled] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sRes, coaRes] = await Promise.all([
        accountingApi.accountingSettings() as Promise<{ data: SettingsData }>,
        accountingApi.coaAccounts() as Promise<{ data: GlAccount[] }>,
      ])
      setSettings(sRes.data)
      setCategoryMap(sRes.data.expenseCategoryMap ?? {})
      setDefaultAccounts(sRes.data.defaultAccounts ?? {})
      setApprovalAbove(sRes.data.requireApprovalAbove != null ? String(sRes.data.requireApprovalAbove) : '')
      setAutoPost(sRes.data.autoPostEnabled)
      setVatEnabled(sRes.data.vatEnabled ?? false)
      setAccounts(coaRes.data ?? [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (hasAccess) load() }, [hasAccess, load])

  function accountsForField(types?: string[]) {
    if (!types?.length) return accounts
    return accounts.filter(a => types.includes(a.type))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await accountingApi.updateAccountingSettings({
        expenseCategoryMap: categoryMap,
        defaultAccounts,
        autoPostEnabled: autoPost,
        vatEnabled,
        requireApprovalAbove: approvalAbove ? Number(approvalAbove) : null,
      })
      toast.success('Accounting settings saved')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (!hasAccess) return <AccountingFeatureGate />

  return (
    <AccountingPageShell>
      <AccountingPageHeader
        title="Accounting Settings"
        subtitle="Default GL mappings, expense categories, approval threshold, auto-post"
        icon={Settings}
      />

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-violet-400" /></div>
      ) : settings && (
        <>
          <div className="grid xl:grid-cols-2 gap-6 w-full">
            <AccountingPanel title="General">
              <div className="p-5 space-y-4">
                <label className="flex items-center gap-3 text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={autoPost} onChange={e => setAutoPost(e.target.checked)} className="rounded" />
                  Auto-post enabled — journals post automatically when sales, purchases, repairs and expenses are recorded
                </label>
                <label className="flex items-start gap-3 text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={vatEnabled} onChange={e => setVatEnabled(e.target.checked)} className="rounded mt-0.5" />
                  <span>
                    VAT on repair journals — when on, repair receipts split 18% inclusive VAT to VAT Output Payable.
                    Leave off if the shop is not VAT-registered (full amount posts to Repair Income).
                  </span>
                </label>
                <label className="block">
                  <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Manual journal approval above (LKR)
                  </span>
                  <input
                    type="number"
                    value={approvalAbove}
                    onChange={e => setApprovalAbove(e.target.value)}
                    placeholder="Leave empty to post all immediately"
                    className="input-field"
                  />
                </label>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Base currency: {settings.baseCurrency}</p>
              </div>
            </AccountingPanel>

            <AccountingPanel title="Expense category → GL account">
              <div className="p-5 space-y-3">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Maps finance module expense categories to GL when auto-journaling.
                </p>
                {EXPENSE_CATEGORIES.map(cat => (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="w-24 text-sm shrink-0" style={{ color: 'var(--text-muted)' }}>{cat}</span>
                    <select
                      value={categoryMap[cat] ?? ''}
                      onChange={e => setCategoryMap(prev => ({ ...prev, [cat]: e.target.value }))}
                      className="input-field flex-1 text-sm"
                    >
                      <option value="">Default (Operating Expenses)</option>
                      {accounts.filter(a => a.type === 'EXPENSE').map(a => (
                        <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </AccountingPanel>
          </div>

          <AccountingPanel title="Default account mappings" icon={Shield}>
            <div className="p-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {DEFAULT_ACCOUNT_FIELDS.map(field => (
                <div key={field.key}>
                  <span className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{field.label}</span>
                  <select
                    value={defaultAccounts[field.key] ?? ''}
                    onChange={e => setDefaultAccounts(prev => ({ ...prev, [field.key]: e.target.value }))}
                    className="input-field text-sm w-full"
                  >
                    <option value="">— Not mapped —</option>
                    {accountsForField(field.types).map(a => (
                      <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </AccountingPanel>

          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save settings
          </button>
        </>
      )}
    </AccountingPageShell>
  )
}
