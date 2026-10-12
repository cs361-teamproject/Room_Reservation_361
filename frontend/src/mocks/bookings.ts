// In-memory stand-in for the booking endpoints of T5–T7 while the frontend is built without them.
// Shapes, status codes and error messages follow the backend, so switching to the real API
// is only a matter of turning VITE_USE_MOCK_BOOKINGS off (see services/bookings.ts).
// Data lives until the page reloads.
import { ApiError } from '../services/api'
import { getRoom } from '../services/rooms'
import type {
  BookingDetail,
  BookingEvent,
  BookingEventAction,
  CreateBookingInput,
  MyBooking,
  MyBookingsScope,
  Page,
  RoomRules,
  UpdateBookingTimeInput,
  UserRole,
} from '../types/booking'
import { addDays, bkkToday } from '../utils/bkkDate'

/** Logged-in user until T3 brings real login */
export const MOCK_USER = {
  id: 'mock-student-1',
  username: '6709616541',
  role: 'STUDENT' as UserRole,
  display_name: 'นักศึกษา ทดสอบ 1',
}

/** Same rules as the backend seed, keyed by room name */
export const MOCK_ROOM_RULES: Record<string, RoomRules> = {
  'LC-101': { max_hours: 3, allowed_roles: ['LECTURER'] },
  'LC-102': { max_hours: 3, allowed_roles: ['LECTURER'] },
  'LC-103': { max_hours: 2, allowed_roles: ['STUDENT', 'LECTURER'] },
  'LC-104': { max_hours: 2, allowed_roles: ['STUDENT', 'LECTURER'] },
  'LC-105': { max_hours: 2, allowed_roles: ['STUDENT', 'LECTURER'] },
  'LC-106': { max_hours: 2, allowed_roles: ['STUDENT', 'LECTURER'] },
  'Co-working Space': { max_hours: 4, allowed_roles: ['STUDENT', 'LECTURER'] },
}
export const DEFAULT_ROOM_RULES: RoomRules = { max_hours: 2, allowed_roles: ['STUDENT', 'LECTURER'] }

const ROLE_LABELS: Record<UserRole, string> = {
  STUDENT: 'นักศึกษา',
  LECTURER: 'อาจารย์',
  STAFF: 'เจ้าหน้าที่',
  ADMIN: 'ผู้ดูแลระบบ',
}
const HOUR_MS = 3_600_000

type StoredBooking = BookingDetail
/** Timeline of each booking, by booking id */
const eventsById = new Map<string, BookingEvent[]>()

const iso = (ymd: string, time: string) => new Date(`${ymd}T${time}:00+07:00`).toISOString()
const delay = () => new Promise((r) => setTimeout(r, 350 + Math.random() * 250))
let nextId = 1

