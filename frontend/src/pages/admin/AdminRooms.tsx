import { useState } from 'react'
import type { CSSProperties } from 'react'
import Modal from '../../components/Modal'
import RoomFormModal from '../../components/RoomFormModal'
import { useToast } from '../../components/Toast'
import { dangerBtn, disabledBtn, ghostDangerBtn, primaryBtn, secondaryBtn } from '../../components/buttons'
import { useAsync } from '../../hooks/useAsync'
import { useMockUser } from '../../mocks/session'
import { ApiError } from '../../services/api'
import { deleteRoom, getAdminRooms, updateRoom } from '../../services/admin'
import type { AdminRoom, RoomStatus } from '../../types/admin'
import { rolesLabel } from '../../utils/bookingRules'
import { ROOM_TYPE_LABELS } from '../../utils/roomLabels'

type Dialog = { kind: 'create' } | { kind: 'edit'; room: AdminRoom } | { kind: 'delete'; room: AdminRoom } | null

export default function AdminRooms() {
  const user = useMockUser()
  const isAdmin = user.role === 'ADMIN'
  const [dialog, setDialog] = useState<Dialog>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const { toast, show } = useToast()
  const { data, previous, error, loading, reload } = useAsync(`rooms|${user.role}`, getAdminRooms)
  const rooms = data ?? (loading ? previous : undefined)

  const setStatus = async (room: AdminRoom, status: RoomStatus) => {
    setBusyId(room.id)
    try {
      await updateRoom(room.id, { status })
      show(`${room.room_name}: ${status === 'AVAILABLE' ? 'เปิดให้จองแล้ว' : 'ปิดปรับปรุงแล้ว'}`)
      reload()
    } catch (e) {
      show(e instanceof ApiError ? e.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div className="admin-head" style={styles.headRow}>
        <h1 style={styles.heading}>จัดการห้อง</h1>
        <button style={primaryBtn} onClick={() => setDialog({ kind: 'create' })}>
          + เพิ่มห้อง
        </button>
      </div>

      {error ? (
        <div style={styles.error}>
          <span>โหลดรายการห้องไม่สำเร็จ: {error}</span>
          <button style={secondaryBtn} onClick={reload}>
            ลองใหม่
          </button>
        </div>
      ) : !rooms ? (
        <div style={{ ...styles.card, height: 420, background: '#EDEDED', boxShadow: 'none' }} />
      ) : (
        <div className="admin-rooms" style={{ ...styles.card, opacity: loading ? 0.6 : 1 }}>
          <div className="admin-room-row admin-room-headrow" style={{ ...styles.row, ...styles.headCells }}>
            <span>ห้อง</span>
            <span>ประเภท</span>
            <span>ความจุ</span>
            <span>สถานะ</span>
            <span>กติกาการจอง</span>
            <span />
          </div>
          {rooms.map((room) => (
            <div key={room.id} className="admin-room-row" style={styles.row}>
              <span style={styles.nameCell}>
                {room.photos[0] ? (
                  <img src={room.photos[0].url} alt="" style={styles.thumb} />
                ) : (
                  <span style={{ ...styles.thumb, ...styles.noThumb }}>ไม่มีรูป</span>
                )}
                <span style={styles.nameText}>
                  <b style={styles.roomName}>{room.room_name}</b>
                  <span style={styles.desc}>{room.description}</span>
                </span>
              </span>
              <span className="admin-room-cell" data-label="ประเภท">
                {ROOM_TYPE_LABELS[room.room_type]}
              </span>
              <span className="admin-room-cell" data-label="ความจุ">
                {room.seat_capacity} ที่นั่ง
              </span>
              <span className="admin-room-cell" data-label="สถานะ">
                <select
                  value={room.status}
                  disabled={busyId === room.id}
                  onChange={(e) => setStatus(room, e.target.value as RoomStatus)}
                  style={{ ...styles.statusSelect, ...(room.status === 'AVAILABLE' ? styles.open : styles.closed) }}
                  aria-label={`สถานะ ${room.room_name}`}
                >
                  <option value="AVAILABLE">● เปิดให้จอง</option>
                  <option value="MAINTENANCE">● ปิดปรับปรุง</option>
                </select>
              </span>
              <span className="admin-room-cell" data-label="กติกา" style={styles.rules}>
                {room.max_hours} ชม./ครั้ง · {rolesLabel(room.allowed_roles)}
              </span>
              <span className="admin-room-actions" style={styles.actions}>
                <button style={{ ...secondaryBtn, ...styles.smallBtn }} onClick={() => setDialog({ kind: 'edit', room })}>
                  แก้ไข
                </button>
                <button style={{ ...ghostDangerBtn, ...styles.smallBtn }} onClick={() => setDialog({ kind: 'delete', room })}>
                  ลบ
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {(dialog?.kind === 'create' || dialog?.kind === 'edit') && (
        <RoomFormModal
          room={dialog.kind === 'edit' ? dialog.room : undefined}
          canEditRules={isAdmin}
          onClose={() => {
            setDialog(null)
            reload() // photos are saved as they change, even when the form is closed without saving
          }}
          onSaved={(room) => {
            setDialog(null)
            show(dialog.kind === 'edit' ? `บันทึก ${room.room_name} แล้ว` : `เพิ่มห้อง ${room.room_name} แล้ว`)
            reload()
          }}
        />
      )}
      {dialog?.kind === 'delete' && (
        <DeleteRoomDialog
          room={dialog.room}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null)
            show(`ลบห้อง ${dialog.room.room_name} แล้ว`)
            reload()
          }}
        />
      )}
      {toast}
    </div>
  )
}

function DeleteRoomDialog({ room, onClose, onDone }: { room: AdminRoom; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await deleteRoom(room.id)
      onDone()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'ลบไม่สำเร็จ กรุณาลองใหม่')
      setBusy(false)
    }
  }

  return (
    <Modal
      title="ลบห้อง"
      width={460}
      onClose={onClose}
      footer={
        <>
          <button style={secondaryBtn} onClick={onClose}>
            ยกเลิก
          </button>
          <button style={{ ...dangerBtn, ...(busy ? disabledBtn : null) }} disabled={busy} onClick={confirm}>
            {busy ? 'กำลังลบ…' : 'ยืนยันการลบ'}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>
        ต้องการลบห้อง <b>{room.room_name}</b> ใช่ไหม? ห้องจะหายจากหน้ารายการห้อง ส่วนประวัติการจองยังเก็บไว้
      </p>
      {error && (
        <p role="alert" style={{ ...styles.error, margin: '14px 0 0', padding: '10px 14px', borderRadius: 8, background: '#FEF2F2' }}>
          {error}
        </p>
      )}
    </Modal>
  )
}

const styles: Record<string, CSSProperties> = {
  headRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 20 },
  heading: { margin: 0, fontSize: 26, fontWeight: 600 },
  error: { display: 'flex', alignItems: 'center', gap: 14, color: '#B91C1C', fontSize: 14, padding: '24px 0' },
  card: {
    background: '#ffffff',
    borderRadius: 14,
    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
    padding: '8px 24px',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: 'minmax(160px, 1.6fr) 1fr 0.8fr 1.1fr 1.4fr auto',
    alignItems: 'center',
    gap: 16,
    padding: '16px 0',
    borderBottom: '1px solid #F0F0F0',
    fontSize: 15,
  },
  headCells: { padding: '12px 0', fontSize: 13, color: '#6b6b6b', fontWeight: 600 },
  nameCell: { display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 },
  nameText: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  thumb: { width: 56, height: 42, flex: 'none', borderRadius: 6, objectFit: 'cover', background: '#EDEDED' },
  noThumb: { display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#9a9a9a' },
  roomName: { fontSize: 17 },
  desc: { fontSize: 13, color: '#9a9a9a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  statusSelect: {
    height: 34,
    padding: '0 8px',
    borderRadius: 999,
    fontFamily: 'inherit',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  open: { background: '#F0FDF4', color: '#15803D', border: '1.5px solid #BBF7D0' },
  closed: { background: '#FEF2F2', color: '#B91C1C', border: '1.5px solid #FECACA' },
  rules: { fontSize: 14, color: '#4b4b4b' },
  actions: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  smallBtn: { height: 34, padding: '0 12px', fontSize: 14 },
}
