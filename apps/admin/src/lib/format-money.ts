/** Full rupee amount — never compact (22.0K / 1.4L). */
export function formatMoney(n: number | null | undefined): string {
  const v = Number(n)
  if (!Number.isFinite(v)) return 'Rs.0'
  return `Rs.${Math.round(v).toLocaleString('en-LK')}`
}
