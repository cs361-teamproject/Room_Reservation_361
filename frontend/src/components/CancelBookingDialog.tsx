import { useState } from 'react'
import type { CSSProperties } from 'react'
import Modal from './Modal'
import { dangerBtn, disabledBtn, secondaryBtn } from './buttons'
import { ApiError } from '../services/api'
import { cancelBooking } from '../services/bookings'
import type { BookingDetail } from '../types/booking'
import { fullDateLabel, timeRangeLabel } from '../utils/bkkDate'

interface Props {
  booking: { id: string; room_name: string; start_time: string; end_time: string }
  onClose: () => void
  onDone: (booking: BookingDetail) => void
}

export default function CancelBookingDialog({ booking, onClose, onDone }: Props) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      onDone(await cancelBooking(booking.id, reason.trim() || undefined))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'ยกเลิกไม่สำเร็จ กรุณาลองใหม่')
      setBusy(false)
    }
  }

  return (
    <Modal
      title="ยกเลิกการจอง"
      width={460}
      onClose={onClose}
      footer={
        <>
          <button style={secondaryBtn} onClick={onClose}>
            ไม่ยกเลิก
          </button>
          <button style={{ ...dangerBtn, ...(busy ? disabledBtn : null) }} disabled={busy} onClick={confirm}>
            {busy ? 'กำลังยกเลิก…' : 'ยืนยันการยกเลิก'}
          </button>
        </>
      }
    >
      <div style={styles.wrap}>
        <p style={styles.text}>
          ต้องการยกเลิกการจอง <b>{booking.room_name}</b>
          <br />
          {fullDateLabel(booking.start_time)} · {timeRangeLabel(booking.start_time, booking.end_time)} ใช่ไหม?
        </p>
        <p style={styles.note}>ช่วงเวลานี้จะว่างให้คนอื่นจองได้ทันที และย้อนกลับไม่ได้</p>
        <label style={styles.field}>
          <span style={styles.label}>เหตุผล (ไม่บังคับ)</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="เช่น เลื่อนการประชุม"
            style={styles.textarea}
          />
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
  wrap: { display: 'flex', flexDirection: 'column', gap: 12 },
  text: { margin: 0, fontSize: 15, lineHeight: 1.6 },
  note: { margin: 0, fontSize: 13, color: '#6b6b6b' },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, color: '#6b6b6b' },
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
