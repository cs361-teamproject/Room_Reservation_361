import { useState } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import BookingDetailModal from '../../components/BookingDetailModal'
import EmptyState from '../../components/EmptyState'
import RejectBookingDialog from '../../components/RejectBookingDialog'
import StatusBadge from '../../components/StatusBadge'
import { useToast } from '../../components/Toast'
import { disabledBtn, ghostDangerBtn, primaryBtn, secondaryBtn } from '../../components/buttons'
import { useAsync } from '../../hooks/useAsync'
import { useAdminContext } from '../../layouts/adminContext'
import { ROLE_LABELS, useMockUser } from '../../mocks/session'
import { ApiError } from '../../services/api'
import { approveBooking, getManageBookings } from '../../services/admin'
import type { BookingStatus, ManageBooking } from '../../types/booking'
import { dateTimeLabel, fullDateLabel, timeRangeLabel } from '../../utils/bkkDate'
import { hasStarted } from '../../utils/bookingRules'

const LIMIT = 10

const FILTERS: { value: BookingStatus | 'ALL'; label: string }[] = [
  { value: 'PENDING', label: 'รออนุมัติ' },
  { value: 'APPROVED', label: 'อนุมัติแล้ว' },
  { value: 'REJECTED', label: 'ไม่อนุมัติ' },
  { value: 'CANCELLED', label: 'ยกเลิก' },
  { value: 'ALL', label: 'ทั้งหมด' },
]

export default function AdminBookings() {
  const user = useMockUser()
  // Approving is STAFF only; ADMIN gets the same list read-only
  const canDecide = user.role === 'STAFF'
  const { refreshPending } = useAdminContext()
  const [filter, setFilter] = useState<BookingStatus | 'ALL'>('PENDING')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<ManageBooking | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const { toast, show } = useToast()

  const { data, previous, error, loading, reload } = useAsync(`${filter}|${user.role}`, () => getManageBookings(filter, LIMIT))
  const items = data ?? (loading ? previous : undefined)

  const refresh = () => {
    reload()
    refreshPending()
  }

  const conflict = (message: string) => {
    setRejecting(null)
    show(`${message} รายการถูกโหลดใหม่แล้ว`)
    refresh()
  }

  const approve = async (b: ManageBooking) => {
    setBusyId(b.id)
    try {
      await approveBooking(b.id)
      show(`อนุมัติการจอง ${b.room_name} ของ ${b.user.display_name} แล้ว`)
      refresh()
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) conflict(e.message)
      else show(e instanceof ApiError ? e.message : 'อนุมัติไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div className="admin-head" style={styles.headRow}>
        <h1 style={styles.heading}>คำขอจอง</h1>
        <button style={secondaryBtn} onClick={refresh} disabled={loading}>
          ⟳ รีเฟรช
        </button>
      </div>

      {!canDecide && <p style={styles.note}>ผู้ดูแลระบบดูรายการได้อย่างเดียว การอนุมัติทำโดยเจ้าหน้าที่</p>}

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
                busy={busyId === b.id}
                onOpen={() => setDetailId(b.id)}
                onApprove={() => approve(b)}
                onReject={() => setRejecting(b)}
              />
            ))}
          </ul>
          <p style={styles.footnote}>แสดง {LIMIT} รายการล่าสุด เรียงตามเวลาที่ส่งคำขอ</p>
        </>
      )}

      {detailId && <BookingDetailModal id={detailId} onClose={() => setDetailId(null)} />}
      {rejecting && (
        <RejectBookingDialog
          booking={rejecting}
          onClose={() => setRejecting(null)}
          onConflict={conflict}
          onDone={() => {
            setRejecting(null)
            show(`ไม่อนุมัติการจอง ${rejecting.room_name} แล้ว ผู้จองจะเห็นเหตุผล`)
            refresh()
          }}
        />
      )}
      {toast}
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
}

function RequestCard({ booking: b, canDecide, busy, onOpen, onApprove, onReject }: CardProps) {
  const stop = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation()
    fn()
  }
  const started = hasStarted(b)
  const actionable = canDecide && b.status === 'PENDING'

  return (
    <li
      className="booking-card"
      style={styles.card}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      tabIndex={0}
      role="button"
      aria-label={`รายละเอียดการจอง ${b.room_name}`}
    >
      <div style={styles.cardMain}>
        <div style={styles.titleRow}>
          <span style={styles.roomName}>{b.room_name}</span>
          <span style={styles.title}>{b.title ?? 'ไม่มีหัวข้อ'}</span>
          <StatusBadge status={b.status} />
        </div>
        <span style={styles.when}>
          {fullDateLabel(b.start_time)} · {timeRangeLabel(b.start_time, b.end_time)}
        </span>
        <span style={styles.meta}>
          {b.user.display_name} ({ROLE_LABELS[b.user.role]}) · ส่งคำขอ {dateTimeLabel(b.created_at)}
        </span>
      </div>
      {actionable && (
        <div className="booking-card-actions" style={styles.actions}>
          {started ? (
            <span style={styles.late}>เลยเวลาเริ่มแล้ว</span>
          ) : (
            <>
              <button
                style={{ ...ghostDangerBtn, ...styles.smallBtn, ...(busy ? disabledBtn : null) }}
                disabled={busy}
                onClick={stop(onReject)}
              >
                ไม่อนุมัติ
              </button>
              <button
                style={{ ...primaryBtn, ...styles.smallBtn, ...(busy ? disabledBtn : null) }}
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
  headRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16 },
  heading: { margin: 0, fontSize: 26, fontWeight: 600 },
  note: {
    margin: '0 0 16px',
    padding: '10px 14px',
    borderRadius: 8,
    background: '#F7F7F7',
    border: '1px solid #E5E5E5',
    fontSize: 14,
    color: '#4b4b4b',
  },
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
  cardMain: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
  titleRow: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  roomName: { fontSize: 19, fontWeight: 700 },
  title: { fontSize: 15, color: '#4b4b4b' },
  when: { fontSize: 15, fontWeight: 600 },
  meta: { fontSize: 14, color: '#6b6b6b' },
  actions: { display: 'flex', alignItems: 'center', gap: 10, flex: 'none' },
  smallBtn: { height: 38, padding: '0 16px', fontSize: 14 },
  late: { fontSize: 14, color: '#9a9a9a' },
  footnote: { margin: '16px 0 0', fontSize: 13, color: '#9a9a9a', textAlign: 'center' },
}
