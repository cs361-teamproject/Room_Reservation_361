import type { CSSProperties } from 'react'
import Modal from './Modal'
import StatusBadge from './StatusBadge'
import { ghostDangerBtn, secondaryBtn } from './buttons'
import { useAsync } from '../hooks/useAsync'
import { getBooking, getBookingEvents } from '../services/bookings'
import type { BookingDetail, BookingEvent, BookingEventAction, BookingType } from '../types/booking'
import { dateTimeLabel, fullDateLabel, timeRangeLabel } from '../utils/bkkDate'
import { canCancel, canEdit, ROLE_LABELS } from '../utils/bookingRules'

const TYPE_LABEL: Record<BookingType, string> = {
  CLASS: 'คาบเรียน',
  SCHEDULE: 'ตารางสอบ/กิจกรรม',
  SPECIAL_EVENT: 'กิจกรรมพิเศษ',
  STUDENT_BOOKING: 'การจองของนักศึกษา',
}

const EVENT_LOOK: Record<BookingEventAction, { label: string; color: string }> = {
  CREATED: { label: 'ส่งคำขอจอง', color: '#1a1a1a' },
  UPDATED: { label: 'แก้ไขเวลา', color: '#6b6b6b' },
  APPROVED: { label: 'อนุมัติ', color: '#22C55E' },
  REJECTED: { label: 'ไม่อนุมัติ', color: '#EF4444' },
  CANCELLED: { label: 'ยกเลิก', color: '#9a9a9a' },
}

interface Props {
  id: string
  onClose: () => void
  /** Owner actions; leave out to show the booking read-only (staff view) */
  onEdit?: (booking: BookingDetail) => void
  onCancel?: (booking: BookingDetail) => void
}

const personLabel = (p: { display_name: string | null; role: keyof typeof ROLE_LABELS }) =>
  `${p.display_name ?? '-'} (${ROLE_LABELS[p.role]})`

export default function BookingDetailModal({ id, onClose, onEdit, onCancel }: Props) {
  const detail = useAsync(`detail-${id}`, () => getBooking(id))
  const events = useAsync(`events-${id}`, () => getBookingEvents(id))
  const b = detail.data
  const showEdit = Boolean(b && onEdit && canEdit(b))
  const showCancel = Boolean(b && onCancel && canCancel(b))

  return (
    <Modal
      title="รายละเอียดการจอง"
      onClose={onClose}
      footer={
        b && (showEdit || showCancel) ? (
          <>
            {showEdit && (
              <button style={secondaryBtn} onClick={() => onEdit?.(b)}>
                แก้เวลา
              </button>
            )}
            {showCancel && (
              <button style={ghostDangerBtn} onClick={() => onCancel?.(b)}>
                ยกเลิกการจอง
              </button>
            )}
          </>
        ) : undefined
      }
    >
      {detail.error ? (
        <p style={styles.error}>โหลดข้อมูลไม่สำเร็จ: {detail.error}</p>
      ) : !b ? (
        <div style={styles.skeleton} />
      ) : (
        <div style={styles.wrap}>
          <div style={styles.headRow}>
            <div>
              <h3 style={styles.room}>{b.room.room_name}</h3>
              <p style={styles.title}>{b.title ?? 'ไม่มีหัวข้อ'}</p>
            </div>
            <StatusBadge status={b.status} />
          </div>

          <dl style={styles.grid}>
            {(b.requester ?? b.user) && (
              <>
                <dt style={styles.dt}>ผู้จอง</dt>
                <dd style={styles.dd}>{personLabel(b.requester ?? b.user!)}</dd>
              </>
            )}
            {b.booked_for && (
              <>
                <dt style={styles.dt}>ผู้ใช้ห้อง</dt>
                <dd style={styles.dd}>{personLabel(b.booked_for)} · จองแทนโดยเจ้าหน้าที่</dd>
              </>
            )}
            {b.attendee_count != null && (
              <>
                <dt style={styles.dt}>ผู้เข้าร่วม</dt>
                <dd style={styles.dd}>
                  {b.attendee_count} คน
                  {b.room.seat_capacity != null ? ` / ความจุ ${b.room.seat_capacity} ที่นั่ง` : ' (ห้องไม่ระบุความจุ)'}
                </dd>
              </>
            )}
            {b.purpose && (
              <>
                <dt style={styles.dt}>วัตถุประสงค์</dt>
                <dd style={styles.dd}>{b.purpose}</dd>
              </>
            )}
            {b.equipment_request && (
              <>
                <dt style={styles.dt}>อุปกรณ์ที่ขอ</dt>
                <dd style={styles.dd}>
                  {b.equipment_request} <span style={styles.requestTag}>ขอเพิ่ม · ยังไม่ยืนยัน</span>
                </dd>
              </>
            )}
            <dt style={styles.dt}>วันที่</dt>
            <dd style={styles.dd}>{fullDateLabel(b.start_time)}</dd>
            <dt style={styles.dt}>เวลา</dt>
            <dd style={styles.dd}>{timeRangeLabel(b.start_time, b.end_time)}</dd>
            <dt style={styles.dt}>ประเภท</dt>
            <dd style={styles.dd}>{TYPE_LABEL[b.booking_type]}</dd>
            <dt style={styles.dt}>ส่งคำขอเมื่อ</dt>
            <dd style={styles.dd}>{dateTimeLabel(b.created_at)}</dd>
          </dl>

          {b.status === 'REJECTED' && b.reject_reason && (
            <p style={{ ...styles.reason, background: '#FEF2F2', color: '#B91C1C' }}>
              <b>เหตุผลที่ไม่อนุมัติ:</b> {b.reject_reason}
            </p>
          )}
          {b.status === 'CANCELLED' && b.cancel_reason && (
            <p style={{ ...styles.reason, background: '#F3F4F6', color: '#4b4b4b' }}>
              <b>เหตุผลที่ยกเลิก:</b> {b.cancel_reason}
            </p>
          )}

          <div>
            <h4 style={styles.subhead}>ประวัติ</h4>
            {events.data ? <Timeline events={events.data} /> : <div style={{ ...styles.skeleton, height: 80 }} />}
          </div>
        </div>
      )}
    </Modal>
  )
}

