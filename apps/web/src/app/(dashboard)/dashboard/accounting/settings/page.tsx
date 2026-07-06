'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Save, Settings } from 'lucide-react'
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

type GlAccount = { id: string; code: string; name: string; type: string }

type SettingsData = {
  baseCurrency: string
  autoPostEnabled: boolean
  requireApprovalAbove: number | null
  expenseCategoryMap: Record<string, string>
}

export default function AccountingSettingsPage() {
  const hasAccess = useFeatureFlag('ACCOUNTING')
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [accounts, setAccounts] = useState<GlAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({})
  const [approvalAbove, setApprovalAbove] = useState('')
  const [autoPost, setAutoPost] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sRes, coaRes] = await Promise.all([
        accountingApi.accountingSettings() as Promise<{ data: SettingsData }>,
        accountingApi.coaAccounts() as Promise<{ data: GlAccount[] }>,
      ])
      setSettings(sRes.data)
      setCategoryMap(sRes.data.expenseCategoryMap ?? {})
      setApprovalAbove(sRes.data.requireApprovalAbove != null ? String(sRes.data.requireApprovalAbove) : '')
      setAutoPost(sRes.data.autoPostEnabled)
      setAccounts((coaRes.data ?? []).filter(a => a.type === 'EXPENSE'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (hasAccess) load() }, [hasAccess, load])

  async function handleSave() {
    setSaving(true)
    try {
      await accountingApi.updateAccountingSettings({
        expenseCategoryMap: categoryMap,
        autoPostEnabled: autoPost,
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
        subtitle="Expense GL mapping, approval threshold, auto-post"
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
                  Auto-post enabled (outbox processor)
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
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </AccountingPanel>
          </div>

          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save settings
          </button>
        </>
      )}
    </AccountingPageShell>
  )
}
