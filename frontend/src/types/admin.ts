import type { UserRole } from './booking'

export type RoomType = 'LAB' | 'LECTURE' | 'MEETING' | 'COWORKING'
export type RoomSize = 'SMALL' | 'MEDIUM' | 'LARGE'
export type RoomStatus = 'AVAILABLE' | 'MAINTENANCE'

/** Item of a room's photos, in display order (the first is the cover) */
export interface RoomPhoto {
  id: string
  url: string
}

/** A room as the admin screens edit it (API field names) */
export interface AdminRoom {
  id: string
  room_name: string
  description: string | null
  room_type: RoomType
  size: RoomSize
  /** null: the department did not give one */
  seat_capacity: number | null
  status: RoomStatus
  max_hours: number
  allowed_roles: UserRole[]
  photos: RoomPhoto[]
}

/** Body of POST /api/rooms and PATCH /api/rooms/:id */
export type RoomInput = Pick<AdminRoom, 'room_name' | 'description' | 'room_type' | 'size' | 'seat_capacity' | 'status'>

/** Body of PUT /api/rooms/:id/rules */
export type RoomRulesInput = Pick<AdminRoom, 'max_hours' | 'allowed_roles'>