function seed(): StoredBooking[] {
  const today = bkkToday()
  const day = (n: number) => addDays(today, n)
  const make = (
    roomName: string,
    title: string,
    ymd: string,
    from: string,
    to: string,
    status: BookingDetail['status'],
    reason?: string,
  ): StoredBooking => {
    const created = new Date(Date.parse(iso(ymd, from)) - 3 * 86_400_000).toISOString()
    const decided = new Date(Date.parse(created) + 2 * HOUR_MS).toISOString()
    const events: BookingEvent[] = [{ action: 'CREATED', by: MOCK_USER.display_name, at: created, note: null }]
    if (status === 'APPROVED') events.push({ action: 'APPROVED', by: 'เจ้าหน้าที่ ทดสอบ', at: decided, note: null })
    if (status === 'REJECTED') events.push({ action: 'REJECTED', by: 'เจ้าหน้าที่ ทดสอบ', at: decided, note: reason ?? null })
    if (status === 'CANCELLED') events.push({ action: 'CANCELLED', by: MOCK_USER.display_name, at: decided, note: reason ?? null })
    const booking: StoredBooking = {
      id: `mock-${nextId++}`,
      title,
      booking_type: 'STUDENT_BOOKING',
      status,
      start_time: iso(ymd, from),
      end_time: iso(ymd, to),
      room: { id: `mock-room-${roomName}`, room_name: roomName },
      reject_reason: status === 'REJECTED' ? (reason ?? null) : null,
      cancel_reason: status === 'CANCELLED' ? (reason ?? null) : null,
      created_at: created,
    }
    eventsById.set(booking.id, events)
    return booking
  }
  return [
    make('LC-106', 'ประชุมโปรเจกต์กลุ่ม', day(1), '10:00', '12:00', 'PENDING'),
    make('LC-103', 'ติวสอบกลางภาค', day(2), '15:00', '17:00', 'APPROVED'),
    make('Co-working Space', 'ทำโปรเจกต์จบ', day(4), '09:00', '12:00', 'PENDING'),
    make('LC-104', 'ซ้อมนำเสนองาน', day(5), '13:00', '15:00', 'REJECTED', 'ห้องถูกใช้จัดกิจกรรมของภาควิชา'),
    make('LC-106', 'ประชุมชมรม', day(3), '16:00', '18:00', 'CANCELLED', 'เลื่อนการประชุม'),
    make('LC-106', 'นัดพบอาจารย์ที่ปรึกษา', day(-3), '10:00', '11:00', 'APPROVED'),
    make('Co-working Space', 'อ่านหนังสือสอบ', day(-5), '13:00', '16:00', 'APPROVED'),
    make('LC-103', 'ติวสอบย่อย', day(-8), '15:00', '17:00', 'REJECTED', 'จำนวนผู้ใช้น้อยเกินไปสำหรับห้องบรรยาย'),
    make('LC-104', 'ประชุมทีมแข่งขัน', day(-10), '09:00', '11:00', 'APPROVED'),
    make('LC-106', 'สัมภาษณ์ฝึกงาน (ซ้อม)', day(-12), '14:00', '15:00', 'APPROVED'),
    make('LC-103', 'ติวคณิตศาสตร์', day(-14), '10:00', '12:00', 'APPROVED'),
    make('LC-106', 'ประชุมกลุ่มย่อย', day(-15), '13:00', '14:00', 'CANCELLED', 'สมาชิกไม่ว่าง'),
  ]
}

const store: StoredBooking[] = seed()

const blocking = (b: StoredBooking) => b.status === 'PENDING' || b.status === 'APPROVED'
const find = (id: string) => {
  const b = store.find((x) => x.id === id)
  if (!b) throw new ApiError(404, 'Booking not found')
  return b
}
const toDetail = (b: StoredBooking): BookingDetail => ({ ...b, room: { ...b.room } })

/** The same rule checks as the backend: 400 with every broken rule */
function ruleViolations(rules: RoomRules, roomStatus: string, start: number, end: number): string[] {
  const problems: string[] = []
  if (roomStatus !== 'AVAILABLE') problems.push('ห้องนี้ปิดปรับปรุง ยังจองไม่ได้')
  if (start <= Date.now()) problems.push('start_time: ต้องเป็นเวลาในอนาคต')
  if (end <= start) problems.push('end_time: ต้องอยู่หลัง start_time')
  else if (end - start > rules.max_hours * HOUR_MS) problems.push(`ห้องนี้จองได้ไม่เกิน ${rules.max_hours} ชั่วโมงต่อครั้ง`)
  return problems
}

function assertFree(roomName: string, start: number, end: number, ignoreId?: string) {
  const clash = store.some(
    (b) =>
      b.id !== ignoreId &&
      blocking(b) &&
      b.room.room_name === roomName &&
      Date.parse(b.start_time) < end &&
      Date.parse(b.end_time) > start,
  )
  if (clash) throw new ApiError(409, 'ช่วงเวลานี้มีการจองแล้ว')
}

const event = (action: BookingEventAction, note: string | null = null): BookingEvent => ({
  action,
  by: MOCK_USER.display_name,
  at: new Date().toISOString(),
  note,
})

