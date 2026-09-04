'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Briefcase, Users, Building2, Contact2, Settings, Clock, Calendar, Plane,
  DollarSign, TrendingUp, Wallet, Receipt, CreditCard, UserCheck, UserPlus,
} from 'lucide-react'
import { hrApi } from '@/lib/api'
import {
  HrFeatureGate,
  HrPageShell,
  HrStatCard,
  HrQuickLink,
  HrLoading,
  HrError,
} from '@/components/hr/hr-ui'

type HrOverview = {
  total: number
  active: number
  candidate: number
  onLeave: number
  departments: number
  designations: number
  byBranch: Array<{ branchId: string; branchName: string; count: number }>
}

export default function HrOverviewPage() {
  const [data, setData] = useState<HrOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await hrApi.overview() as { data: HrOverview }
      setData(res.data)
    } catch (e: unknown) {
      setError((e as Error)?.message ?? 'Failed to load HR overview')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <HrFeatureGate>
      <HrPageShell
        title="HR Overview"
        subtitle="Employee records, departments, and designations"
        icon={Briefcase}
      >
        {loading && <HrLoading />}
        {!loading && error && <HrError message={error} />}
        {!loading && !error && data && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <HrStatCard label="Total employees" value={data.total} icon={Users} color="violet" />
              <HrStatCard label="Active" value={data.active} icon={UserCheck} color="emerald" />
              <HrStatCard label="Candidates" value={data.candidate} icon={UserPlus} color="sky" />
              <HrStatCard label="On leave" value={data.onLeave} icon={Plane} color="amber" />
              <HrStatCard label="Departments" value={data.departments} icon={Building2} color="blue" />
              <HrStatCard label="Designations" value={data.designations} icon={Contact2} color="slate" />
            </div>

            {data.byBranch.length > 0 && (
              <div className="card p-4">
                <h3 className="text-sm font-semibold mb-3 text-gray-900 dark:text-white">Employees by branch</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {data.byBranch.map(b => (
                    <div key={b.branchId} className="flex justify-between text-sm px-3 py-2 rounded-lg" style={{ background: 'var(--bg-subtle)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{b.branchName}</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{b.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <HrQuickLink href="/dashboard/hr/employees" icon={Users} label="Employees" description="Manage employee profiles" />
              <HrQuickLink href="/dashboard/hr/departments" icon={Building2} label="Departments" description="Organize teams" />
              <HrQuickLink href="/dashboard/hr/designations" icon={Contact2} label="Designations" description="Job titles & roles" />
              <HrQuickLink href="/dashboard/hr/attendance" icon={Clock} label="Attendance" description="Daily check-in board" />
              <HrQuickLink href="/dashboard/hr/shifts" icon={Calendar} label="Shifts" description="Shift windows & assignments" />
              <HrQuickLink href="/dashboard/hr/leave" icon={Plane} label="Leave" description="Requests, balances & approval" />
              <HrQuickLink href="/dashboard/hr/salary" icon={DollarSign} label="Salary" description="Packages & components" />
              <HrQuickLink href="/dashboard/hr/commission" icon={TrendingUp} label="Commission" description="Sales / repair / van-rep incentive preview" />
              <HrQuickLink href="/dashboard/hr/payroll" icon={Wallet} label="Payroll" description="Runs draft → approve → pay" />
              <HrQuickLink href="/dashboard/hr/payslips" icon={Receipt} label="Payslips" description="Processed slip snapshots" />
              <HrQuickLink href="/dashboard/hr/advances" icon={CreditCard} label="Advances" description="Advances & loan recoveries" />
              <HrQuickLink href="/dashboard/hr/settings" icon={Settings} label="HR Settings" description="Policies & defaults" />
            </div>
          </>
        )}
      </HrPageShell>
    </HrFeatureGate>
  )
}
