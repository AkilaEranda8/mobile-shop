'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { useRolePermissions } from '@/lib/hooks'
import type { RolePermissionModuleKey } from '@/lib/role-permissions'

export type ModuleAccessValue = {
  moduleKey: RolePermissionModuleKey | null
  canView: boolean
  canEdit: boolean
  isViewOnly: boolean
}

const ModuleAccessContext = createContext<ModuleAccessValue>({
  moduleKey: null,
  canView: true,
  canEdit: true,
  isViewOnly: false,
})

export function ModuleAccessProvider({
  moduleKey,
  children,
}: {
  moduleKey: RolePermissionModuleKey | null
  children: ReactNode
}) {
  const { canView, canEdit } = useRolePermissions()

  const value = useMemo<ModuleAccessValue>(() => {
    if (!moduleKey) {
      return { moduleKey: null, canView: true, canEdit: true, isViewOnly: false }
    }
    const view = canView(moduleKey)
    const edit = canEdit(moduleKey)
    return {
      moduleKey,
      canView: view,
      canEdit: edit,
      isViewOnly: view && !edit,
    }
  }, [moduleKey, canView, canEdit])

  return (
    <ModuleAccessContext.Provider value={value}>
      {value.isViewOnly && <ViewOnlyBanner />}
      {children}
    </ModuleAccessContext.Provider>
  )
}

/** Access for the current page module (from path). */
export function useModuleAccess(): ModuleAccessValue {
  return useContext(ModuleAccessContext)
}

/** Explicit module check (e.g. nested PRODUCT_COST). */
export function useCanEditModule(moduleKey: RolePermissionModuleKey): boolean {
  const { canEdit } = useRolePermissions()
  return canEdit(moduleKey)
}

export function EditOnly({ children }: { children: ReactNode }) {
  const { canEdit } = useModuleAccess()
  if (!canEdit) return null
  return <>{children}</>
}

export function viewOnlyToast(moduleLabel = 'this page') {
  toast.error(`You have view-only access to ${moduleLabel}`)
}

export function ViewOnlyBanner() {
  return (
    <div
      className="mb-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
      style={{
        borderColor: 'rgba(14, 165, 233, 0.35)',
        background: 'rgba(14, 165, 233, 0.1)',
        color: 'var(--text-primary)',
      }}
      role="status"
    >
      <Eye size={15} className="text-sky-600 dark:text-sky-400 flex-shrink-0" />
      <span>
        <span className="font-semibold text-sky-700 dark:text-sky-300">View only</span>
        <span className="opacity-80"> — you can browse this page but cannot add, edit, or delete.</span>
      </span>
    </div>
  )
}
