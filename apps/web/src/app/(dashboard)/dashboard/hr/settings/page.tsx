'use client'

import { Settings, Clock, Calendar, Briefcase, DollarSign } from 'lucide-react'
import { HrFeatureGate, HrPageShell } from '@/components/hr/hr-ui'

const COMING_SOON = [
  { icon: Clock, label: 'Attendance & shifts', phase: 'Phase 2' },
  { icon: Calendar, label: 'Leave management', phase: 'Phase 3' },
  { icon: DollarSign, label: 'Salary & commission', phase: 'Phase 4' },
  { icon: Briefcase, label: 'Payroll processing', phase: 'Phase 5–6' },
]

export default function HrSettingsPage() {
  return (
    <HrFeatureGate>
      <HrPageShell
        title="HR Settings"
        subtitle="Policies and module configuration"
        icon={Settings}
      >
        <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            HR policy defaults and configuration will be managed here in a later phase. Phase 1 covers employee master data, departments, and designations.
          </p>
          <div className="grid sm:grid-cols-2 gap-3 pt-2">
            {COMING_SOON.map(item => (
              <div key={item.label} className="flex items-start gap-3 p-3 rounded-lg opacity-70" style={{ background: 'var(--bg-subtle)' }}>
                <item.icon size={16} className="text-brand-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.label}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.phase}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </HrPageShell>
    </HrFeatureGate>
  )
}
