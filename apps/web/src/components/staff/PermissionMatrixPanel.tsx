'use client'

import { useState, useEffect } from 'react'
import { Loader2, Eye, EyeOff, Save, CheckCircle } from 'lucide-react'
import { tenantApi } from '@/lib/api'
import { authStorage } from '@/lib/auth'
import toast from 'react-hot-toast'
import {
  ROLE_PERMISSION_MODULES,
  STAFF_ROLES,
  ACCESS_LEVEL_META,
  DEFAULT_ROLE_PERMISSIONS,
  normalizeRolePermissions,
  type RoleAccessLevel,
  type RolePermissionMatrix,
  type StaffRole,
  type RolePermissionModuleKey,
} from '@/lib/role-permissions'

const roleLabels: Record<string, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  TECHNICIAN: 'Technician',
  CASHIER: 'Cashier',
}

function cycleAccess(current: RoleAccessLevel): RoleAccessLevel {
  if (current === 'hide') return 'view'
  if (current === 'view') return 'edit'
  return 'hide'
}

function AccessCell({
  level,
  locked,
  onChange,
}: {
  level: RoleAccessLevel
  locked?: boolean
  onChange?: (next: RoleAccessLevel) => void
}) {
  const meta = ACCESS_LEVEL_META[level]
  const Icon = level === 'hide' ? EyeOff : level === 'view' ? Eye : CheckCircle
  if (locked || !onChange) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold ${meta.className}`}
        title={meta.label}
      >
        <Icon size={12} />
        {meta.label}
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={() => onChange(cycleAccess(level))}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold transition hover:brightness-110 ${meta.className}`}
      title={`Click to cycle: Hide → View → Edit (now ${meta.label})`}
    >
      <Icon size={12} />
      {meta.label}
    </button>
  )
}

export function PermissionMatrixPanel({ canEdit }: { canEdit: boolean }) {
  const [matrix, setMatrix] = useState<RolePermissionMatrix>(DEFAULT_ROLE_PERMISSIONS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const tenantId = authStorage.getUser()?.tenantId

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!tenantId) {
        setLoading(false)
        return
      }
      try {
        const res: any = await tenantApi.getRolePermissions(tenantId)
        if (cancelled) return
        setMatrix(normalizeRolePermissions(res?.data ?? res))
        setDirty(false)
      } catch {
        if (!cancelled) toast.error('Failed to load permission matrix')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [tenantId])

  const setCell = (role: StaffRole, key: RolePermissionModuleKey, level: RoleAccessLevel) => {
    if (role === 'OWNER') return
    setMatrix((prev) => ({
      ...prev,
      [role]: { ...prev[role], [key]: level },
    }))
    setDirty(true)
  }

  const handleSave = async () => {
    if (!tenantId || !canEdit) return
    setSaving(true)
    try {
      const res: any = await tenantApi.updateRolePermissions(tenantId, matrix)
      const next = normalizeRolePermissions(res?.data ?? res)
      setMatrix(next)
      setDirty(false)
      try {
        const raw = localStorage.getItem('hx_user')
        const user = raw ? JSON.parse(raw) as { id?: string; tenantId?: string } : null
        if (user?.id && user?.tenantId) {
          localStorage.setItem(`hx_role_permissions:${user.tenantId}:${user.id}`, JSON.stringify(next))
        }
      } catch { /* noop */ }
      window.dispatchEvent(new Event('role-permissions-updated'))
      toast.success('Permission matrix saved')
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save permissions')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setMatrix(DEFAULT_ROLE_PERMISSIONS)
    setDirty(true)
  }

  if (loading) {
    return (
      <div className="card p-8 flex items-center justify-center gap-2 text-sm text-slate-500">
        <Loader2 size={16} className="animate-spin" /> Loading permission matrix…
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Permission levels</h3>
          <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">
            {canEdit
              ? 'Click a cell: Hide → View → Edit, then Save. Owner column stays full access.'
              : 'Hide removes the feature. View is read-only. Edit is full use. Only the owner can change this matrix.'}
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button type="button" onClick={handleReset} className="btn-secondary text-xs px-3 py-1.5">
              Reset defaults
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving}
              className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Save
            </button>
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-b border-white/5 flex flex-wrap gap-3 text-[11px] text-slate-500">
        {(['hide', 'view', 'edit'] as RoleAccessLevel[]).map((lvl) => (
          <span key={lvl} className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 ${ACCESS_LEVEL_META[lvl].className}`}>
            {ACCESS_LEVEL_META[lvl].label}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-white/5">
              <th className="table-header text-left">Feature</th>
              {STAFF_ROLES.map((role) => (
                <th key={role} className="table-header text-center">
                  {roleLabels[role] ?? role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/3">
            {ROLE_PERMISSION_MODULES.map((mod) => (
              <tr key={mod.key} className="hover:bg-white/2">
                <td className="table-cell text-sm font-medium text-gray-700 dark:text-slate-300">
                  <div>{mod.label}</div>
                  {mod.key === 'PRODUCT_COST' && (
                    <p className="text-[10px] font-normal text-slate-500 mt-0.5">
                      Buying price &amp; margin. Set View/Edit on staff columns to enable for them.
                    </p>
                  )}
                </td>
                {STAFF_ROLES.map((role) => (
                  <td key={role} className="table-cell text-center">
                    <AccessCell
                      level={matrix[role][mod.key]}
                      locked={role === 'OWNER' || !canEdit}
                      onChange={
                        role === 'OWNER' || !canEdit
                          ? undefined
                          : (next) => setCell(role, mod.key, next)
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dirty && canEdit && (
        <div className="px-4 py-2 border-t border-amber-500/20 bg-amber-500/5 text-xs text-amber-300">
          Unsaved changes — click Save to apply for all staff.
        </div>
      )}
    </div>
  )
}
