/**
 * Run: npx tsx src/modules/hr-engine/hr-engine.attendance.test.ts
 */
import {
  calculateAttendanceResult,
  scheduledShiftMinutes,
  validateShiftWindow,
  minutesInColombo,
} from './hr-engine.attendance'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

const dayShift = { startMinutes: 9 * 60, endMinutes: 18 * 60, graceMinutes: 10 }

assert(scheduledShiftMinutes(dayShift) === 9 * 60, '9h shift')
assert(scheduledShiftMinutes({ startMinutes: 22 * 60, endMinutes: 6 * 60, isOvernight: true }) === 8 * 60, 'overnight 8h')

assert(validateShiftWindow(540, 540).ok === false, 'equal invalid')
assert(validateShiftWindow(540, 1080).ok === true, 'day ok')
assert(validateShiftWindow(22 * 60, 6 * 60).isOvernight === true, 'auto overnight')

// Absent
const absent = calculateAttendanceResult({ checkInAt: null, checkOutAt: null, shift: dayShift })
assert(absent.status === 'ABSENT', 'absent')
assert(absent.workedMinutes === 0, 'absent worked 0')

// On-time present: check-in 09:05 Colombo, out 18:00 — use fixed UTC that maps to Colombo
// 2026-08-26 03:35 UTC = 09:05 Colombo; 12:30 UTC = 18:00 Colombo
const inOnTime = new Date('2026-08-26T03:35:00.000Z')
const outOnTime = new Date('2026-08-26T12:30:00.000Z')
assert(minutesInColombo(inOnTime) === 9 * 60 + 5, `colombo in ${minutesInColombo(inOnTime)}`)
const present = calculateAttendanceResult({
  checkInAt: inOnTime,
  checkOutAt: outOnTime,
  shift: dayShift,
})
assert(present.status === 'PRESENT', `present got ${present.status}`)
assert(present.lateMinutes === 0, 'no late within grace')
assert(present.workedMinutes === 9 * 60 - 5, `worked ${present.workedMinutes}`)

// Late: 09:30 Colombo = 04:00 UTC
const lateIn = new Date('2026-08-26T04:00:00.000Z')
const late = calculateAttendanceResult({
  checkInAt: lateIn,
  checkOutAt: outOnTime,
  shift: dayShift,
})
assert(late.status === 'LATE', `late got ${late.status}`)
assert(late.lateMinutes === 20, `late mins ${late.lateMinutes}`) // 09:30 - (09:00+10) = 20

// Half day: short work
const halfOut = new Date('2026-08-26T06:35:00.000Z') // 12:05 Colombo — ~3h from 09:05
const half = calculateAttendanceResult({
  checkInAt: inOnTime,
  checkOutAt: halfOut,
  shift: dayShift,
})
assert(half.status === 'HALF_DAY', `half got ${half.status} worked=${half.workedMinutes}`)

// Forced absent
const forced = calculateAttendanceResult({
  checkInAt: null,
  checkOutAt: null,
  shift: dayShift,
  forcedStatus: 'ABSENT',
})
assert(forced.ruleId.includes('forced'), 'forced rule')

// No shift still works
const noShift = calculateAttendanceResult({
  checkInAt: inOnTime,
  checkOutAt: outOnTime,
  shift: null,
})
assert(noShift.status === 'PRESENT', 'no shift present')

console.log('hr-engine.attendance.test.ts: all checks passed')
