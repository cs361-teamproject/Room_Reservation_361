// In-memory stand-in for the STAFF/ADMIN endpoints (T8–T10). Same shapes and errors as the API.
import { ApiError, getData } from '../services/api'
import type { AdminRoom, RoomInput, RoomPhoto, RoomRulesInput } from '../types/admin'
import type { BookingDetail, BookingStatus, ManageBooking, UserRole, WeeklyStats } from '../types/booking'
import { addDays, bkkMidnight, startOfWeek } from '../utils/bkkDate'
import { blocking, bookingStore, delay, eventsById, findBooking, newEvent, OTHER_STAFF, toDetail } from './bookings'
import { PHOTO_MAX_BYTES, PHOTO_MAX_COUNT, PHOTO_TYPES } from '../utils/roomPhotos'
import { roomStore } from './rooms'
import { getMockUser } from './session'

function requireRole(...roles: UserRole[]) {
  const user = getMockUser()
  if (!roles.includes(user.role)) throw new ApiError(403, 'You do not have permission to do this')
  return user
}

const findRoom = (id: string) => {
  const room = roomStore.find((r) => r.id === id)
  if (!room) throw new ApiError(404, `Room with ID "${id}" not found`)
  return room
}

function assertUniqueName(name: string, exceptId?: string) {
  if (roomStore.some((r) => r.id !== exceptId && r.room_name.toLowerCase() === name.trim().toLowerCase())) {
    throw new ApiError(409, 'A record with this room_name already exists')
  }
}

/** Approve or reject: only from PENDING, like UPDATE ... WHERE status = 'PENDING' */
async function decide(id: string, to: 'APPROVED' | 'REJECTED', reason?: string): Promise<BookingDetail> {
  await delay()
  const user = requireRole('STAFF')
  const b = findBooking(id)
  if (b.handledElsewhere && b.status === 'PENDING') {
    b.status = 'APPROVED'
    eventsById.get(b.id)?.push(newEvent('APPROVED', OTHER_STAFF))
  }
  if (b.status !== 'PENDING') throw new ApiError(409, 'รายการนี้ถูกดำเนินการแล้ว')
  b.status = to
  if (to === 'REJECTED') b.reject_reason = reason ?? null
  eventsById.get(b.id)?.push(newEvent(to, user.display_name, to === 'REJECTED' ? (reason ?? null) : null))
  return toDetail(b, user)
}


/** Photos start as the real ones from GET /api/rooms (read only), loaded once */
let photosLoaded: Promise<void> | null = null
function loadRealPhotos() {
  photosLoaded ??= getData<{ room_name: string; photos: { object_key: string; url: string }[] }[]>('/rooms')
    .then((rooms) => {
      for (const r of rooms) {
        const room = roomStore.find((x) => x.room_name === r.room_name)
        if (room && room.photos.length === 0) {
          room.photos = r.photos.map((p, i) => ({ id: `photo-${r.room_name}-${i}`, url: p.url }))
        }
      }
    })
    .catch(() => {
      photosLoaded = null // API down: no photos this time, try again next load
    })
  return photosLoaded
}

const copyRoom = (r: AdminRoom): AdminRoom => ({ ...r, allowed_roles: [...r.allowed_roles], photos: [...r.photos] })

// Deterministic pseudo-random numbers, so a week always shows the same stats
function seeded(seed: number) {
  let x = seed % 2147483647 || 1
  return () => (x = (x * 16807) % 2147483647) / 2147483647
}

