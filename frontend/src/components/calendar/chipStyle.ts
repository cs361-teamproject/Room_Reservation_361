import type { CSSProperties } from 'react'
import type { BookingStatus } from '../../types/booking'

/** Same look as the room schedule: PENDING dashed amber, APPROVED solid dark */
export function calendarChipStyle(status: BookingStatus, highlighted = false): CSSProperties {
  const look: CSSProperties =
    status === 'PENDING'
      ? { background: '#FFF7ED', color: '#92400E', border: '1.5px dashed #F59E0B' }
      : { background: '#1a1a1a', color: '#ffffff', border: '1.5px solid #1a1a1a' }
  return highlighted ? { ...look, boxShadow: '0 0 0 2px #ffffff, 0 0 0 4px #2563EB' } : look
}
