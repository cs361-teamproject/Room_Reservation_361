import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import Modal from './Modal'
import RoomPhotosEditor from './RoomPhotosEditor'
import { disabledBtn, primaryBtn, secondaryBtn } from './buttons'
import { ApiError } from '../services/api'
import { createRoom, updateRoom, updateRoomRules } from '../services/admin'
import type { AdminRoom, RoomSize, RoomType } from '../types/admin'
import type { UserRole } from '../types/booking'
import { rolesLabel } from '../utils/bookingRules'
import { ROOM_TYPE_LABELS, SIZE_LABELS } from '../utils/roomLabels'

// Roles a rule can open a room to (STAFF/ADMIN do not book rooms)
const BOOKING_ROLES: UserRole[] = ['STUDENT', 'LECTURER']

interface FormValues {
  room_name: string
  description: string
  room_type: RoomType
  size: RoomSize
  seat_capacity: number
  status: 'AVAILABLE' | 'MAINTENANCE'
  max_hours: number
  allowed_roles: UserRole[]
}

interface Props {
  /** Edit this room; leave out to create one */
  room?: AdminRoom
  /** ADMIN may change the booking rules; STAFF only sees them */
  canEditRules: boolean
  onClose: () => void
  onSaved: (room: AdminRoom) => void
}