export const mockBookings = {
  async create(input: CreateBookingInput): Promise<BookingDetail> {
    await delay()
    const room = await getRoom(input.room_id).catch(() => null)
    if (!room) throw new ApiError(404, 'Room not found')
    const rules = MOCK_ROOM_RULES[room.name] ?? DEFAULT_ROOM_RULES
    if (!rules.allowed_roles.includes(MOCK_USER.role)) {
      throw new ApiError(403, `ห้องนี้จองได้เฉพาะ${rules.allowed_roles.map((r) => ROLE_LABELS[r]).join(' และ ')}`)
    }
    const start = Date.parse(input.start_time)
    const end = Date.parse(input.end_time)
    const problems = ruleViolations(rules, room.status, start, end)
    if (problems.length) throw new ApiError(400, problems)
    assertFree(room.name, start, end)

    const now = new Date().toISOString()
    const booking: StoredBooking = {
      id: `mock-${nextId++}`,
      title: input.title ?? null,
      booking_type: MOCK_USER.role === 'LECTURER' ? 'CLASS' : 'STUDENT_BOOKING',
      status: 'PENDING',
      start_time: new Date(start).toISOString(),
      end_time: new Date(end).toISOString(),
      room: { id: room.id, room_name: room.name },
      reject_reason: null,
      cancel_reason: null,
      created_at: now,
    }
    store.push(booking)
    eventsById.set(booking.id, [{ action: 'CREATED', by: MOCK_USER.display_name, at: now, note: null }])
    return toDetail(booking)
  },

  async listMine(scope: MyBookingsScope, page: number, limit: number): Promise<Page<MyBooking>> {
    await delay()
    const now = Date.now()
    const rows = store
      .filter((b) => {
        const ended = Date.parse(b.end_time) <= now
        if (scope === 'upcoming') return !ended && blocking(b)
        if (scope === 'past') return ended
        return true
      })
      // Upcoming: soonest first; history and all: newest first
      .sort((a, b) =>
        scope === 'upcoming'
          ? Date.parse(a.start_time) - Date.parse(b.start_time)
          : Date.parse(b.start_time) - Date.parse(a.start_time),
      )
    return {
      items: rows.slice((page - 1) * limit, page * limit).map((b) => ({
        id: b.id,
        room_name: b.room.room_name,
        start_time: b.start_time,
        end_time: b.end_time,
        status: b.status,
      })),
      page,
      limit,
      total: rows.length,
    }
  },

  async get(id: string): Promise<BookingDetail> {
    await delay()
    return toDetail(find(id))
  },

  async events(id: string): Promise<BookingEvent[]> {
    await delay()
    find(id)
    return [...(eventsById.get(id) ?? [])].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  },

  async updateTime(id: string, input: UpdateBookingTimeInput): Promise<BookingDetail> {
    await delay()
    const b = find(id)
    if (b.status !== 'PENDING') throw new ApiError(400, 'แก้เวลาได้เฉพาะการจองที่รออนุมัติ')
    const rules = MOCK_ROOM_RULES[b.room.room_name] ?? DEFAULT_ROOM_RULES
    const start = Date.parse(input.start_time)
    const end = Date.parse(input.end_time)
    const problems = ruleViolations(rules, 'AVAILABLE', start, end)
    if (problems.length) throw new ApiError(400, problems)
    assertFree(b.room.room_name, start, end, b.id)
    b.start_time = new Date(start).toISOString()
    b.end_time = new Date(end).toISOString()
    eventsById.get(b.id)?.push(event('UPDATED'))
    return toDetail(b)
  },

  async cancel(id: string, reason?: string): Promise<BookingDetail> {
    await delay()
    const b = find(id)
    if (!blocking(b) || Date.parse(b.start_time) <= Date.now()) {
      throw new ApiError(409, 'รายการนี้ถูกดำเนินการแล้ว หรือเลยเวลาเริ่มแล้ว')
    }
    b.status = 'CANCELLED'
    b.cancel_reason = reason || null
    eventsById.get(b.id)?.push(event('CANCELLED', reason || null))
    return toDetail(b)
  },
}
