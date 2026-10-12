import { useState } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import BookingDetailModal from '../components/BookingDetailModal'
import BookingFormModal from '../components/BookingFormModal'
import CancelBookingDialog from '../components/CancelBookingDialog'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../components/StatusBadge'
import { useToast } from '../components/Toast'
import { ghostDangerBtn, primaryBtn, secondaryBtn } from '../components/buttons'
import { useAsync } from '../hooks/useAsync'
import { getMyBookings, getRoomRules } from '../services/bookings'
import type { MyBooking, MyBookingsScope } from '../types/booking'
import { fullDateLabel, timeRangeLabel } from '../utils/bkkDate'
import { canCancel, canEdit } from '../utils/bookingRules'

const PAGE_SIZE = 5

const TABS: { scope: MyBookingsScope; label: string; empty: string }[] = [
  { scope: 'upcoming', label: 'กำลังจะถึง', empty: 'ยังไม่มีการจองที่กำลังจะถึง' },
  { scope: 'past', label: 'ประวัติ', empty: 'ยังไม่มีประวัติการจอง' },
  { scope: 'all', label: 'ทั้งหมด', empty: 'ยังไม่มีการจอง' },
]

type Dialog =
  | { kind: 'detail'; id: string }
  | { kind: 'edit'; booking: MyBooking }
  | { kind: 'cancel'; booking: MyBooking }
  | null

export default function MyBookings() {
  const [scope, setScope] = useState<MyBookingsScope>('upcoming')
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<Dialog>(null)
  const { toast, show } = useToast()

  const { data, previous, error, loading, reload } = useAsync(`${scope}|${page}`, () =>
    getMyBookings(scope, page, PAGE_SIZE),
  )
  // Keep the old list on screen while the next page loads, so the layout does not jump
  const shown = data ?? (loading ? previous : undefined)
  const pages = shown ? Math.max(1, Math.ceil(shown.total / PAGE_SIZE)) : 1
  const tab = TABS.find((t) => t.scope === scope)!

  const changeTab = (s: MyBookingsScope) => {
    setScope(s)
    setPage(1)
  }

  const afterChange = (message: string) => {
    setDialog(null)
    show(message)
    reload()
  }

  return (
    <main className="my-bookings-page" style={styles.main}>
      <div style={styles.container}>
        <div className="my-bookings-head" style={styles.headRow}>
          <h1 style={styles.heading}>การจองของฉัน</h1>
          <Link to="/" style={{ ...primaryBtn, textDecoration: 'none' }}>
            + จองห้องเพิ่ม
          </Link>
        </div>

        <div className="my-bookings-tabs" style={styles.tabs} role="tablist">
          {TABS.map((t) => (
            <button
              key={t.scope}
              role="tab"
              aria-selected={t.scope === scope}
              onClick={() => changeTab(t.scope)}
              style={{ ...styles.tab, ...(t.scope === scope ? styles.tabActive : null) }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error ? (
          <div style={styles.error}>
            <span>โหลดการจองไม่สำเร็จ: {error}</span>
            <button style={secondaryBtn} onClick={reload}>
              ลองใหม่
            </button>
          </div>
        ) : !shown ? (
          <div style={styles.list}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={styles.skeleton} />
            ))}
          </div>
        ) : shown.items.length === 0 ? (
          <EmptyState title={tab.empty} text="เลือกห้องที่ต้องการแล้วกด “จองห้องนี้” ได้ที่หน้ารายการห้อง" />
        ) : (
          <>
            <ul style={{ ...styles.list, opacity: loading ? 0.5 : 1 }}>
              {shown.items.map((b) => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  onOpen={() => setDialog({ kind: 'detail', id: b.id })}
                  onEdit={() => setDialog({ kind: 'edit', booking: b })}
                  onCancel={() => setDialog({ kind: 'cancel', booking: b })}
                />
              ))}
            </ul>
            {pages > 1 && <Pagination page={page} pages={pages} onChange={setPage} />}
          </>
        )}
      </div>

      {dialog?.kind === 'detail' && (
        <BookingDetailModal
          id={dialog.id}
          onClose={() => setDialog(null)}
          onEdit={(b) =>
            setDialog({ kind: 'edit', booking: { ...b, room_name: b.room.room_name } })
          }
          onCancel={(b) => setDialog({ kind: 'cancel', booking: { ...b, room_name: b.room.room_name } })}
        />
      )}
      {dialog?.kind === 'edit' && (
        <BookingFormModal
          booking={dialog.booking}
          rules={getRoomRules(dialog.booking.room_name)}
          onClose={() => setDialog(null)}
          onDone={() => afterChange('บันทึกเวลาใหม่แล้ว รอเจ้าหน้าที่อนุมัติ')}
        />
      )}
      {dialog?.kind === 'cancel' && (
        <CancelBookingDialog
          booking={dialog.booking}
          onClose={() => setDialog(null)}
          onDone={() => afterChange('ยกเลิกการจองแล้ว')}
        />
      )}
      {toast}
    </main>
  )
}

