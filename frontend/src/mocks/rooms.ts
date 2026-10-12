// Rooms and their booking rules for the admin screens (T9/T13), same values as the backend seed.
// The booking form reads its rules from here too, so a rule changed in /admin/rooms applies at once.
import type { AdminRoom } from '../types/admin'
import type { RoomRules } from '../types/booking'

const room = (
  room_name: string,
  room_type: AdminRoom['room_type'],
  size: AdminRoom['size'],
  seat_capacity: number,
  description: string,
  max_hours: number,
  allowed_roles: AdminRoom['allowed_roles'],
  status: AdminRoom['status'] = 'AVAILABLE',
): AdminRoom => ({
  id: `room-${room_name}`,
  room_name,
  room_type,
  size,
  seat_capacity,
  description,
  status,
  max_hours,
  allowed_roles,
  photos: [],
})

export const roomStore: AdminRoom[] = [
  room('LC-101', 'LAB', 'LARGE', 39, 'ห้องเรียนสำหรับทำกิจกรรมแล็บในรายวิชา', 3, ['LECTURER']),
  room('LC-102', 'LAB', 'LARGE', 67, 'ห้องเรียนสำหรับทำกิจกรรมแล็บในรายวิชา', 3, ['LECTURER']),
  room('LC-103', 'LECTURE', 'MEDIUM', 39, 'ห้องบรรยายขนาดกลาง', 2, ['STUDENT', 'LECTURER']),
  room('LC-104', 'LECTURE', 'MEDIUM', 40, 'ห้องบรรยายขนาดกลาง', 2, ['STUDENT', 'LECTURER']),
  room('LC-105', 'LECTURE', 'SMALL', 30, 'ห้องบรรยายขนาดเล็ก', 2, ['STUDENT', 'LECTURER'], 'MAINTENANCE'),
  room('LC-106', 'MEETING', 'SMALL', 12, 'ห้องประชุมกลุ่มย่อย', 2, ['STUDENT', 'LECTURER']),
  room('Co-working Space', 'COWORKING', 'LARGE', 50, 'พื้นที่ทำงานร่วมกัน เหมาะสำหรับนั่งทำงานและอ่านหนังสือ', 4, ['STUDENT', 'LECTURER']),
]

export const DEFAULT_ROOM_RULES: RoomRules = { max_hours: 2, allowed_roles: ['STUDENT', 'LECTURER'] }

/** Rules of a room by name (the public room pages come from the real API, so ids differ) */
export function mockRoomRules(roomName: string): RoomRules {
  const r = roomStore.find((x) => x.room_name === roomName)
  return r ? { max_hours: r.max_hours, allowed_roles: [...r.allowed_roles] } : DEFAULT_ROOM_RULES
}
