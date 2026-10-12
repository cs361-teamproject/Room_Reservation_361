import type { UserRole } from '../types/booking'

const ROLE_LABELS: Record<UserRole, string> = {
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

export const hasStarted = (b: { start_time: string }) => Date.parse(b.start_time) <= Date.now()
