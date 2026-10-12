// Date helpers pinned to Asia/Bangkok (UTC+7, no DST), independent of the browser's time zone.
// Days are represented as 'YYYY-MM-DD' strings in Bangkok time.

const DAY_MS = 86_400_000
const BKK_OFFSET_MS = 7 * 3_600_000

const WEEKDAYS_TH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
const MONTHS_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

const ymdFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export const toYmd = (ms: number): string => ymdFormat.format(ms)
export const bkkMidnight = (ymd: string): number => Date.parse(`${ymd}T00:00:00+07:00`)
export const bkkToday = (): string => toYmd(Date.now())
export const addDays = (ymd: string, days: number): string => toYmd(bkkMidnight(ymd) + days * DAY_MS)
export const weekdayOf = (ymd: string): number => new Date(bkkMidnight(ymd) + BKK_OFFSET_MS).getUTCDay()

/** Sunday of the week that contains `ymd` */
export const startOfWeek = (ymd: string): string => addDays(ymd, -weekdayOf(ymd))

export const weekDays = (sunday: string): string[] => Array.from({ length: 7 }, (_, i) => addDays(sunday, i))

/** Minutes since Bangkok midnight of `ymd` (can be negative or > 1440 for other days) */
export const minutesInDay = (ms: number, ymd: string): number => (ms - bkkMidnight(ymd)) / 60_000

export const nowMinutes = (): number => minutesInDay(Date.now(), bkkToday())

const pad = (n: number) => String(n).padStart(2, '0')
export const formatMinutes = (min: number): string => `${pad(Math.floor(min / 60))}:${pad(Math.round(min % 60))}`

export const weekdayLabel = (ymd: string): string => WEEKDAYS_TH[weekdayOf(ymd)]
export const dayNumber = (ymd: string): number => Number(ymd.slice(8, 10))

/** e.g. "4 – 10 ต.ค. 2569" or "27 ก.ย. – 3 ต.ค. 2569" (Buddhist year) */
export function weekRangeLabel(first: string, last: string): string {
  const [y1, m1, d1] = first.split('-').map(Number)
  const [y2, m2, d2] = last.split('-').map(Number)
  const end = `${d2} ${MONTHS_TH[m2 - 1]} ${y2 + 543}`
  if (y1 !== y2) return `${d1} ${MONTHS_TH[m1 - 1]} ${y1 + 543} – ${end}`
  if (m1 !== m2) return `${d1} ${MONTHS_TH[m1 - 1]} – ${end}`
  return `${d1} – ${end}`
}

/** e.g. "พฤ 1 ต.ค." */
export function shortDateLabel(ymd: string): string {
  const [, m, d] = ymd.split('-').map(Number)
  return `${weekdayLabel(ymd)} ${d} ${MONTHS_TH[m - 1]}`
}

/** A time range on one Bangkok day, in minutes since midnight */
export interface TimeSlot {
  date: string
  startMin: number
  endMin: number
}

/** ISO 8601 with the Bangkok offset, e.g. "2026-10-05T09:00:00+07:00" */
export const bkkIso = (ymd: string, min: number): string => `${ymd}T${formatMinutes(min)}:00+07:00`

/** e.g. "จ 2 พ.ย. 2569" for an ISO timestamp (Buddhist year) */
export function fullDateLabel(iso: string): string {
  const ymd = toYmd(Date.parse(iso))
  return `${shortDateLabel(ymd)} ${Number(ymd.slice(0, 4)) + 543}`
}

/** "10:00–12:00" for two ISO timestamps on the same Bangkok day */
export function timeRangeLabel(startIso: string, endIso: string): string {
  const ymd = toYmd(Date.parse(startIso))
  return `${formatMinutes(minutesInDay(Date.parse(startIso), ymd))}–${formatMinutes(minutesInDay(Date.parse(endIso), ymd))}`
}

/** e.g. "12 ต.ค. 14:05" for event timestamps */
export function dateTimeLabel(iso: string): string {
  const ms = Date.parse(iso)
  const ymd = toYmd(ms)
  const [, m, d] = ymd.split('-').map(Number)
  return `${d} ${MONTHS_TH[m - 1]} ${formatMinutes(Math.floor(minutesInDay(ms, ymd)))}`
}