interface CardProps {
  booking: MyBooking
  onOpen: () => void
  onEdit: () => void
  onCancel: () => void
}

function BookingCard({ booking: b, onOpen, onEdit, onCancel }: CardProps) {
  const stop = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation()
    fn()
  }
  const faded = b.status === 'CANCELLED' || b.status === 'REJECTED'

  return (
    <li
      className="booking-card"
      style={{ ...styles.card, ...(faded ? styles.cardFaded : null) }}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      tabIndex={0}
      role="button"
      aria-label={`รายละเอียดการจอง ${b.room_name}`}
    >
      <div style={styles.cardMain}>
        <div style={styles.cardTitleRow}>
          <span style={styles.roomName}>{b.room_name}</span>
          <StatusBadge status={b.status} />
        </div>
        <span style={styles.when}>
          {fullDateLabel(b.start_time)} · {timeRangeLabel(b.start_time, b.end_time)}
        </span>
      </div>
      <div className="booking-card-actions" style={styles.actions}>
        {canEdit(b) && (
          <button style={{ ...secondaryBtn, ...styles.smallBtn }} onClick={stop(onEdit)}>
            แก้เวลา
          </button>
        )}
        {canCancel(b) && (
          <button style={{ ...ghostDangerBtn, ...styles.smallBtn }} onClick={stop(onCancel)}>
            ยกเลิก
          </button>
        )}
        <span style={styles.more}>รายละเอียด ›</span>
      </div>
    </li>
  )
}

function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  return (
    <nav style={styles.pagination} aria-label="หน้า">
      <button style={pageBtn(false, page === 1)} disabled={page === 1} onClick={() => onChange(page - 1)} aria-label="ก่อนหน้า">
        ‹
      </button>
      {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
        <button key={p} style={pageBtn(p === page, false)} onClick={() => onChange(p)} aria-current={p === page}>
          {p}
        </button>
      ))}
      <button
        style={pageBtn(false, page === pages)}
        disabled={page === pages}
        onClick={() => onChange(page + 1)}
        aria-label="ถัดไป"
      >
        ›
      </button>
    </nav>
  )
}

// Same look as the week buttons in RoomSchedule
function pageBtn(active: boolean, disabled: boolean): CSSProperties {
  return {
    minWidth: 36,
    height: 36,
    padding: '0 8px',
    borderRadius: 8,
    border: '1.5px solid #1a1a1a',
    background: active ? '#1a1a1a' : '#ffffff',
    color: active ? '#ffffff' : '#1a1a1a',
    fontFamily: 'inherit',
    fontSize: 15,
    fontWeight: 600,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.3 : 1,
  }
}

const styles: Record<string, CSSProperties> = {
  main: { padding: '40px 40px 80px' },
  container: { maxWidth: 1000, margin: '0 auto' },
  headRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 20 },
  heading: { margin: 0, fontSize: 26, fontWeight: 600 },
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
  },
  tabActive: { background: '#1a1a1a', borderColor: '#1a1a1a', color: '#ffffff' },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 14 },
  skeleton: { height: 96, borderRadius: 14, background: '#EDEDED' },
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
  cardFaded: { boxShadow: '0 2px 10px rgba(0,0,0,0.08)' },
  cardMain: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
  cardTitleRow: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  roomName: { fontSize: 19, fontWeight: 700 },
  when: { fontSize: 15, color: '#4b4b4b' },
  actions: { display: 'flex', alignItems: 'center', gap: 10, flex: 'none' },
  smallBtn: { height: 36, padding: '0 14px', fontSize: 14 },
  more: { fontSize: 14, color: '#6b6b6b', whiteSpace: 'nowrap' },
  pagination: { display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 },
}
