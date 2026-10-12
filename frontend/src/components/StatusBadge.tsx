import type { CSSProperties } from 'react'
import type { BookingStatus } from '../types/booking'

// PENDING uses the same dashed amber as the schedule's "รออนุมัติ" blocks
const LOOK: Record<BookingStatus, { label: string; style: CSSProperties }> = {
  PENDING: { label: 'รออนุมัติ', style: { background: '#FFF7ED', color: '#92400E', border: '1.5px dashed #F59E0B' } },
  APPROVED: { label: 'อนุมัติแล้ว', style: { background: '#F0FDF4', color: '#15803D', border: '1.5px solid #BBF7D0' } },
  REJECTED: { label: 'ไม่อนุมัติ', style: { background: '#FEF2F2', color: '#B91C1C', border: '1.5px solid #FECACA' } },
  CANCELLED: { label: 'ยกเลิกแล้ว', style: { background: '#F3F4F6', color: '#6b6b6b', border: '1.5px solid #E5E5E5' } },
}

export default function StatusBadge({ status }: { status: BookingStatus }) {
  const { label, style } = LOOK[status]
  return <span style={{ ...badge, ...style }}>{label}</span>
}

const badge: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  height: 28,
  padding: '0 12px',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 600,
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
}
