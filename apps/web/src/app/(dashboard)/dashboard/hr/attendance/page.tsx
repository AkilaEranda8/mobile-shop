'use client'

import { useCallback, useEffect, useState } from 'react'
import { Clock, Loader2, LogIn, LogOut, Edit2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { hrApi } from '@/lib/api'
import { useModuleAccess } from '@/lib/module-access'
import { cn } from '@/lib/utils'
import {
  HrFeatureGate,
  HrPageShell,
  HrLoading,
  HrError,
  HrKpiCard,
  HrModal,
  HrField,
} from '@/components/hr/hr-ui'

type BoardRow = {
  employee: {
    id: string
    fullName: string
    employeeCode: string
    primaryBranch?: { id: string; name: string }
  }
  status: string
  attendance: {
    id: string
    checkInAt: string | null
    checkOutAt: string | null
    workedMinutes: number
    lateMinutes: number
    overtimeMinutes: number
    status: string
    shift?: { id: string; name: string } | null
  } | null
}

const STATUS_STYLE: Record<string, string> = {
  PRESENT: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  LATE: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  HALF_DAY: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  ABSENT: 'bg-red-500/15 text-red-300 border-red-500/30',
  ON_LEAVE: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  HOLIDAY: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
}

function fmtTime(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function fmtMins(m: number) {
  if (!m) return '—'
  const h = Math.floor(m / 60)
  const min = m % 60
  return h ? `${h}h ${min}m` : `${min}m`
}

function todayKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' })
}

export default function HrAttendancePage() {
  const { canEdit } = useModuleAccess()
  const [date, setDate] = useState(todayKey)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState({ present: 0, late: 0, halfDay: 0, absent: 0, other: 0 })
  const [rows, setRows] = useState<BoardRow[]>([])
  const [punchLoading, setPunchLoading] = useState(false)
  const [myToday, setMyToday] = useState<{
    attendance: { checkInAt: string | null; checkOutAt: string | null; status: string } | null
    employee: { id: string; fullName: string }
  } | null>(null)
  const [correctRow, setCorrectRow] = useState<BoardRow | null>(null)
  const [correctForm, setCorrectForm] = useState({ status: 'ABSENT', note: '', checkInAt: '', checkOutAt: '' })
  const [correctLoading, setCorrectLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [board, mine] = await Promise.all([
        hrApi.attendanceBoard({ date }) as Promise<{ data: { summary: typeof summary; rows: BoardRow[] } }>,
        hrApi.attendanceMyToday().catch(() => null) as Promise<{ data: typeof myToday } | null>,
      ])
      setSummary(board.data.summary)
      setRows(board.data.rows)
      if (mine?.data) setMyToday(mine.data as any)
    } catch (e: unknown) {
      setError((e as Error)?.message ?? 'Failed to load attendance')
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => { void load() }, [load])

  const punch = async (action: 'in' | 'out') => {
    setPunchLoading(true)
    try {
      if (action === 'in') await hrApi.attendanceCheckIn()
      else await hrApi.attendanceCheckOut()
      toast.success(action === 'in' ? 'Checked in' : 'Checked out')
      await load()
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? 'Punch failed')
    } finally {
      setPunchLoading(false)
    }
  }

  const openCorrect = (row: BoardRow) => {
    setCorrectRow(row)
    const a = row.attendance
    setCorrectForm({
      status: a?.status ?? row.status ?? 'ABSENT',
      note: '',
      checkInAt: a?.checkInAt ? a.checkInAt.slice(0, 16) : '',
      checkOutAt: a?.checkOutAt ? a.checkOutAt.slice(0, 16) : '',
    })
  }

  const submitCorrect = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!correctRow) return
    setCorrectLoading(true)
    try {
      await hrApi.attendanceCorrect({
        employeeId: correctRow.employee.id,
        date,
        status: correctForm.status,
        note: correctForm.note || null,
        checkInAt: correctForm.checkInAt ? new Date(correctForm.checkInAt).toISOString() : null,
        checkOutAt: correctForm.checkOutAt ? new Date(correctForm.checkOutAt).toISOString() : null,
      })
      toast.success('Attendance corrected')
      setCorrectRow(null)
      await load()
    } catch (err: unknown) {
      toast.error((err as Error)?.message ?? 'Correction failed')
    } finally {
      setCorrectLoading(false)
    }
  }

  const mine = myToday?.attendance

  return (
    <HrFeatureGate>
      <HrPageShell
        title="Attendance"
        subtitle="Daily board · Colombo business date"
        icon={Clock}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              className="input-field text-sm"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
            <button
              type="button"
              disabled={punchLoading || !!mine?.checkInAt}
              onClick={() => void punch('in')}
              className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {punchLoading ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
              Check in
            </button>
            <button
              type="button"
              disabled={punchLoading || !mine?.checkInAt || !!mine?.checkOutAt}
              onClick={() => void punch('out')}
              className="btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              <LogOut size={14} /> Check out
            </button>
          </div>
        )}
      >
        {myToday && (
          <div className="rounded-xl px-4 py-3 text-sm flex flex-wrap gap-4 items-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <span style={{ color: 'var(--text-muted)' }}>My today ({myToday.employee.fullName}):</span>
            <span className={cn('text-xs px-2 py-0.5 rounded-full border', STATUS_STYLE[mine?.status ?? 'ABSENT'])}>
              {mine?.status ?? 'ABSENT'}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>In {fmtTime(mine?.checkInAt)} · Out {fmtTime(mine?.checkOutAt)}</span>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <HrKpiCard label="Present" value={summary.present} />
          <HrKpiCard label="Late" value={summary.late} />
          <HrKpiCard label="Half day" value={summary.halfDay} />
          <HrKpiCard label="Absent" value={summary.absent} />
          <HrKpiCard label="Other" value={summary.other} />
        </div>

        {loading && <HrLoading />}
        {!loading && error && <HrError message={error} />}
        {!loading && !error && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            <table className="w-full text-sm">
              <thead style={{ background: 'var(--bg-subtle)' }}>
                <tr>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Employee</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Branch</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Shift</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>In / Out</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Worked</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Status</th>
                  {canEdit && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.employee.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td className="px-4 py-3">
                      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{row.employee.fullName}</p>
                      <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{row.employee.employeeCode}</p>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{row.employee.primaryBranch?.name ?? '—'}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{row.attendance?.shift?.name ?? '—'}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                      {fmtTime(row.attendance?.checkInAt)} / {fmtTime(row.attendance?.checkOutAt)}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                      {fmtMins(row.attendance?.workedMinutes ?? 0)}
                      {(row.attendance?.lateMinutes ?? 0) > 0 && (
                        <span className="text-amber-400 text-xs ml-1">+{row.attendance!.lateMinutes}m late</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full border', STATUS_STYLE[row.status] ?? STATUS_STYLE.ABSENT)}>
                        {row.status}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => openCorrect(row)} className="p-1.5 rounded-lg hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
                          <Edit2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={canEdit ? 7 : 6} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                      No active employees for this branch/date
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </HrPageShell>

      {correctRow && (
        <HrModal
          title="Correct attendance"
          subtitle={`${correctRow.employee.fullName} · ${date}`}
          icon={Clock}
          onClose={() => setCorrectRow(null)}
          footer={(
            <>
              <button type="button" className="btn-secondary text-sm px-4" onClick={() => setCorrectRow(null)}>Cancel</button>
              <button type="submit" form="hr-att-correct" disabled={correctLoading} className="btn-primary text-sm px-4 flex items-center gap-2">
                {correctLoading && <Loader2 size={14} className="animate-spin" />} Save
              </button>
            </>
          )}
        >
          <form id="hr-att-correct" onSubmit={submitCorrect} className="space-y-3">
            <HrField label="Status">
              <select className="input-field w-full" value={correctForm.status} onChange={e => setCorrectForm(p => ({ ...p, status: e.target.value }))}>
                {['PRESENT', 'LATE', 'HALF_DAY', 'ABSENT', 'ON_LEAVE', 'HOLIDAY'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </HrField>
            <div className="grid grid-cols-2 gap-3">
              <HrField label="Check in">
                <input type="datetime-local" className="input-field w-full" value={correctForm.checkInAt} onChange={e => setCorrectForm(p => ({ ...p, checkInAt: e.target.value }))} />
              </HrField>
              <HrField label="Check out">
                <input type="datetime-local" className="input-field w-full" value={correctForm.checkOutAt} onChange={e => setCorrectForm(p => ({ ...p, checkOutAt: e.target.value }))} />
              </HrField>
            </div>
            <HrField label="Note">
              <textarea className="input-field w-full min-h-[64px]" value={correctForm.note} onChange={e => setCorrectForm(p => ({ ...p, note: e.target.value }))} />
            </HrField>
          </form>
        </HrModal>
      )}
    </HrFeatureGate>
  )
}