export const mockAdmin = {
  async manageBookings(status: BookingStatus | 'ALL', limit: number): Promise<ManageBooking[]> {
    await delay()
    requireRole('STAFF', 'ADMIN')
    return bookingStore
      .filter((b) => status === 'ALL' || b.status === status)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .slice(0, limit)
      .map((b) => ({
        id: b.id,
        title: b.title,
        status: b.status,
        start_time: b.start_time,
        end_time: b.end_time,
        created_at: b.created_at,
        room_name: b.room.room_name,
        user: { display_name: b.owner.display_name, role: b.owner.role },
      }))
  },

  async pendingCount(): Promise<number> {
    await delay()
    requireRole('STAFF', 'ADMIN')
    return bookingStore.filter((b) => b.status === 'PENDING').length
  },

  approve: (id: string) => decide(id, 'APPROVED'),

  async reject(id: string, reason: string): Promise<BookingDetail> {
    if (reason.trim().length < 5) {
      await delay()
      throw new ApiError(400, 'reason: ต้องมีอย่างน้อย 5 ตัวอักษร')
    }
    return decide(id, 'REJECTED', reason.trim())
  },

  async rooms(): Promise<AdminRoom[]> {
    await delay()
    requireRole('STAFF', 'ADMIN')
    await loadRealPhotos()
    return roomStore.map(copyRoom)
  },

  /** Real API: POST upload-url → PUT the file to S3 → POST photos { object_key } */
  async addPhoto(roomId: string, file: File): Promise<RoomPhoto[]> {
    await delay()
    requireRole('STAFF', 'ADMIN')
    const room = findRoom(roomId)
    if (!PHOTO_TYPES.includes(file.type)) throw new ApiError(400, 'รองรับเฉพาะไฟล์ JPG, PNG หรือ WebP')
    if (file.size > PHOTO_MAX_BYTES) throw new ApiError(400, 'ไฟล์ต้องมีขนาดไม่เกิน 5 MB')
    if (room.photos.length >= PHOTO_MAX_COUNT) throw new ApiError(400, `ห้องหนึ่งมีรูปได้ไม่เกิน ${PHOTO_MAX_COUNT} รูป`)
    // A blob URL stands in for the S3 object until the page reloads
    room.photos.push({ id: `photo-${Date.now()}`, url: URL.createObjectURL(file) })
    return [...room.photos]
  },

  async deletePhoto(roomId: string, photoId: string): Promise<RoomPhoto[]> {
    await delay()
    requireRole('STAFF', 'ADMIN')
    const room = findRoom(roomId)
    room.photos = room.photos.filter((p) => p.id !== photoId)
    return [...room.photos]
  },

  /** `ids`: every photo of the room, in the new order */
  async reorderPhotos(roomId: string, ids: string[]): Promise<RoomPhoto[]> {
    await delay()
    requireRole('STAFF', 'ADMIN')
    const room = findRoom(roomId)
    const byId = new Map(room.photos.map((p) => [p.id, p]))
    if (ids.length !== room.photos.length || ids.some((id) => !byId.has(id))) {
      throw new ApiError(400, 'ลำดับรูปไม่ตรงกับรูปของห้อง กรุณาโหลดใหม่')
    }
    room.photos = ids.map((id) => byId.get(id)!)
    return [...room.photos]
  },

  async createRoom(input: RoomInput): Promise<AdminRoom> {
    await delay()
    requireRole('STAFF', 'ADMIN')
    assertUniqueName(input.room_name)
    const room: AdminRoom = {
      id: `room-${Date.now()}`,
      ...input,
      max_hours: 2,
      allowed_roles: ['STUDENT', 'LECTURER'],
      photos: [],
    }
    roomStore.push(room)
    return copyRoom(room)
  },

  async updateRoom(id: string, input: Partial<RoomInput>): Promise<AdminRoom> {
    await delay()
    requireRole('STAFF', 'ADMIN')
    const room = findRoom(id)
    if (input.room_name) assertUniqueName(input.room_name, id)
    Object.assign(room, input)
    return copyRoom(room)
  },

  async updateRules(id: string, input: RoomRulesInput): Promise<AdminRoom> {
    await delay()
    requireRole('ADMIN')
    const room = findRoom(id)
    room.max_hours = input.max_hours
    room.allowed_roles = [...input.allowed_roles]
    return copyRoom(room)
  },

  async deleteRoom(id: string): Promise<void> {
    await delay()
    requireRole('STAFF', 'ADMIN')
    const room = findRoom(id)
    const future = bookingStore.some(
      (b) => b.room.room_name === room.room_name && blocking(b) && Date.parse(b.end_time) > Date.now(),
    )
    if (future) throw new ApiError(409, 'ห้องนี้ยังมีการจองในอนาคตที่รออนุมัติหรืออนุมัติแล้ว ลบไม่ได้')
    roomStore.splice(roomStore.indexOf(room), 1)
  },

  /** Monday–Sunday week containing `day` (Bangkok), APPROVED bookings only */
  async weeklyStats(day: string): Promise<WeeklyStats> {
    await delay()
    requireRole('ADMIN')
    // startOfWeek gives Sunday; the API's week starts on Monday
    const monday = addDays(startOfWeek(addDays(day, -1)), 1)
    const random = seeded(bkkMidnight(monday) / 86_400_000)
    const rooms = roomStore
      .filter((r) => r.status === 'AVAILABLE')
      .map((r) => {
        const bookings = Math.floor(random() * 14) + (r.room_type === 'LAB' ? 4 : 1)
        const hours = Math.round(bookings * (1 + random() * (r.max_hours - 1)))
        return { room_name: r.room_name, bookings, hours }
      })
      .sort((a, b) => b.hours - a.hours || b.bookings - a.bookings)
    return {
      week_start: monday,
      total_bookings: rooms.reduce((n, r) => n + r.bookings, 0),
      total_hours: rooms.reduce((n, r) => n + r.hours, 0),
      rooms,
      top_room: rooms[0]?.room_name ?? null,
    }
  },
}