export default function RoomFormModal({ room, canEditRules, onClose, onSaved }: Props) {
  const { register, handleSubmit, control, setValue, formState } = useForm<FormValues>({
    defaultValues: {
      room_name: room?.room_name ?? '',
      description: room?.description ?? '',
      room_type: room?.room_type ?? 'LECTURE',
      size: room?.size ?? 'MEDIUM',
      // Unknown capacity stays empty: saving must not invent one
      seat_capacity: room ? (room.seat_capacity ?? NaN) : 30,
      status: room?.status ?? 'AVAILABLE',
      max_hours: room?.max_hours ?? 2,
      allowed_roles: room?.allowed_roles ?? ['STUDENT', 'LECTURER'],
    },
  })
  const [maxHours, allowedRoles] = useWatch({ control, name: ['max_hours', 'allowed_roles'] })
  const [serverError, setServerError] = useState<string[] | null>(null)
  const { errors, isSubmitting } = formState
  const noRoles = allowedRoles.length === 0

  const toggleRole = (role: UserRole) =>
    setValue('allowed_roles', allowedRoles.includes(role) ? allowedRoles.filter((r) => r !== role) : [...allowedRoles, role])

  const onSubmit = handleSubmit(async (v) => {
    if (canEditRules && noRoles) return
    setServerError(null)
    const input = {
      room_name: v.room_name.trim(),
      description: v.description.trim() || null,
      room_type: v.room_type,
      size: v.size,
      // Empty only for a room whose capacity is unknown; the field is required when creating
      seat_capacity: Number.isNaN(v.seat_capacity) ? null : v.seat_capacity,
      status: v.status,
    }
    try {
      // An unknown capacity is left as it is (not sent) instead of being set to a guess
      let saved = room
        ? await updateRoom(room.id, { ...input, seat_capacity: input.seat_capacity ?? undefined })
        : await createRoom(input)
      const rulesChanged =
        saved.max_hours !== v.max_hours || [...saved.allowed_roles].sort().join() !== [...v.allowed_roles].sort().join()
      if (canEditRules && rulesChanged) {
        saved = await updateRoomRules(saved.id, { max_hours: v.max_hours, allowed_roles: v.allowed_roles })
      }
      onSaved(saved)
    } catch (e) {
      setServerError(e instanceof ApiError ? e.messages : ['บันทึกไม่สำเร็จ กรุณาลองใหม่'])
    }
  })

  const blocked = isSubmitting || (canEditRules && noRoles)

  return (
    <Modal
      title={room ? `แก้ไขห้อง ${room.room_name}` : 'เพิ่มห้อง'}
      width={600}
      onClose={onClose}
      footer={
        <>
          <button type="button" style={secondaryBtn} onClick={onClose}>
            ยกเลิก
          </button>
          <button type="submit" form="room-form" style={{ ...primaryBtn, ...(blocked ? disabledBtn : null) }} disabled={blocked}>
            {isSubmitting ? 'กำลังบันทึก…' : room ? 'บันทึก' : 'เพิ่มห้อง'}
          </button>
        </>
      }
    >
      <form id="room-form" onSubmit={onSubmit} style={styles.form}>
        <label style={styles.field}>
          <span style={styles.label}>ชื่อห้อง *</span>
          <input
            {...register('room_name', { required: 'กรุณาใส่ชื่อห้อง', maxLength: { value: 50, message: 'ไม่เกิน 50 ตัวอักษร' } })}
            placeholder="เช่น LC-107"
            style={styles.input}
          />
          {errors.room_name && <span style={styles.fieldError}>{errors.room_name.message}</span>}
        </label>

        <label style={styles.field}>
          <span style={styles.label}>คำอธิบาย</span>
          <input {...register('description', { maxLength: 200 })} placeholder="เช่น ห้องบรรยายขนาดกลาง" style={styles.input} />
        </label>

        <div className="room-form-row" style={styles.row}>
          <label style={styles.field}>
            <span style={styles.label}>ประเภท</span>
            <select {...register('room_type')} style={styles.select}>
              {(Object.keys(ROOM_TYPE_LABELS) as RoomType[]).map((t) => (
                <option key={t} value={t}>
                  {ROOM_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label style={styles.field}>
            <span style={styles.label}>ขนาด</span>
            <select {...register('size')} style={styles.select}>
              {(Object.keys(SIZE_LABELS) as RoomSize[]).map((s) => (
                <option key={s} value={s}>
                  {SIZE_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label style={styles.field}>
            <span style={styles.label}>ความจุ (ที่นั่ง)</span>
            <input
              type="number"
              {...register('seat_capacity', {
                valueAsNumber: true,
                required: room ? false : 'กรุณาใส่ความจุ',
                min: { value: 1, message: 'อย่างน้อย 1' },
                max: { value: 500, message: 'ไม่เกิน 500' },
              })}
              style={styles.input}
            />
            {errors.seat_capacity && <span style={styles.fieldError}>{errors.seat_capacity.message}</span>}
          </label>
        </div>

        <label style={styles.field}>
          <span style={styles.label}>สถานะ</span>
          <select {...register('status')} style={styles.select}>
            <option value="AVAILABLE">เปิดให้จอง</option>
            <option value="MAINTENANCE">ปิดปรับปรุง</option>
          </select>
        </label>

        <div style={styles.field}>
          <span style={styles.label}>รูปห้อง (รูปแรกคือรูปหลักที่แสดงในหน้ารายการห้อง)</span>
          {room ? (
            <RoomPhotosEditor roomId={room.id} initial={room.photos} />
          ) : (
            <span style={styles.hint}>เพิ่มห้องก่อน แล้วกด “แก้ไข” เพื่ออัปโหลดรูป</span>
          )}
        </div>

        <fieldset style={styles.rules}>
          <legend style={styles.rulesTitle}>กติกาการจอง</legend>
          {canEditRules ? (
            <>
              <div style={styles.ruleRow}>
                <span style={styles.ruleLabel}>จองได้ไม่เกินต่อครั้ง</span>
                <div style={styles.stepper}>
                  <button
                    type="button"
                    style={stepBtn(maxHours <= 1)}
                    disabled={maxHours <= 1}
                    onClick={() => setValue('max_hours', maxHours - 1)}
                    aria-label="ลดชั่วโมง"
                  >
                    −
                  </button>
                  <span style={styles.stepValue}>{maxHours} ชม.</span>
                  <button
                    type="button"
                    style={stepBtn(maxHours >= 12)}
                    disabled={maxHours >= 12}
                    onClick={() => setValue('max_hours', maxHours + 1)}
                    aria-label="เพิ่มชั่วโมง"
                  >
                    +
                  </button>
                </div>
              </div>
              <div style={styles.ruleRow}>
                <span style={styles.ruleLabel}>เปิดให้จอง</span>
                <div style={styles.checks}>
                  {BOOKING_ROLES.map((r) => (
                    <label key={r} style={styles.check}>
                      <input type="checkbox" checked={allowedRoles.includes(r)} onChange={() => toggleRole(r)} />
                      {rolesLabel([r])}
                    </label>
                  ))}
                </div>
              </div>
              {noRoles && <span style={styles.fieldError}>ต้องเลือกอย่างน้อย 1 บทบาท</span>}
            </>
          ) : (
            <p style={styles.readOnly}>
              จองได้ไม่เกิน {room?.max_hours ?? 2} ชม./ครั้ง · เปิดให้{rolesLabel(room?.allowed_roles ?? BOOKING_ROLES)}
              <br />
              <span style={styles.hint}>เฉพาะผู้ดูแลระบบที่แก้กติกาได้</span>
            </p>
          )}
        </fieldset>

        {serverError && (
          <div role="alert" style={styles.error}>
            {serverError.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
        )}
      </form>
    </Modal>
  )
}

function stepBtn(disabled: boolean): CSSProperties {
  return {
    width: 36,
    height: 36,
    borderRadius: 8,
    border: '1.5px solid #1a1a1a',
    background: '#ffffff',
    fontSize: 18,
    lineHeight: 1,
    fontFamily: 'inherit',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.3 : 1,
  }
}

const styles: Record<string, CSSProperties> = {
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 },
  row: { display: 'flex', gap: 12 },
  label: { fontSize: 13, color: '#6b6b6b' },
  input: {
    height: 42,
    padding: '0 14px',
    borderRadius: 10,
    border: '1px solid #E0E0E0',
    fontFamily: 'inherit',
    fontSize: 15,
    color: '#1a1a1a',
    outline: 'none',
    minWidth: 0,
  },
  select: {
    height: 42,
    padding: '0 10px',
    borderRadius: 10,
    border: '1px solid #E0E0E0',
    background: '#ffffff',
    fontFamily: 'inherit',
    fontSize: 15,
    color: '#1a1a1a',
  },
  fieldError: { fontSize: 13, color: '#B91C1C' },
  rules: {
    margin: 0,
    padding: '12px 16px 16px',
    borderRadius: 10,
    border: '1px solid #E5E5E5',
    background: '#F7F7F7',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  rulesTitle: { padding: '0 6px', fontSize: 14, fontWeight: 700 },
  ruleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  ruleLabel: { fontSize: 15 },
  stepper: { display: 'flex', alignItems: 'center', gap: 10 },
  stepValue: { minWidth: 56, textAlign: 'center', fontSize: 15, fontWeight: 700 },
  checks: { display: 'flex', gap: 16 },
  check: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, cursor: 'pointer' },
  readOnly: { margin: 0, fontSize: 15, lineHeight: 1.6 },
  hint: { fontSize: 13, color: '#9a9a9a' },
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
}
