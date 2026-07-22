'use client'

import Link from 'next/link'
import { Shield, ArrowLeft, Users } from 'lucide-react'
import { authStorage } from '@/lib/auth'
import { PermissionMatrixPanel } from '@/components/staff/PermissionMatrixPanel'

export default function RolePermissionsPage() {
  const actorRole = authStorage.getUser()?.role
  const canEditMatrix = actorRole === 'OWNER' || actorRole === 'PLATFORM_ADMIN'

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
              <Shield size={15} className="text-violet-400" />
            </div>
            <h1 className="page-title">Role Permissions</h1>
          </div>
          <p className="page-subtitle">
            Control which modules each role can Hide, View, or Edit. Changes apply to all staff with that role.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          <Link
            href="/dashboard/staff"
            className="btn-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1.5"
          >
            <Users size={13} />
            Staff list
          </Link>
          <Link
            href="/dashboard/role-permissions-guide"
            className="btn-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1.5"
          >
            How to set this up
          </Link>
        </div>
      </div>

      {!canEditMatrix && (
        <div
          className="rounded-xl border px-4 py-3 text-sm"
          style={{
            borderColor: 'rgba(14, 165, 233, 0.35)',
            background: 'rgba(14, 165, 233, 0.1)',
            color: 'var(--text-primary)',
          }}
        >
          You can browse this matrix, but only an Owner can change permissions.
        </div>
      )}

      <PermissionMatrixPanel canEdit={canEditMatrix} />

      <Link
        href="/dashboard/staff"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-violet-400 transition-colors"
      >
        <ArrowLeft size={12} />
        Back to Staff &amp; Roles
      </Link>
    </div>
  )
}
