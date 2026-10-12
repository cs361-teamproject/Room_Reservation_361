// In-memory stand-in for the booking endpoints of T5–T8 while the frontend is built without them.
// Shapes, status codes and error messages follow the backend, so switching to the real API
// is only a matter of turning VITE_USE_MOCK_BOOKINGS off (see services/bookings.ts).
// Data lives until the page reloads; the caller is whoever the NavBar role switcher says.
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
} from '../types/booking'
import { addDays, bkkToday } from '../utils/bkkDate'
import { mockRoomRules } from './rooms'
import { getMockUser, MOCK_USERS, ROLE_LABELS, type MockUser } from './session'

const HOUR_MS = 3_600_000
const OTHER_STUDENT: MockUser = { username: '6709000002', role: 'STUDENT', display_name: 'นักศึกษา ทดสอบ 2' }
/** Approves the 409-demo booking before the logged-in staff member can */
export const OTHER_STAFF = 'เจ้าหน้าที่ อีกคน'

export interface StoredBooking extends BookingDetail {
  owner: MockUser
  /** Demo of a 409: another staff member handles it first */
  handledElsewhere?: boolean
}

/** Timeline of each booking, by booking id */
export const eventsById = new Map<string, BookingEvent[]>()

const iso = (ymd: string, time: string) => new Date(`${ymd}T${time}:00+07:00`).toISOString()
export const delay = () => new Promise((r) => setTimeout(r, 350 + Math.random() * 250))
let nextId = 1

