import * as XLSX from 'xlsx'
import { formatCurrency } from '@/lib/utils'

export function exportDailyClosingExcel(
  data: any,
  date: string,
  branchName: string,
  options?: { showReload?: boolean },
) {
  const showReload = options?.showReload ?? data?.features?.dailyReload === true
  const wb = XLSX.utils.book_new()

  const summaryRows = [
    ['Daily Closing Report'],
    ['Date', date],
    ['Branch', branchName],
    [],
    ['Sales Summary'],
    ['Total Sales', data?.sales?.totalSales ?? 0],
    ['Mobile Sales', data?.sales?.mobileSales ?? 0],
    ['Accessory Sales', data?.sales?.accessorySales ?? 0],
    ['Service Income', data?.sales?.serviceIncome ?? 0],
    ['Repair Income', data?.sales?.repairIncome ?? 0],
    ['Bill Payment Income', data?.sales?.billPaymentIncome ?? 0],
    ...(showReload ? [['Reload Sales', data?.sales?.reloadSales ?? 0]] : []),
    ['Other Income', data?.sales?.otherIncome ?? 0],
    [],
    ['Profit Summary'],
    ['Gross Sales', data?.profit?.grossSales ?? 0],
    ['COGS', data?.profit?.cogs ?? 0],
    ['Gross Profit', data?.profit?.grossProfit ?? 0],
    ...(showReload ? [['Reload Commission', data?.profit?.reloadCommission ?? 0]] : []),
    ['Net Profit', data?.profit?.netProfit ?? 0],
    [],
    ['Cash Summary'],
    ['Opening Cash', data?.cash?.openingCash ?? data?.openingCash ?? 0],
    ['Cash Sales', data?.cash?.cashSales ?? 0],
    ['Bank Deposits', data?.cash?.bankDeposits ?? 0],
    ['Expected Cash', data?.cash?.expectedCash ?? 0],
    ['Actual Cash', data?.cash?.actualCash ?? 0],
    ['Variance', data?.cash?.cashVariance ?? 0],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary')

  const expenseRows = [['Category', 'Amount'], ...(data?.expenses?.breakdown ?? []).map((r: any) => [r.category, r.amount])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(expenseRows), 'Expenses')

  if (showReload) {
    const reloadRows = [
      ['Provider', 'Amount', 'Commission', 'Count'],
      ...(data?.reload?.breakdown ?? []).map((r: any) => [r.provider, r.amount, r.commission, r.count]),
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(reloadRows), 'Reload')
  }

  const imeiRows = [
    ['Metric', 'Value'],
    ['Mobiles Sold', data?.imei?.mobilesSold ?? 0],
    ['IMEIs Registered', data?.imei?.imeisRegistered ?? 0],
    ['IMEIs Sold Today', data?.imei?.imeisSoldToday ?? 0],
    ['Pending IMEIs', data?.imei?.pendingImeis ?? 0],
    ['Warranties Activated', data?.imei?.warrantiesActivated ?? 0],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(imeiRows), 'IMEI')

  if (data?.insights?.length) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([['Insight'], ...data.insights.map((i: string) => [i])]),
      'Insights',
    )
  }

  XLSX.writeFile(wb, `DailyClosing_${date}.xlsx`)
}

export function buildPdfLines(
  data: any,
  expectedCash: number,
  actualCash: number,
  variance: number,
  options?: { showReload?: boolean },
) {
  const showReload = options?.showReload ?? data?.features?.dailyReload === true
  return [
    ['Total Sales', formatCurrency(data?.sales?.totalSales ?? 0)],
    ['Mobile / Accessory', `${formatCurrency(data?.sales?.mobileSales ?? 0)} / ${formatCurrency(data?.sales?.accessorySales ?? 0)}`],
    ...(showReload
      ? [['Repair / Reload', `${formatCurrency(data?.sales?.repairIncome ?? 0)} / ${formatCurrency(data?.sales?.reloadSales ?? 0)}`]]
      : [['Repair Income', formatCurrency(data?.sales?.repairIncome ?? 0)]]),
    ['Gross Profit', formatCurrency(data?.profit?.grossProfit ?? 0)],
    ['Net Profit', formatCurrency(data?.profit?.netProfit ?? 0)],
    ['Total Expenses', formatCurrency(data?.expenses?.totalExpenses ?? 0)],
    ...(showReload ? [['Reload Commission', formatCurrency(data?.profit?.reloadCommission ?? 0)]] : []),
    ['Expected Cash', formatCurrency(expectedCash)],
    ['Actual Cash', formatCurrency(actualCash)],
    ['Difference', formatCurrency(variance)],
    ['New Customers', String(data?.customers?.newCustomers ?? 0)],
    ['Repairs Completed', String(data?.repairs?.repairsCompleted ?? 0)],
  ]
}
