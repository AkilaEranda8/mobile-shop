'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { emiLockerApi } from '@/lib/api'
import { PageHeader } from '@/components/design-system/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { unwrap } from '@/components/emi-locker/EmiLockerPages'
import { useRolePermissions } from '@/lib/hooks'
import { Shield } from 'lucide-react'

type Policy = {
  id: string
  name: string
  kind: string
  isDefault: boolean
  isActive: boolean
  amapiPolicyName?: string | null
}

export default function EmiLockerPoliciesPage() {
  const perms = useRolePermissions()
  const canEdit = perms.canEdit('EMI_LOCKER')
  const [rows, setRows] = useState<Policy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'ACTIVE' | 'WARNING' | 'RESTRICTED' | 'RELEASED'>('RESTRICTED')

  async function load() {
    try {
      setLoading(true)
      setRows(unwrap<Policy[]>(await emiLockerApi.policies()) || [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load policies')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function create() {
    try {
      await emiLockerApi.createPolicy({ name, kind, isActive: true })
      toast.success('Policy created')
      setName('')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed')
    }
  }

  async function toggleActive(p: Policy) {
    try {
      await emiLockerApi.updatePolicy(p.id, { isActive: !p.isActive })
      toast.success('Policy updated')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Device policies"
        description="Supported managed-device policy templates (ACTIVE / WARNING / RESTRICTED / RELEASED). Unsupported Android settings are not exposed."
      />
      {canEdit && (
        <div className="flex flex-wrap gap-2 rounded-xl border p-4" style={{ borderColor: 'var(--border-subtle)' }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Policy name"
            className="w-full min-w-0 rounded-lg border bg-transparent px-3 py-2 text-sm sm:w-auto sm:min-w-[12rem]"
            style={{ borderColor: 'var(--border-subtle)' }}
          />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
            className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm sm:w-auto"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="WARNING">WARNING</option>
            <option value="RESTRICTED">RESTRICTED</option>
            <option value="RELEASED">RELEASED</option>
          </select>
          <button type="button" disabled={!name.trim()} onClick={() => void create()} className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-40">
            Create
          </button>
        </div>
      )}
      {loading && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</p>}
      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
      {!loading && !rows.length && !error && <EmptyState icon={Shield} title="No policies" description="Default policies are created when you register the first device." />}
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border-subtle)' }}>
          <table className="min-w-full text-sm">
            <thead style={{ color: 'var(--text-secondary)' }}>
              <tr className="border-b text-left" style={{ borderColor: 'var(--border-subtle)' }}>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Default</th>
                <th className="px-4 py-3 font-medium">Active</th>
                <th className="px-4 py-3 font-medium">AMAPI name</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                  <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>{p.name}</td>
                  <td className="px-4 py-3">{p.kind}</td>
                  <td className="px-4 py-3">{p.isDefault ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3">{p.isActive ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3">{p.amapiPolicyName || '—'}</td>
                  <td className="px-4 py-3">
                    {canEdit && (
                      <button type="button" onClick={() => void toggleActive(p)} className="text-brand-400 hover:underline">
                        {p.isActive ? 'Disable' : 'Enable'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
