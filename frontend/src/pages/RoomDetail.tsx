import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import RoomGallery from '../components/RoomGallery'
import EquipmentBar from '../components/EquipmentBar'
import BookingRules from '../components/BookingRules'
import RoomSchedule from '../components/RoomSchedule'
import BookingFormModal from '../components/BookingFormModal'
import { rolesLabel } from '../utils/bookingRules'
import { useToast } from '../components/Toast'
import { disabledBtn, primaryBtn } from '../components/buttons'
import { useAuth } from '../auth/context'
import { useAsync } from '../hooks/useAsync'
import { getRoom, rulesOf } from '../services/rooms'
import { getUsers } from '../services/users'
import monitorIcon from '../assets/icon-mornitor.png'

const STATUS_TAG: Record<string, { label: string; color: string }> = {
  AVAILABLE: { label: 'Available', color: '#22C55E' },
  MAINTENANCE: { label: 'ปิดปรับปรุง', color: '#EF4444' },
  RESERVED: { label: 'Reserved', color: '#F59E0B' },
}

export default function RoomDetail() {
  const { id = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { data: room, error, loading } = useAsync(id, () => getRoom(id))
  const location = useLocation()
  const [booking, setBooking] = useState(false)
  // Bumped after a booking so the schedule fetches again and shows it
  const [scheduleVersion, setScheduleVersion] = useState(0)
  const { status: authStatus, user } = useAuth()
  // Staff book on someone's behalf: the people a room can be booked for
  const isStaff = user?.role === 'STAFF'
  const bookFor = useAsync(`book-for|${isStaff}`, () => (isStaff ? getUsers(['LECTURER', 'STUDENT']) : Promise.resolve(null)))
  const { toast, show } = useToast()

  if (loading) {
    return (
      <main className="room-detail-page" style={styles.main}>
        <div style={styles.container}>
          <div style={{ ...styles.card, height: 520, background: '#EDEDED', boxShadow: 'none' }} />
        </div>
      </main>
    )
  }

  if (error || !room) {
    return (
      <main style={styles.notFound}>
        <p>ไม่พบห้องที่ต้องการ</p>
      </main>
    )
  }

  const status = STATUS_TAG[room.status] ?? { label: room.status, color: '#6b6b6b' }
  const rules = rulesOf(room)
  // Logged out: the button leads to the login page and back here
  const blockedReason =
    room.status !== 'AVAILABLE'
      ? 'ห้องนี้ปิดปรับปรุง ยังจองไม่ได้'
      : authStatus === 'loading'
        ? 'กำลังตรวจสอบการเข้าสู่ระบบ…'
        : user?.role === 'ADMIN'
          ? 'ผู้ดูแลระบบจัดการห้องได้ แต่ไม่ได้จองห้อง'
          : user && !isStaff && !rules.allowed_roles.includes(user.role)
            ? `ห้องนี้จองได้เฉพาะ${rolesLabel(rules.allowed_roles)}`
            : null
  const startBooking = () =>
    user ? setBooking(true) : navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`)

  return (
    <main className="room-detail-page" style={styles.main}>
      <div style={styles.container}>
        <button onClick={() => navigate(-1)} style={styles.back}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flex: 'none' }}
          >
            <line x1="20" y1="12" x2="4" y2="12" />
            <polyline points="10 6 4 12 10 18" />
          </svg>
          <span>ย้อนกลับ</span>
        </button>

        <div className="room-detail-card" style={styles.card}>
          <RoomGallery images={room.images} alt={room.name} />

          <div className="room-detail-head" style={styles.headRow}>
            <div style={styles.titleCol}>
              <h1 className="room-detail-title" style={styles.title}>{room.name}</h1>
              <p style={styles.desc}>{room.desc}</p>
            </div>
            <div className="room-detail-tags" style={styles.tags}>
              <span className="room-detail-capacity" style={styles.capacityTag}>
                <img src={monitorIcon} alt="capacity" style={styles.capacityIcon} />
                <span style={styles.capacityText}>Seat: </span>
                <span style={styles.capacityValue}>{room.seats ?? 'ไม่ระบุ'}</span>
              </span>
              <span className="room-detail-status" style={{ ...styles.statusTag, background: status.color }}>
                {status.label}
              </span>
              <button
                className="room-detail-book"
                style={{ ...primaryBtn, ...styles.bookBtn, ...(blockedReason ? disabledBtn : null) }}
                disabled={Boolean(blockedReason)}
                title={blockedReason ?? undefined}
                onClick={startBooking}
              >
                {isStaff ? 'จองแทน' : user || authStatus === 'loading' ? 'จองห้องนี้' : 'เข้าสู่ระบบเพื่อจอง'}
              </button>
            </div>
          </div>
          {blockedReason && authStatus !== 'loading' && <p style={styles.blocked}>{blockedReason}</p>}

          <EquipmentBar room={room} />
        </div>

        <RoomSchedule
          key={scheduleVersion}
          roomId={room.id}
          closed={room.status !== 'AVAILABLE'}
          focusDate={searchParams.get('date') ?? undefined}
        />

        <BookingRules rules={rules} />
      </div>

      {booking && (
        <BookingFormModal
          room={{ id: room.id, name: room.name, seatCapacity: room.seats ?? null }}
          rules={rules}
          bookForOptions={isStaff ? (bookFor.data ?? []) : undefined}
          onClose={() => setBooking(false)}
          onDone={() => {
            setBooking(false)
            setScheduleVersion((v) => v + 1)
            show(
              <>
                {isStaff ? 'จองแทนเรียบร้อย อนุมัติแล้ว' : 'ส่งคำขอแล้ว รอเจ้าหน้าที่อนุมัติ'}
                <Link to={isStaff ? '/admin/bookings' : '/my-bookings'} style={styles.toastLink}>
                  {isStaff ? 'ดูรายการจอง' : 'ดูการจองของฉัน'}
                </Link>
              </>,
            )
          }}
        />
      )}
      {toast}
    </main>
  )
}

const styles: Record<string, CSSProperties> = {
  main: { padding: '32px 40px 80px' },
  notFound: { padding: '80px 40px', textAlign: 'center', color: '#6b6b6b' },
  container: { maxWidth: 1240, margin: '0 auto' },
  back: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
    padding: '6px 4px',
    background: 'transparent',
    border: 'none',
    fontFamily: 'inherit',
    fontSize: 17,
    color: '#1a1a1a',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  card: {
    background: '#ffffff',
    borderRadius: 14,
    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
    padding: 28,
  },
  headRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 40,
    marginTop: 36,
  },
  titleCol: { display: 'flex', flexDirection: 'column', gap: 6 },
  title: { margin: 0, fontSize: 26, fontWeight: 600, color: '#1a1a1a' },
  desc: { margin: 0, fontSize: 14, color: '#6b6b6b' },
  tags: { display: 'flex', alignItems: 'center', gap: 20, flex: 'none' },
  capacityTag: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    height: 40,
    padding: '0 18px 0 12px',
    background: '#111111',
    color: '#ffffff',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  capacityIcon: {
    width: 18,
    height: 18,
    display: 'block',
    objectFit: 'contain',
    filter: 'brightness(0) invert(1)',
  },
  capacityText: { fontSize: 15, fontWeight: 600 },
  capacityValue: { fontSize: 15, fontWeight: 700 },
  bookBtn: { height: 40, minWidth: 150 },
  blocked: { margin: '12px 0 0', textAlign: 'right', fontSize: 14, color: '#B91C1C' },
  toastLink: { color: '#FCD34D', fontWeight: 600, whiteSpace: 'nowrap' },
  statusTag: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 150,
    height: 40,
    background: '#22C55E',
    color: '#ffffff',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
}
