import { getData } from './api'
import type { Room } from '../types/room'
import type { RoomRules, UserRole } from '../types/booking'
import { bkkIso, type TimeSlot } from '../utils/bkkDate'

// Item of GET /api/rooms and GET /api/rooms/:id
interface ApiRoom {
  id: string
  room_name: string
  description: string | null
  room_type: 'LAB' | 'LECTURE' | 'MEETING' | 'COWORKING'
  size: 'SMALL' | 'MEDIUM' | 'LARGE'
  status: 'AVAILABLE' | 'MAINTENANCE' | 'RESERVED'
  seat_capacity: number
  computers: number
  projector: number
  mic: number
  photos: { object_key: string; url: string }[]
  max_hours: number
  allowed_roles: UserRole[]
}

// Filter labels shown in the UI (data/rooms.ts) → API values
const ROOM_TYPE_CODES: Record<string, ApiRoom['room_type']> = {
  'ห้องแลป': 'LAB',
  'ห้องเล็คเชอร์': 'LECTURE',
  'ห้องประชุม': 'MEETING',
  'ห้อง Co-working': 'COWORKING',
}
const ROOM_TYPE_LABELS = Object.fromEntries(Object.entries(ROOM_TYPE_CODES).map(([label, code]) => [code, label]))

const FACILITY_KEYS: Record<string, string> = {
  'คอมพิวเตอร์': 'computers',
  'โปรเจกเตอร์': 'projector',
  'ไมโครโฟน': 'mic',
}

const SIZES: Record<ApiRoom['size'], Room['size']> = { SMALL: 'Small', MEDIUM: 'Medium', LARGE: 'Large' }

function toRoom(r: ApiRoom): Room {
  const images = r.photos.map((p) => p.url)
  return {
    id: r.id,
    name: r.room_name,
    desc: r.description ?? '',
    type: ROOM_TYPE_LABELS[r.room_type] ?? r.room_type,
    size: SIZES[r.size],
    status: r.status,
    seats: r.seat_capacity,
    computers: r.computers,
    projector: r.projector,
    mic: r.mic,
    image: images[0],
    images,
    maxHours: r.max_hours,
    allowedRoles: r.allowed_roles,
  }
}

export interface RoomSearch {
  query: string
  /** Room type label from ROOM_TYPES, '' for all */
  type: string
  /** Equipment label from EQUIPMENT_OPTIONS, '' for all */
  equipment: string
  /** When set, only rooms that are free for the whole slot */
  slot: TimeSlot | null
}

export async function searchRooms({ query, type, equipment, slot }: RoomSearch): Promise<Room[]> {
  const params: Record<string, string> = {}
  const q = query.trim()
  if (q) params.q = q
  if (type && ROOM_TYPE_CODES[type]) params.room_type = ROOM_TYPE_CODES[type]
  if (equipment && FACILITY_KEYS[equipment]) params.facilities = FACILITY_KEYS[equipment]
  if (slot) {
    params.start = bkkIso(slot.date, slot.startMin)
    params.end = bkkIso(slot.date, slot.endMin)
  }
  const rooms = await getData<ApiRoom[]>('/rooms', params)
  return rooms.map(toRoom)
}

export const getRoom = async (id: string): Promise<Room> => toRoom(await getData<ApiRoom>(`/rooms/${id}`))

export const rulesOf = (room: Room): RoomRules => ({ max_hours: room.maxHours, allowed_roles: room.allowedRoles })

/** Rules of a room by name, for screens that only know the name (a booking in /my-bookings) */
export async function getRoomRulesByName(name: string): Promise<RoomRules> {
  const room = (await getData<ApiRoom[]>('/rooms')).find((r) => r.room_name === name)
  if (!room) throw new Error(`ไม่พบห้อง ${name}`)
  return { max_hours: room.max_hours, allowed_roles: room.allowed_roles }
}
