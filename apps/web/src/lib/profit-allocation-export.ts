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
  remainingBalance: number
}

export function exportAllocationCsv(
  lines: AllocationLine[],
  meta: { date: string; todaySales: number; todayProfit: number },
) {
  const header = ['Fund Name', 'Type', 'Value', 'Cost', 'Today', 'Yesterday', 'Total', 'Withdrawn', 'Remaining']
  const rows = lines.map(l => [
    l.fundName,
    l.fundType,
    l.value,
    l.categoryCost ?? 0,
    l.todayAllocation,
    l.yesterdayBalance,
    l.totalBalance,
    l.withdrawn,
    l.remainingBalance,
  ])
  const csv = [
  `Profit Allocation — ${meta.date}`,
  `Today's Sales: ${meta.todaySales}`,
  `Today's Profit: ${meta.todayProfit}`,
  '',
  header.join(','),
  ...rows.map(r => r.join(',')),
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
    [],
    ['Fund Name', 'Type', 'Value', 'Cost', 'Today', 'Yesterday', 'Total', 'Withdrawn', 'Remaining'],
    ...lines.map(l => [
      l.fundName, l.fundType, l.value, l.categoryCost ?? 0, l.todayAllocation,
      l.yesterdayBalance, l.totalBalance, l.withdrawn, l.remainingBalance,
    ]),
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
    <html><head><title>Profit Allocation ${meta.date}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
      h1 { font-size: 18px; margin-bottom: 4px; }
      .meta { font-size: 12px; color: #555; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
      th { background: #6366f1; color: white; }
      tr:nth-child(even) { background: #f8f9fa; }
    </style></head><body>
    <h1>Profit Allocation & Fund Management</h1>
    <div class="meta">
      Date: ${meta.date} · Sales: Rs. ${meta.todaySales.toLocaleString()} · Profit: Rs. ${meta.todayProfit.toLocaleString()} ·
      Allocated: Rs. ${meta.totalAllocated.toLocaleString()} · Remaining: Rs. ${meta.remainingProfit.toLocaleString()}
    </div>
    <table>
      <thead><tr>
        <th>Fund</th><th>Type</th><th>Value</th><th>Cost</th><th>Today</th><th>Yesterday</th>
        <th>Total</th><th>Withdrawn</th><th>Remaining</th>
      </tr></thead>
      <tbody>
        ${lines.map(l => `<tr>
          <td>${l.fundName}</td><td>${l.fundType}</td><td>${l.value}</td><td>${l.categoryCost ?? 0}</td>
          <td>${l.todayAllocation}</td><td>${l.yesterdayBalance}</td>
          <td>${l.totalBalance}</td><td>${l.withdrawn}</td><td>${l.remainingBalance}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    </body></html>`
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.print()
}
