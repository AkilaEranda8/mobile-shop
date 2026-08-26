'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock, Loader2, LogIn, LogOut, UserCheck, Timer, Moon, UserX, MoreHorizontal } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import toast from 'react-hot-toast'
import { hrApi } from '@/lib/api'
import { useModuleAccess } from '@/lib/module-access'
import { cn } from '@/lib/utils'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { TableActionsRow } from '@/components/table/table-actions-row'
import {
  HrFeatureGate,
  HrPageShell,
  HrError,
  HrStatCard,
  HrModal,
  HrModalCancel,
  HrModalSubmit,
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
      if (mine?.data) setMyToday(mine.data as typeof myToday)
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

  const columns = useMemo<ColumnDef<BoardRow>[]>(() => {
    const cols: ColumnDef<BoardRow>[] = [
      {
        id: 'employee',
        accessorFn: r => r.employee.fullName,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Employee" />,
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{row.original.employee.fullName}</p>
            <p className="text-xs font-mono text-gray-500 dark:text-slate-500">{row.original.employee.employeeCode}</p>
          </div>
        ),
      },
      {
        id: 'branch',
        accessorFn: r => r.employee.primaryBranch?.name ?? '',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Branch" />,
        cell: ({ row }) => (
          <span className="text-gray-500 dark:text-slate-400">{row.original.employee.primaryBranch?.name ?? '—'}</span>
        ),
      },
      {
        id: 'shift',
        accessorFn: r => r.attendance?.shift?.name ?? '',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Shift" />,
        cell: ({ row }) => (
          <span className="text-gray-500 dark:text-slate-400">{row.original.attendance?.shift?.name ?? '—'}</span>
        ),
      },
      {
        id: 'inout',
        accessorFn: r => r.attendance?.checkInAt ?? '',
        header: ({ column }) => <DataTableColumnHeader column={column} title="In / Out" />,
        cell: ({ row }) => (
          <span className="text-gray-500 dark:text-slate-400">
            {fmtTime(row.original.attendance?.checkInAt)} / {fmtTime(row.original.attendance?.checkOutAt)}
          </span>
        ),
      },
      {
        id: 'worked',
        accessorFn: r => r.attendance?.workedMinutes ?? 0,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Worked" />,
        cell: ({ row }) => (
          <span className="text-gray-500 dark:text-slate-400">
            {fmtMins(row.original.attendance?.workedMinutes ?? 0)}
            {(row.original.attendance?.lateMinutes ?? 0) > 0 && (
              <span className="text-amber-400 text-xs ml-1">+{row.original.attendance!.lateMinutes}m late</span>
            )}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => (
          <span className={cn('text-xs px-2 py-0.5 rounded-full border', STATUS_STYLE[row.original.status] ?? STATUS_STYLE.ABSENT)}>
            {row.original.status}
          </span>
        ),
      },
    ]
    if (canEdit) {
      cols.push({
        id: 'actions',
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <TableActionsRow editAction={{ action: () => openCorrect(row.original) }} />
        ),
      })
    }
    return cols
  }, [canEdit])

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
          <div className="card px-4 py-3 text-sm flex flex-wrap gap-4 items-center">
            <span className="text-gray-500 dark:text-slate-500">My today ({myToday.employee.fullName}):</span>
            <span className={cn('text-xs px-2 py-0.5 rounded-full border', STATUS_STYLE[mine?.status ?? 'ABSENT'])}>
              {mine?.status ?? 'ABSENT'}
            </span>
            <span className="text-gray-500 dark:text-slate-500">In {fmtTime(mine?.checkInAt)} · Out {fmtTime(mine?.checkOutAt)}</span>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <HrStatCard label="Present" value={summary.present} icon={UserCheck} color="emerald" />
          <HrStatCard label="Late" value={summary.late} icon={Timer} color="amber" />
          <HrStatCard label="Half day" value={summary.halfDay} icon={Moon} color="sky" />
          <HrStatCard label="Absent" value={summary.absent} icon={UserX} color="red" />
          <HrStatCard label="Other" value={summary.other} icon={MoreHorizontal} color="slate" />
        </div>

        {error && <HrError message={error} />}
        {!error && (
          <ClientSideTable
            data={rows}
            columns={columns}
            isLoading={loading}
            pageCount={Math.ceil((rows.length || 1) / 20)}
            searchableColumns={[]}
          />
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
              <HrModalCancel onClick={() => setCorrectRow(null)} disabled={correctLoading} />
              <HrModalSubmit form="hr-att-correct" loading={correctLoading}>
                Save
              </HrModalSubmit>
            </>
          )}
        >
          <form id="hr-att-correct" onSubmit={submitCorrect} className="space-y-3">
            <HrField label="Status">
              <select className="input-field h-11 w-full" value={correctForm.status} onChange={e => setCorrectForm(p => ({ ...p, status: e.target.value }))}>
                {['PRESENT', 'LATE', 'HALF_DAY', 'ABSENT', 'ON_LEAVE', 'HOLIDAY'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </HrField>
            <div className="grid grid-cols-2 gap-3">
              <HrField label="Check in">
                <input type="datetime-local" className="input-field h-11 w-full" value={correctForm.checkInAt} onChange={e => setCorrectForm(p => ({ ...p, checkInAt: e.target.value }))} />
              </HrField>
              <HrField label="Check out">
                <input type="datetime-local" className="input-field h-11 w-full" value={correctForm.checkOutAt} onChange={e => setCorrectForm(p => ({ ...p, checkOutAt: e.target.value }))} />
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
