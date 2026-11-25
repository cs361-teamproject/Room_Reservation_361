import { useState } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import BookingDetailModal from '../../components/BookingDetailModal'
import EmptyState from '../../components/EmptyState'
import StatusBadge from '../../components/StatusBadge'
import { disabledBtn, ghostDangerBtn, primaryBtn, secondaryBtn } from '../../components/buttons'
import { useAsync } from '../../hooks/useAsync'
import { useBookingDecisions } from '../../hooks/useBookingDecisions'
import { useAuth } from '../../auth/context'
import { getManageBookings } from '../../services/admin'
import type { BookingStatus, ManageBooking } from '../../types/booking'
import { dateTimeLabel, fullDateLabel, timeRangeLabel } from '../../utils/bkkDate'
import { hasStarted, ROLE_LABELS } from '../../utils/bookingRules'

const LIMIT = 10

const FILTERS: { value: BookingStatus | 'ALL'; label: string }[] = [
  { value: 'PENDING', label: 'รออนุมัติ' },
  { value: 'APPROVED', label: 'อนุมัติแล้ว' },
  { value: 'REJECTED', label: 'ไม่อนุมัติ' },
  { value: 'CANCELLED', label: 'ยกเลิก' },
  { value: 'NO_SHOW', label: 'ไม่มาใช้ห้อง' },
  { value: 'ALL', label: 'ทั้งหมด' },
]

interface Props {
  canDecide: boolean
  /** Bumped by the page's refresh button */
  refreshKey: number
}

/** The original "latest requests by status" view */
export default function BookingRequestList({ canDecide, refreshKey }: Props) {
  const { user } = useAuth()
  const [filter, setFilter] = useState<BookingStatus | 'ALL'>('PENDING')
  const [detailId, setDetailId] = useState<string | null>(null)

  const { data, previous, error, loading, reload } = useAsync(`${filter}|${user?.id}|${refreshKey}`, () =>
    getManageBookings(filter, LIMIT),
  )
  const items = data ?? (loading ? previous : undefined)
  const decisions = useBookingDecisions(reload)

  return (
    <div>
      <div className="my-bookings-tabs" style={styles.tabs}>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            style={{ ...styles.tab, ...(f.value === filter ? styles.tabActive : null) }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? (
        <div style={styles.error}>
          <span>โหลดรายการไม่สำเร็จ: {error}</span>
          <button style={secondaryBtn} onClick={reload}>
            ลองใหม่
          </button>
        </div>
      ) : !items ? (
        <div style={styles.list}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={styles.skeleton} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title={filter === 'PENDING' ? 'ไม่มีคำขอที่รออนุมัติ' : 'ไม่มีรายการ'}
          text={filter === 'PENDING' ? 'คำขอจองใหม่จะแสดงที่นี่' : 'ลองเลือกสถานะอื่น'}
        />
      ) : (
        <>
          <ul style={{ ...styles.list, opacity: loading ? 0.5 : 1 }}>
            {items.map((b) => (
              <RequestCard
                key={b.id}
                booking={b}
                canDecide={canDecide}
                busy={decisions.busyId === b.id}
                onOpen={() => setDetailId(b.id)}
                onApprove={() => decisions.approve(b)}
                onReject={() => decisions.reject(b)}
              />
            ))}
          </ul>
          <p style={styles.footnote}>แสดง {LIMIT} รายการล่าสุด เรียงตามเวลาที่ส่งคำขอ</p>
        </>
      )}

      {detailId && <BookingDetailModal id={detailId} onClose={() => setDetailId(null)} />}
      {decisions.ui}
    </div>
  )
}

interface CardProps {
  booking: ManageBooking
  canDecide: boolean
  busy: boolean
  onOpen: () => void
  onApprove: () => void
  onReject: () => void
  /** Narrow side-panel layout: details stacked above the buttons */
  compact?: boolean
  /** Outline the card picked on the calendar */
  highlighted?: boolean
}