function seed(): StoredBooking[] {
  const today = bkkToday()
  const day = (n: number) => addDays(today, n)
  const student = MOCK_USERS.STUDENT
  const lecturer = MOCK_USERS.LECTURER
  const staff = MOCK_USERS.STAFF.display_name

  const make = (
    owner: MockUser,
    roomName: string,
    title: string,
    ymd: string,
    from: string,
    to: string,
    status: BookingDetail['status'],
    reason?: string,
  ): StoredBooking => {
    // Requests made a few days ahead; upcoming PENDING ones were sent recently, newest first
    const created =
      status === 'PENDING'
        ? new Date(Date.now() - (nextId * 37 + 20) * 60_000).toISOString()
        : new Date(Date.parse(iso(ymd, from)) - 3 * 86_400_000).toISOString()
    const decided = new Date(Date.parse(created) + 2 * HOUR_MS).toISOString()
    const events: BookingEvent[] = [{ action: 'CREATED', by: owner.display_name, at: created, note: null }]
    if (status === 'APPROVED') events.push({ action: 'APPROVED', by: staff, at: decided, note: null })
    if (status === 'REJECTED') events.push({ action: 'REJECTED', by: staff, at: decided, note: reason ?? null })
    if (status === 'CANCELLED') events.push({ action: 'CANCELLED', by: owner.display_name, at: decided, note: reason ?? null })
    const booking: StoredBooking = {
      id: `mock-${nextId++}`,
      title,
      booking_type: owner.role === 'LECTURER' ? 'CLASS' : 'STUDENT_BOOKING',
      status,
      start_time: iso(ymd, from),
      end_time: iso(ymd, to),
      room: { id: `room-${roomName}`, room_name: roomName },
      reject_reason: status === 'REJECTED' ? (reason ?? null) : null,
      cancel_reason: status === 'CANCELLED' ? (reason ?? null) : null,
      created_at: created,
      owner,
    }
    eventsById.set(booking.id, events)
    return booking
  }

  const rows = [
    // Student 1 (the default mock user)
    make(student, 'LC-106', 'ประชุมโปรเจกต์กลุ่ม', day(1), '10:00', '12:00', 'PENDING'),
    make(student, 'LC-103', 'ติวสอบกลางภาค', day(2), '15:00', '17:00', 'APPROVED'),
    make(student, 'Co-working Space', 'ทำโปรเจกต์จบ', day(4), '09:00', '12:00', 'PENDING'),
    make(student, 'LC-104', 'ซ้อมนำเสนองาน', day(5), '13:00', '15:00', 'REJECTED', 'ห้องถูกใช้จัดกิจกรรมของภาควิชา'),
    make(student, 'LC-106', 'ประชุมชมรม', day(3), '16:00', '18:00', 'CANCELLED', 'เลื่อนการประชุม'),
    make(student, 'LC-106', 'นัดพบอาจารย์ที่ปรึกษา', day(-3), '10:00', '11:00', 'APPROVED'),
    make(student, 'Co-working Space', 'อ่านหนังสือสอบ', day(-5), '13:00', '16:00', 'APPROVED'),
    make(student, 'LC-103', 'ติวสอบย่อย', day(-8), '15:00', '17:00', 'REJECTED', 'จำนวนผู้ใช้น้อยเกินไปสำหรับห้องบรรยาย'),
    make(student, 'LC-104', 'ประชุมทีมแข่งขัน', day(-10), '09:00', '11:00', 'APPROVED'),
    make(student, 'LC-106', 'สัมภาษณ์ฝึกงาน (ซ้อม)', day(-12), '14:00', '15:00', 'APPROVED'),
    make(student, 'LC-103', 'ติวคณิตศาสตร์', day(-14), '10:00', '12:00', 'APPROVED'),
    make(student, 'LC-106', 'ประชุมกลุ่มย่อย', day(-15), '13:00', '14:00', 'CANCELLED', 'สมาชิกไม่ว่าง'),
    // Other people, so the staff queue has more than one requester
    make(OTHER_STUDENT, 'LC-104', 'ติวฟิสิกส์ก่อนสอบ', day(1), '13:00', '15:00', 'PENDING'),
    make(OTHER_STUDENT, 'Co-working Space', 'ทำรายงานกลุ่ม', day(2), '09:00', '12:00', 'PENDING'),
    make(lecturer, 'LC-101', 'CS101 ปฏิบัติการ (ชดเชย)', day(3), '09:00', '12:00', 'PENDING'),
    make(lecturer, 'LC-103', 'สอบย่อย CS102', day(6), '13:00', '15:00', 'PENDING'),
    make(OTHER_STUDENT, 'LC-106', 'ประชุมชมรมดนตรี', day(2), '16:00', '18:00', 'PENDING'),
    make(lecturer, 'LC-102', 'CS211 ปฏิบัติการ', day(1), '09:00', '12:00', 'APPROVED'),
    make(OTHER_STUDENT, 'LC-103', 'อ่านหนังสือกลุ่ม', day(4), '10:00', '12:00', 'REJECTED', 'ข้อมูลวัตถุประสงค์ไม่เพียงพอ'),
    make(lecturer, 'LC-104', 'บรรยายพิเศษ', day(-2), '13:00', '15:00', 'APPROVED'),
    make(OTHER_STUDENT, 'LC-106', 'ประชุมโครงงาน', day(-4), '10:00', '12:00', 'APPROVED'),
  ]
  // "ประชุมชมรมดนตรี" gets approved by someone else the moment staff acts on it (409 demo)
  rows.find((b) => b.title === 'ประชุมชมรมดนตรี')!.handledElsewhere = true
  return rows
}

export const bookingStore: StoredBooking[] = seed()

export const blocking = (b: StoredBooking) => b.status === 'PENDING' || b.status === 'APPROVED'
export const findBooking = (id: string) => {
  const b = bookingStore.find((x) => x.id === id)
  if (!b) throw new ApiError(404, 'Booking not found')
  return b
}
const owns = (b: StoredBooking, user: MockUser) => b.owner.username === user.username
const isStaff = (user: MockUser) => user.role === 'STAFF' || user.role === 'ADMIN'

