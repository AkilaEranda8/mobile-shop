import * as XLSX from 'xlsx'

export type AllocationLine = {
  fundName: string
  fundType: string
  value: number
  categoryCost?: number
  pctAllocation?: number
  todayAllocation: number
  yesterdayBalance: number
  totalBalance: number
  withdrawn: number
  deposits?: number
  adjustments?: number
  remainingBalance: number
}

const TABLE_HEADERS = [
  'Fund Name',
  'Fund Type',
  'Configured Value',
  "Today's Allocation",
  'Yesterday Balance',
  'Total Balance',
  'Withdrawn',
  'Remaining Balance',
]

/** Prevent CSV/Excel formula injection (=, +, -, @, tab, CR). */
function sanitizeSpreadsheetCell(value: string | number): string | number {
  if (typeof value === 'number') return value
  const s = String(value ?? '')
  if (/^[=+\-@\t\r]/.test(s)) return `'${s}`
  return s
}

function escapeHtml(value: string | number): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function lineRow(l: AllocationLine) {
  return [
    sanitizeSpreadsheetCell(l.fundName),
    sanitizeSpreadsheetCell(l.fundType),
    l.value,
    l.todayAllocation,
    l.yesterdayBalance,
    l.totalBalance,
    l.withdrawn,
    l.remainingBalance,
  ]
}

function csvEscape(cell: string | number): string {
  const s = String(cell ?? '')
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function exportAllocationCsv(
  lines: AllocationLine[],
  meta: { date: string; todaySales: number; todayProfit: number },
) {
  const rows = lines.map(lineRow)
  const csv = [
  `Profit Allocation — ${meta.date}`,
  `Today's Sales: ${meta.todaySales}`,
  `Today's Profit: ${meta.todayProfit}`,
  'Formula: Yesterday + Allocation = Total; Total − Withdrawn + Deposits ± Adjustments = Remaining',
  '',
  TABLE_HEADERS.join(','),
  ...rows.map(r => r.map(csvEscape).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `profit-allocation-${meta.date}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function exportAllocationExcel(
  lines: AllocationLine[],
  meta: { date: string; todaySales: number; todayProfit: number; totalAllocated: number; remainingProfit: number },
) {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Profit Allocation Report', meta.date],
    ['Today Sales', meta.todaySales],
    ['Today Profit', meta.todayProfit],
    ['Total Allocated', meta.totalAllocated],
    ['Remaining Profit', meta.remainingProfit],
    ['Running Balance', 'Yesterday + Allocation = Total; Total − Withdrawn + Deposits ± Adjustments = Remaining'],
    [],
    TABLE_HEADERS,
    ...lines.map(lineRow),
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Allocation')
  XLSX.writeFile(wb, `profit-allocation-${meta.date}.xlsx`)
}

export function exportAllocationPdf(
  lines: AllocationLine[],
  meta: { date: string; todaySales: number; todayProfit: number; totalAllocated: number; remainingProfit: number },
) {
  const html = `
    <html><head><title>Profit Allocation ${escapeHtml(meta.date)}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
      h1 { font-size: 18px; margin-bottom: 4px; }
      .meta { font-size: 12px; color: #555; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
      th { background: #f5f5f5; }
      td.num { text-align: right; }
    </style></head><body>
      <h1>Profit Allocation — ${escapeHtml(meta.date)}</h1>
      <div class="meta">
        Sales: Rs. ${escapeHtml(meta.todaySales.toLocaleString())} · Profit: Rs. ${escapeHtml(meta.todayProfit.toLocaleString())} ·
        Allocated: Rs. ${escapeHtml(meta.totalAllocated.toLocaleString())} · Remaining: Rs. ${escapeHtml(meta.remainingProfit.toLocaleString())}
      </div>
      <p class="meta">Yesterday + Allocation = Total · Total − Withdrawn + Deposits ± Adjustments = Remaining</p>
      <table>
        <thead><tr>
          <th>Fund Name</th><th>Fund Type</th><th>Configured Value</th><th>Today's Allocation</th>
          <th>Yesterday Balance</th><th>Total Balance</th><th>Withdrawn</th><th>Remaining Balance</th>
        </tr></thead>
        <tbody>
          ${lines.map(l => `
          <tr>
            <td>${escapeHtml(l.fundName)}</td><td>${escapeHtml(l.fundType)}</td><td class="num">${escapeHtml(l.value)}</td>
            <td class="num">${escapeHtml(l.todayAllocation)}</td><td class="num">${escapeHtml(l.yesterdayBalance)}</td>
            <td class="num">${escapeHtml(l.totalBalance)}</td><td class="num">${escapeHtml(l.withdrawn)}</td>
            <td class="num">${escapeHtml(l.remainingBalance)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </body></html>`
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  w.print()
}
