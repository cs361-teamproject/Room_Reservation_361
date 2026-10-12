import { useState } from 'react'
import type { CSSProperties } from 'react'
import Modal from './Modal'
import { dangerBtn, disabledBtn, secondaryBtn } from './buttons'
import { ApiError } from '../services/api'
import { rejectBooking } from '../services/admin'
import type { BookingDetail, ManageBooking } from '../types/booking'
import { fullDateLabel, timeRangeLabel } from '../utils/bkkDate'

const QUICK_REASONS = [
  'ห้องถูกใช้จัดกิจกรรมของภาควิชา',
  'ข้อมูลวัตถุประสงค์ไม่เพียงพอ',
  'จำนวนผู้ใช้ไม่เหมาะกับขนาดห้อง',
  'ห้องอยู่ระหว่างซ่อมบำรุง',
]
const MIN_LENGTH = 5

interface Props {
  booking: ManageBooking
  onClose: () => void
  onDone: (booking: BookingDetail) => void
  /** 409: someone else already approved or rejected it */
  onConflict: (message: string) => void
}

export default function RejectBookingDialog({ booking, onClose, onDone, onConflict }: Props) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tooShort = reason.trim().length < MIN_LENGTH

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      onDone(await rejectBooking(booking.id, reason.trim()))
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) return onConflict(e.message)
      setError(e instanceof ApiError ? e.message : 'บันทึกไม่สำเร็จ กรุณาลองใหม่')
      setBusy(false)
    }
  }

  return (
    <Modal
      title="ไม่อนุมัติการจอง"
      width={500}
      onClose={onClose}
      footer={
        <>
          <button style={secondaryBtn} onClick={onClose}>
            ยกเลิก
          </button>
          <button
            style={{ ...dangerBtn, ...(busy || tooShort ? disabledBtn : null) }}
            disabled={busy || tooShort}
            onClick={confirm}
          >
            {busy ? 'กำลังบันทึก…' : 'ยืนยันไม่อนุมัติ'}
          </button>
        </>
      }
    >
      <div style={styles.wrap}>
        <p style={styles.text}>
          <b>{booking.room_name}</b> · {booking.title ?? 'ไม่มีหัวข้อ'}
          <br />
          {fullDateLabel(booking.start_time)} · {timeRangeLabel(booking.start_time, booking.end_time)}
          <br />
          ผู้จอง: {booking.user.display_name}
        </p>
        <div style={styles.chips}>
          {QUICK_REASONS.map((r) => (
            <button key={r} type="button" onClick={() => setReason(r)} style={{ ...styles.chip, ...(reason === r ? styles.chipActive : null) }}>
              {r}
            </button>
          ))}
        </div>
        <label style={styles.field}>
          <span style={styles.label}>เหตุผล (บังคับ ผู้จองจะเห็นข้อความนี้)</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="อธิบายเหตุผลที่ไม่อนุมัติ"
            style={styles.textarea}
            autoFocus
          />
          {tooShort && reason.length > 0 && <span style={styles.hint}>อย่างน้อย {MIN_LENGTH} ตัวอักษร</span>}
        </label>
        {error && (
          <p role="alert" style={styles.error}>
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 14 },
  text: { margin: 0, fontSize: 15, lineHeight: 1.6 },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: {
    padding: '6px 12px',
    borderRadius: 999,
    border: '1.5px solid #E0E0E0',
    background: '#ffffff',
    fontFamily: 'inherit',
    fontSize: 13,
    color: '#1a1a1a',
    cursor: 'pointer',
  },
  chipActive: { background: '#1a1a1a', borderColor: '#1a1a1a', color: '#ffffff' },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, color: '#6b6b6b' },
  hint: { fontSize: 13, color: '#92400E' },
  textarea: {
    padding: '10px 14px',
    borderRadius: 10,
    border: '1px solid #E0E0E0',
    fontFamily: 'inherit',
    fontSize: 15,
    resize: 'vertical',
    outline: 'none',
  },
  error: { margin: 0, padding: '10px 14px', borderRadius: 8, background: '#FEF2F2', color: '#B91C1C', fontSize: 14 },
}