export function RequestCard({ booking: b, canDecide, busy, onOpen, onApprove, onReject, compact, highlighted }: CardProps) {
  const stop = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation()
    fn()
  }
  const started = hasStarted(b)
  const actionable = canDecide && b.status === 'PENDING'

  return (
    <li
      className="booking-card"
      style={{
        ...styles.card,
        ...(compact ? styles.cardCompact : null),
        ...(highlighted ? styles.cardHighlighted : null),
      }}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      tabIndex={0}
      role="button"
      aria-label={`รายละเอียดการจอง ${b.room_name}`}
    >
      <div style={styles.cardMain}>
        <div style={styles.titleRow}>
          <span style={compact ? styles.roomNameCompact : styles.roomName}>{b.room_name}</span>
          {!compact && <span style={styles.title}>{b.title ?? 'ไม่มีหัวข้อ'}</span>}
          <StatusBadge status={b.status} />
        </div>
        <span style={compact ? styles.whenCompact : styles.when}>
          {fullDateLabel(b.start_time)} · {timeRangeLabel(b.start_time, b.end_time)}
        </span>
        <span style={styles.meta}>
          {b.user.display_name} ({ROLE_LABELS[b.user.role]})
          {b.booked_for && ` · จองแทน ${b.booked_for.display_name ?? '-'}`}
          {b.attendee_count != null && ` · ${b.attendee_count} คน`}
          {compact ? <br /> : ' · '}ส่งคำขอ {dateTimeLabel(b.created_at)}
        </span>
      </div>
      {actionable && (
        <div className="booking-card-actions" style={{ ...styles.actions, ...(compact ? styles.actionsCompact : null) }}>
          {started ? (
            <span style={styles.late}>เลยเวลาเริ่มแล้ว</span>
          ) : (
            <>
              <button
                style={{ ...ghostDangerBtn, ...styles.smallBtn, ...(compact ? styles.grow : null), ...(busy ? disabledBtn : null) }}
                disabled={busy}
                onClick={stop(onReject)}
              >
                ไม่อนุมัติ
              </button>
              <button
                style={{ ...primaryBtn, ...styles.smallBtn, ...(compact ? styles.grow : null), ...(busy ? disabledBtn : null) }}
                disabled={busy}
                onClick={stop(onApprove)}
              >
                {busy ? 'กำลังอนุมัติ…' : 'อนุมัติ'}
              </button>
            </>
          )}
        </div>
      )}
    </li>
  )
}

const styles: Record<string, CSSProperties> = {
  tabs: { display: 'flex', gap: 8, marginBottom: 20 },
  tab: {
    height: 40,
    padding: '0 18px',
    borderRadius: 999,
    border: '1.5px solid #E0E0E0',
    background: '#ffffff',
    color: '#1a1a1a',
    fontFamily: 'inherit',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  tabActive: { background: '#1a1a1a', borderColor: '#1a1a1a', color: '#ffffff' },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 14 },
  skeleton: { height: 110, borderRadius: 14, background: '#EDEDED' },
  error: { display: 'flex', alignItems: 'center', gap: 14, color: '#B91C1C', fontSize: 14, padding: '24px 0' },
  card: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
    padding: '20px 24px',
    background: '#ffffff',
    borderRadius: 14,
    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
    cursor: 'pointer',
    outline: 'none',
  },
  cardCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 12,
    padding: '14px 16px',
    boxShadow: 'none',
    border: '1.5px solid #ECECEC',
    borderRadius: 12,
  },
  cardHighlighted: { border: '1.5px solid #1a1a1a', boxShadow: '0 0 0 3px rgba(26,26,26,0.12)' },
  cardMain: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
  titleRow: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  roomName: { fontSize: 19, fontWeight: 700 },
  roomNameCompact: { fontSize: 16, fontWeight: 700, flex: 1, minWidth: 0 },
  title: { fontSize: 15, color: '#4b4b4b' },
  when: { fontSize: 15, fontWeight: 600 },
  whenCompact: { fontSize: 14, fontWeight: 600 },
  meta: { fontSize: 14, color: '#6b6b6b', lineHeight: 1.5 },
  actions: { display: 'flex', alignItems: 'center', gap: 10, flex: 'none' },
  actionsCompact: { gap: 8 },
  smallBtn: { height: 38, padding: '0 16px', fontSize: 14 },
  grow: { flex: 1 },
  late: { fontSize: 14, color: '#9a9a9a' },
  footnote: { margin: '16px 0 0', fontSize: 13, color: '#9a9a9a', textAlign: 'center' },
}
