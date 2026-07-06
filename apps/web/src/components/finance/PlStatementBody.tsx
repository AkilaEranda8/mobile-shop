'use client'

import { formatCurrency } from '@/lib/utils'
import { buildCsvContent } from '@/lib/repair-statement.util'
import { Download } from 'lucide-react'

export type PlStatementLine = {
  section: 'income' | 'cost' | 'profit' | 'note'
  label: string
  amount?: number
  bold?: boolean
  highlight?: boolean
  indent?: boolean
  separator?: boolean
}

export function PlStatementBody({
  lines,
  exportFilename,
  footer,
}: {
  lines: PlStatementLine[]
  exportFilename?: string
  footer?: React.ReactNode
}) {
  const exportRows = lines
    .filter((r) => r.amount !== undefined)
    .map((r) => [r.label, r.amount!.toFixed(2)])

  const handleExport = () => {
    if (!exportFilename) return
    const csv = buildCsvContent(['Item', 'Amount (LKR)'], exportRows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = exportFilename
    a.click()
  }

  return (
    <>
      {exportFilename && (
        <div className="flex justify-end mb-3">
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1.5 text-xs hover:text-violet-600 dark:hover:text-violet-400 border px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}
          >
            <Download size={12} /> Export CSV
          </button>
        </div>
      )}
      <div className="overflow-hidden rounded-xl" style={{ border: '1px solid var(--border-subtle)' }}>
        {lines.map((row, i) => {
          const isNote = row.section === 'note'
          const isCost = row.section === 'cost'
          const isProfit = row.section === 'profit'
          const amount = row.amount ?? 0
          const colorClass = isNote
            ? 'var(--text-muted)'
            : isCost
              ? 'text-red-600 dark:text-red-400'
              : isProfit && amount < 0
                ? 'text-red-600 dark:text-red-400'
                : isProfit && row.highlight
                  ? 'text-violet-600 dark:text-violet-400'
                  : 'text-green-600 dark:text-green-400'

          return (
            <div
              key={`${row.label}-${i}`}
              className={['flex justify-between items-center px-4 py-2.5', row.bold ? 'font-semibold' : ''].join(' ')}
              style={{
                borderTop: row.separator ? '2px solid var(--border-default)' : i > 0 ? '1px solid var(--border-subtle)' : 'none',
                background: row.bold && !isNote ? 'var(--bg-subtle)' : 'transparent',
              }}
            >
              <span
                className={`text-sm ${row.indent ? 'pl-5' : ''}`}
                style={{ color: isNote ? 'var(--text-muted)' : row.bold ? 'var(--text-primary)' : 'var(--text-secondary)' }}
              >
                {row.label}
              </span>
              {row.amount !== undefined ? (
                <span className={`text-sm font-semibold ${row.bold ? 'text-base' : ''}`} style={{ color: colorClass }}>
                  {isCost ? `(${formatCurrency(amount)})` : formatCurrency(amount)}
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
      {footer}
    </>
  )
}