function Timeline({ events }: { events: BookingEvent[] }) {
  return (
    <ol style={styles.timeline}>
      {events.map((e, i) => {
        const look = EVENT_LOOK[e.action]
        return (
          <li key={`${e.action}-${e.at}`} style={styles.event}>
            <span style={styles.rail}>
              <i style={{ ...styles.dot, background: look.color }} />
              {i < events.length - 1 && <i style={styles.line} />}
            </span>
            <span style={styles.eventBody}>
              <span style={styles.eventLabel}>{look.label}</span>
              <span style={styles.eventMeta}>
                {e.by ?? 'ระบบ'} · {dateTimeLabel(e.at)}
              </span>
              {e.note && <span style={styles.eventNote}>“{e.note}”</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 18 },
  skeleton: { height: 220, borderRadius: 10, background: '#EDEDED' },
  error: { margin: 0, color: '#B91C1C', fontSize: 14 },
  headRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  room: { margin: 0, fontSize: 22, fontWeight: 600 },
  title: { margin: '4px 0 0', fontSize: 15, color: '#6b6b6b' },
  grid: { display: 'grid', gridTemplateColumns: '110px 1fr', rowGap: 8, margin: 0, fontSize: 15 },
  dt: { color: '#6b6b6b' },
  dd: { margin: 0, fontWeight: 600 },
  requestTag: {
    marginLeft: 6,
    padding: '2px 8px',
    borderRadius: 999,
    border: '1.5px dashed #F59E0B',
    background: '#FFF7ED',
    color: '#92400E',
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  reason: { margin: 0, padding: '10px 14px', borderRadius: 8, fontSize: 14, lineHeight: 1.5 },
  subhead: { margin: '0 0 10px', fontSize: 15, fontWeight: 700 },
  timeline: { listStyle: 'none', margin: 0, padding: 0 },
  event: { display: 'flex', gap: 12 },
  rail: { position: 'relative', width: 12, flex: 'none', display: 'flex', justifyContent: 'center' },
  dot: { width: 12, height: 12, borderRadius: 999, marginTop: 5, zIndex: 1 },
  line: { position: 'absolute', top: 17, bottom: -5, width: 2, background: '#E5E5E5' },
  eventBody: { display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 16 },
  eventLabel: { fontSize: 15, fontWeight: 600 },
  eventMeta: { fontSize: 13, color: '#6b6b6b' },
  eventNote: { fontSize: 14, color: '#4b4b4b' },
}
