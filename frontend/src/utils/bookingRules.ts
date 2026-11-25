import type { UserRole } from '../types/booking'
import { timeRangeLabel } from './bkkDate'

export const ROLE_LABELS: Record<UserRole, string> = {
  STUDENT: 'นักศึกษา',
  LECTURER: 'อาจารย์',
  STAFF: 'เจ้าหน้าที่',
  ADMIN: 'ผู้ดูแลระบบ',
}

/** e.g. "นักศึกษา, อาจารย์" */
export const rolesLabel = (roles: UserRole[]) => roles.map((r) => ROLE_LABELS[r]).join(', ')

/** Same conditions as PATCH /bookings/:id: still PENDING and not started */
export const canEdit = (b: { status: string; start_time: string }) =>
  b.status === 'PENDING' && Date.parse(b.start_time) > Date.now()

/** Same conditions as POST /bookings/:id/cancel: PENDING or APPROVED and not started */
export const canCancel = (b: { status: string; start_time: string }) =>
  (b.status === 'PENDING' || b.status === 'APPROVED') && Date.parse(b.start_time) > Date.now()

/** Check-in window, same as POST /bookings/:id/check-in: 15 min before to 15 min after the start */
export const CHECK_IN_WINDOW_MS = 15 * 60 * 1000

export const canCheckIn = (b: { status: string; start_time: string; checked_in_at?: string | null }) => {
  const start = Date.parse(b.start_time)
  const now = Date.now()
  return b.status === 'APPROVED' && !b.checked_in_at && now >= start - CHECK_IN_WINDOW_MS && now <= start + CHECK_IN_WINDOW_MS
}

export const hasStarted = (b: { start_time: string }) => Date.parse(b.start_time) <= Date.now()

/** APPROVED and waiting for its check-in window to open (shown as a disabled button) */
export const checkInNotOpenYet = (b: { status: string; start_time: string; checked_in_at?: string | null }) =>
  b.status === 'APPROVED' && !b.checked_in_at && Date.now() < Date.parse(b.start_time) - CHECK_IN_WINDOW_MS

/** The check-in window as Bangkok times, e.g. "15:15–15:45" for a 15:30 start */
export const checkInWindowLabel = (b: { start_time: string }) => {
  const start = Date.parse(b.start_time)
  return timeRangeLabel(new Date(start - CHECK_IN_WINDOW_MS).toISOString(), new Date(start + CHECK_IN_WINDOW_MS).toISOString())
}
