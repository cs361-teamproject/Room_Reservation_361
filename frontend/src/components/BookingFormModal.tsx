import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import Modal from './Modal'
import { disabledBtn, primaryBtn, secondaryBtn } from './buttons'
import { ApiError } from '../services/api'
import { createBooking, updateBookingTime } from '../services/bookings'
import type { RoomRules } from '../types/booking'
import { rolesLabel } from '../utils/bookingRules'
import type { UserOption } from '../services/users'
import {
  addDays,
  bkkIso,
  bkkToday,
  dayNumber,
  formatMinutes,
  fullDateLabel,
  minutesInDay,
  nowMinutes,
  toYmd,
  weekdayLabel,
} from '../utils/bkkDate'

// Same visible hours as RoomSchedule; slots are 30 minutes
const OPEN_MIN = 8 * 60
const CLOSE_MIN = 20 * 60
const STEP = 30
// Quick-pick chips for the coming week; the date field below reaches any later day
const BOOKABLE_DAYS = 7

const hoursLabel = (min: number) => `${min / 60} ชม.`.replace('.5 ชม.', ' ชม. 30 นาที')

interface FormValues {
  date: string
  start: number
  end: number
  title: string
  attendees: number
  purpose: string
  equipment: string
  bookedFor: string
}

interface Props {
  rules: RoomRules
  /** Create a booking for this room (seatCapacity null = not known, never checked) */
  room?: { id: string; name: string; seatCapacity?: number | null }
  /** STAFF: book on behalf of one of these people (required) */
  bookForOptions?: UserOption[]
  /** Or move an existing PENDING booking (only its time can change) */
  booking?: { id: string; room_name: string; start_time: string; end_time: string; title?: string | null }
  onClose: () => void
  onDone: () => void
}

