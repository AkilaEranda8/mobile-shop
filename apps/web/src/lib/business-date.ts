/** Today's date in Asia/Colombo (YYYY-MM-DD) */
export function businessToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' })
}
