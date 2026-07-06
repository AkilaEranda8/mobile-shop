'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Settings, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { useFeatureFlag } from '@/lib/hooks'
import { accountingApi } from '@/lib/api'

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

  if (!hasAccess) {
    return <div className="p-6 text-center text-slate-400"><Link href="/settings" className="text-violet-400">Enable Accounting</Link></div>
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/accounting" className="text-slate-400 hover:text-white"><ArrowLeft size={20} /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Settings className="text-violet-400" size={26} /> Accounting Settings
          </h1>
          <p className="text-sm text-slate-400 mt-1">Expense GL mapping, approval threshold, auto-post</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-violet-400" /></div>
      ) : settings && (
        <div className="space-y-6">
          <div className="rounded-xl border border-white/10 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white">General</h2>
            <label className="flex items-center gap-3 text-sm text-slate-300">
              <input type="checkbox" checked={autoPost} onChange={e => setAutoPost(e.target.checked)} />
              Auto-post enabled (outbox processor)
            </label>
            <label className="block">
              <span className="text-xs text-slate-500">Manual journal approval above (LKR)</span>
              <input type="number" value={approvalAbove} onChange={e => setApprovalAbove(e.target.value)}
                placeholder="Leave empty to post all immediately"
                className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm" />
            </label>
          </div>

          <div className="rounded-xl border border-white/10 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-white">Expense category → GL account</h2>
            <p className="text-xs text-slate-500">Maps finance module expense categories to GL when auto-journaling.</p>
            {EXPENSE_CATEGORIES.map(cat => (
              <div key={cat} className="flex items-center gap-3">
                <span className="w-24 text-sm text-slate-400">{cat}</span>
                <select
                  value={categoryMap[cat] ?? ''}
                  onChange={e => setCategoryMap(prev => ({ ...prev, [cat]: e.target.value }))}
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm"
                >
                  <option value="">Default (Operating Expenses)</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <button type="button" onClick={handleSave} disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save settings
          </button>
        </div>
      )}
    </div>
  )
}