export default function BookingFormModal({ rules, room, booking, bookForOptions, onClose, onDone }: Props) {
  const editing = Boolean(booking)
  const roomName = booking?.room_name ?? room?.name ?? ''
  const today = bkkToday()

  const initial = (): FormValues => {
    if (booking) {
      const date = toYmd(Date.parse(booking.start_time))
      return {
        date,
        start: minutesInDay(Date.parse(booking.start_time), date),
        end: minutesInDay(Date.parse(booking.end_time), date),
        title: booking.title ?? '',
        ...EMPTY_DETAILS,
      }
    }
    // Next free half hour today, or tomorrow 10:00 when today is nearly over
    const next = Math.ceil((nowMinutes() + 1) / STEP) * STEP
    if (next + STEP <= CLOSE_MIN) {
      const start = Math.max(OPEN_MIN, next)
      return { date: today, start, end: Math.min(start + 60, CLOSE_MIN), title: '', ...EMPTY_DETAILS }
    }
    return { date: addDays(today, 1), start: 10 * 60, end: 11 * 60, title: '', ...EMPTY_DETAILS }
  }

  const { register, handleSubmit, control, setValue, formState } = useForm<FormValues>({ defaultValues: initial() })
  const [serverErrors, setServerErrors] = useState<{ status: number; messages: string[] } | null>(null)
  const [date, start, end, attendees] = useWatch({ control, name: ['date', 'start', 'end', 'attendees'] })
  const capacity = room?.seatCapacity ?? null
  const onBehalf = Boolean(bookForOptions)

  const days = Array.from({ length: BOOKABLE_DAYS + 1 }, (_, i) => addDays(today, i))
  if (!days.includes(date)) days.unshift(date)

  const minStart = date === today ? Math.ceil((nowMinutes() + 1) / STEP) * STEP : OPEN_MIN
  const startOptions = range(OPEN_MIN, CLOSE_MIN - STEP)
  const endOptions = range(OPEN_MIN + STEP, CLOSE_MIN)

  // Same checks as the backend, so most mistakes never leave the browser
  const problems: string[] = []
  if (start < minStart) problems.push('เวลาเริ่มต้องเป็นเวลาในอนาคต')
  if (end <= start) problems.push('เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม')
  else if (end - start > rules.max_hours * 60) problems.push(`ห้องนี้จองได้ไม่เกิน ${rules.max_hours} ชั่วโมงต่อครั้ง`)
  if (!editing && capacity !== null && attendees > capacity) {
    problems.push(`ผู้เข้าร่วม ${attendees} คน เกินความจุห้อง ${capacity} ที่นั่ง`)
  }

  const onSubmit = handleSubmit(async (v) => {
    setServerErrors(null)
    const times = { start_time: bkkIso(v.date, v.start), end_time: bkkIso(v.date, v.end) }
    try {
      if (booking) await updateBookingTime(booking.id, times)
      else
        await createBooking({
          room_id: room!.id,
          ...times,
          title: v.title.trim() || undefined,
          attendee_count: v.attendees,
          purpose: v.purpose.trim() || undefined,
          equipment_request: v.equipment.trim() || undefined,
          booked_for_user_id: onBehalf ? v.bookedFor : undefined,
        })
      onDone()
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, 'เกิดข้อผิดพลาด กรุณาลองใหม่')
      setServerErrors({ status: err.status, messages: err.messages })
    }
  })

  const submitting = formState.isSubmitting
  const blocked = problems.length > 0 || submitting

  return (
    <Modal
      title={editing ? `แก้เวลาการจอง ${roomName}` : `จองห้อง ${roomName}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" style={secondaryBtn} onClick={onClose}>
            ยกเลิก
          </button>
          <button
            type="submit"
            form="booking-form"
            style={{ ...primaryBtn, ...(blocked ? disabledBtn : null) }}
            disabled={blocked}
          >
            {submitting ? 'กำลังบันทึก…' : editing ? 'บันทึกเวลาใหม่' : 'ยืนยันการจอง'}
          </button>
        </>
      }
    >
      <form id="booking-form" onSubmit={onSubmit} style={styles.form}>
        <div style={styles.field}>
          <span style={styles.label}>วันที่</span>
          <div className="booking-form-days" style={styles.dateGrid}>
            {days.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setValue('date', d)}
                style={{ ...styles.dateChip, ...(d === date ? styles.dateChipActive : null) }}
              >
                <span style={{ fontSize: 12 }}>{weekdayLabel(d)}</span>
                <span style={{ fontSize: 16, fontWeight: 700 }}>{dayNumber(d)}</span>
              </button>
            ))}
          </div>
          <div style={styles.dateRow}>
            <span style={styles.hint}>{fullDateLabel(bkkIso(date, 0))}</span>
            <label style={styles.dateOther}>
              หรือเลือกวัน
              <input
                type="date"
                value={date}
                min={today}
                onChange={(e) => e.target.value && setValue('date', e.target.value)}
                style={styles.dateInput}
              />
            </label>
          </div>
        </div>

        <div className="booking-form-times" style={styles.timeRow}>
          <label style={styles.timeField}>
            <span style={styles.label}>เวลาเริ่ม</span>
            <select {...register('start', { valueAsNumber: true })} style={styles.select}>
              {startOptions.map((m) => (
                <option key={m} value={m} disabled={m < minStart}>
                  {formatMinutes(m)}
                </option>
              ))}
            </select>
          </label>
          <label style={styles.timeField}>
            <span style={styles.label}>เวลาสิ้นสุด</span>
            <select {...register('end', { valueAsNumber: true })} style={styles.select}>
              {endOptions.map((m) => (
                <option key={m} value={m}>
                  {formatMinutes(m)}
                </option>
              ))}
            </select>
          </label>
          <span style={styles.duration}>{end > start ? hoursLabel(end - start) : '–'}</span>
        </div>

        {!editing && onBehalf && (
          <label style={styles.field}>
            <span style={styles.label}>ผู้ใช้ห้อง (จองแทน) *</span>
            <select {...register('bookedFor', { required: 'กรุณาเลือกผู้ใช้ห้อง' })} style={styles.select}>
              <option value="">— เลือกผู้ใช้ห้อง —</option>
              {bookForOptions!.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.display_name ?? u.username} ({rolesLabel([u.role])})
                </option>
              ))}
            </select>
            {formState.errors.bookedFor && <span style={styles.fieldError}>{formState.errors.bookedFor.message}</span>}
          </label>
        )}

        {!editing && (
          <label style={styles.field}>
            <span style={styles.label}>จำนวนผู้เข้าร่วม *</span>
            <span style={styles.inline}>
              <input
                type="number"
                min={1}
                {...register('attendees', {
                  valueAsNumber: true,
                  required: 'กรุณาใส่จำนวนผู้เข้าร่วม',
                  min: { value: 1, message: 'อย่างน้อย 1 คน' },
                })}
                style={{ ...styles.input, width: 120 }}
              />
              <span style={styles.hint}>{capacity !== null ? `ความจุห้อง ${capacity} ที่นั่ง` : 'ห้องนี้ไม่ระบุความจุ'}</span>
            </span>
            {formState.errors.attendees && <span style={styles.fieldError}>{formState.errors.attendees.message}</span>}
          </label>
        )}

        <label style={styles.field}>
          <span style={styles.label}>หัวข้อ {editing ? '' : '(ไม่บังคับ)'}</span>
          <input
            {...register('title', { maxLength: 200 })}
            placeholder="เช่น ประชุมโปรเจกต์กลุ่ม"
            readOnly={editing}
            maxLength={200}
            style={{ ...styles.input, ...(editing ? styles.inputReadOnly : null) }}
          />
          {editing && <span style={styles.hint}>แก้ได้เฉพาะวันและเวลา</span>}
        </label>

        {!editing && (
          <>
            <label style={styles.field}>
              <span style={styles.label}>วัตถุประสงค์ (ไม่บังคับ)</span>
              <input {...register('purpose', { maxLength: 500 })} placeholder="เช่น เรียนรายวิชา CS102, อบรมพิเศษ" maxLength={500} style={styles.input} />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>ความต้องการอุปกรณ์เพิ่มเติม (ไม่บังคับ)</span>
              <input
                {...register('equipment', { maxLength: 500 })}
                placeholder="เช่น ไมโครโฟนลอย, Hotspot / Internet สำรอง"
                maxLength={500}
                style={styles.input}
              />
              <span style={styles.hint}>เป็นคำขอให้เจ้าหน้าที่เตรียม ไม่ได้ยืนยันว่ามีอุปกรณ์พร้อมใช้</span>
            </label>
          </>
        )}

        <div style={styles.info}>
          <span>ⓘ</span>
          <span>
            ห้องนี้จองได้ไม่เกิน <b>{rules.max_hours} ชั่วโมง</b>ต่อครั้ง · จองได้: {rolesLabel(rules.allowed_roles)} ·{' '}
            {onBehalf ? 'เจ้าหน้าที่จองแทน อนุมัติทันที' : 'การจองต้องรอเจ้าหน้าที่อนุมัติ'}
          </span>
        </div>

        {problems.length > 0 && (
          <ul style={styles.warn}>
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}

        {serverErrors && (
          <div role="alert" style={styles.error}>
            <b>{serverErrors.status === 409 ? 'ช่วงเวลานี้มีคนจองแล้ว' : 'จองไม่สำเร็จ'}</b>
            <ul style={styles.errorList}>
              {serverErrors.messages.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
            {serverErrors.status === 409 && <span>ลองเลือกวันหรือช่วงเวลาอื่น</span>}
          </div>
        )}
      </form>
    </Modal>
  )
}

const EMPTY_DETAILS = { attendees: NaN, purpose: '', equipment: '', bookedFor: '' }

const range = (from: number, to: number) => Array.from({ length: (to - from) / STEP + 1 }, (_, i) => from + i * STEP)

const styles: Record<string, CSSProperties> = {
  form: { display: 'flex', flexDirection: 'column', gap: 18 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, color: '#6b6b6b' },
  hint: { fontSize: 13, color: '#9a9a9a' },
  dateGrid: { display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0, 1fr))', gap: 6 },
  dateChip: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '6px 0',
    borderRadius: 8,
    border: '1.5px solid #E0E0E0',
    background: '#ffffff',
    color: '#1a1a1a',
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  dateChipActive: { background: '#1a1a1a', borderColor: '#1a1a1a', color: '#ffffff' },
  timeRow: { display: 'flex', alignItems: 'flex-end', gap: 12 },
  timeField: { flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
  select: {
    height: 40,
    padding: '0 10px',
    borderRadius: 8,
    border: '1px solid #E0E0E0',
    background: '#ffffff',
    fontFamily: 'inherit',
    fontSize: 15,
    color: '#1a1a1a',
  },
  duration: { flex: 'none', minWidth: 72, height: 40, display: 'flex', alignItems: 'center', fontSize: 14, fontWeight: 600 },
  input: {
    height: 42,
    padding: '0 14px',
    borderRadius: 10,
    border: '1px solid #E0E0E0',
    fontFamily: 'inherit',
    fontSize: 15,
    color: '#1a1a1a',
    outline: 'none',
  },
  dateRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  dateOther: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#6b6b6b' },
  dateInput: {
    height: 34,
    padding: '0 8px',
    borderRadius: 8,
    border: '1px solid #E0E0E0',
    fontFamily: 'inherit',
    fontSize: 14,
    color: '#1a1a1a',
  },
  inline: { display: 'flex', alignItems: 'center', gap: 12 },
  fieldError: { fontSize: 13, color: '#B91C1C' },
  inputReadOnly: { background: '#F7F7F7', color: '#6b6b6b' },
  info: {
    display: 'flex',
    gap: 8,
    padding: '10px 14px',
    borderRadius: 8,
    background: '#F7F7F7',
    border: '1px solid #E5E5E5',
    fontSize: 14,
    lineHeight: 1.5,
  },
  warn: { margin: 0, paddingLeft: 20, fontSize: 14, color: '#92400E' },
  error: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '10px 14px',
    borderRadius: 8,
    background: '#FEF2F2',
    color: '#B91C1C',
    fontSize: 14,
  },
  errorList: { margin: 0, paddingLeft: 20 },
}