/** Owner view; STAFF/ADMIN also see who booked it. Not yours and not staff: 404, like the API. */
export function toDetail(b: StoredBooking, viewer: MockUser): BookingDetail {
  if (!owns(b, viewer) && !isStaff(viewer)) throw new ApiError(404, 'Booking not found')
  const { owner, ...detail } = b
  delete detail.handledElsewhere
  return {
    ...detail,
    room: { ...b.room },
    ...(isStaff(viewer) && { user: { display_name: owner.display_name, role: owner.role } }),
  }
}

export const newEvent = (action: BookingEventAction, by: string, note: string | null = null): BookingEvent => ({
  action,
  by,
  at: new Date().toISOString(),
  note,
})

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
  const clash = bookingStore.some(
    (b) =>
      b.id !== ignoreId &&
      blocking(b) &&
      b.room.room_name === roomName &&
      Date.parse(b.start_time) < end &&
      Date.parse(b.end_time) > start,
  )
  if (clash) throw new ApiError(409, 'ช่วงเวลานี้มีการจองแล้ว')
}

export const mockBookings = {
  async create(input: CreateBookingInput): Promise<BookingDetail> {
    await delay()
    const user = getMockUser()
    if (user.role !== 'STUDENT' && user.role !== 'LECTURER') throw new ApiError(403, 'You do not have permission to do this')
    const room = await getRoom(input.room_id).catch(() => null)
    if (!room) throw new ApiError(404, 'Room not found')
    const rules = mockRoomRules(room.name)
    if (!rules.allowed_roles.includes(user.role)) {
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
      booking_type: user.role === 'LECTURER' ? 'CLASS' : 'STUDENT_BOOKING',
      status: 'PENDING',
      start_time: new Date(start).toISOString(),
      end_time: new Date(end).toISOString(),
      room: { id: room.id, room_name: room.name },
      reject_reason: null,
      cancel_reason: null,
      created_at: now,
      owner: user,
    }
    bookingStore.push(booking)
    eventsById.set(booking.id, [newEvent('CREATED', user.display_name)])
    return toDetail(booking, user)
  },

  async listMine(scope: MyBookingsScope, page: number, limit: number): Promise<Page<MyBooking>> {
    await delay()
    const user = getMockUser()
    const now = Date.now()
    const rows = bookingStore
      .filter((b) => owns(b, user))
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
    return toDetail(findBooking(id), getMockUser())
  },

  async events(id: string): Promise<BookingEvent[]> {
    await delay()
    toDetail(findBooking(id), getMockUser()) // same visibility as the booking itself
    return [...(eventsById.get(id) ?? [])].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  },

  async updateTime(id: string, input: UpdateBookingTimeInput): Promise<BookingDetail> {
    await delay()
    const user = getMockUser()
    const b = findBooking(id)
    if (!owns(b, user)) throw new ApiError(404, 'Booking not found')
    if (b.status !== 'PENDING') throw new ApiError(400, 'แก้เวลาได้เฉพาะการจองที่รออนุมัติ')
    const start = Date.parse(input.start_time)
    const end = Date.parse(input.end_time)
    const problems = ruleViolations(mockRoomRules(b.room.room_name), 'AVAILABLE', start, end)
    if (problems.length) throw new ApiError(400, problems)
    assertFree(b.room.room_name, start, end, b.id)
    b.start_time = new Date(start).toISOString()
    b.end_time = new Date(end).toISOString()
    eventsById.get(b.id)?.push(newEvent('UPDATED', user.display_name))
    return toDetail(b, user)
  },

  async cancel(id: string, reason?: string): Promise<BookingDetail> {
    await delay()
    const user = getMockUser()
    const b = findBooking(id)
    if (!owns(b, user)) throw new ApiError(404, 'Booking not found')
    if (!blocking(b) || Date.parse(b.start_time) <= Date.now()) {
      throw new ApiError(409, 'รายการนี้ถูกดำเนินการแล้ว หรือเลยเวลาเริ่มแล้ว')
    }
    b.status = 'CANCELLED'
    b.cancel_reason = reason || null
    eventsById.get(b.id)?.push(newEvent('CANCELLED', user.display_name, reason || null))
    return toDetail(b, user)
  },
}
