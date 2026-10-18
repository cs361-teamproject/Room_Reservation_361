import type { UserRole } from './booking'

export interface Room {
  id: string
  name: string
  desc: string
  type: string
  size: 'Small' | 'Medium' | 'Large'
  status: string
  seats?: number       // ที่นั่งทั่วไป (เก้าอี้)
  computers?: number   // เครื่องคอมพิวเตอร์ (แยกจาก seat)
  projector?: number
  mic?: number
  image?: string
  images?: string[]
  /** Booking rules (GET /api/rooms and /api/rooms/:id) */
  maxHours: number
  allowedRoles: UserRole[]
}
