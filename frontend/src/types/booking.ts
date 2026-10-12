export type BookingStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
export type BookingType = 'CLASS' | 'SCHEDULE' | 'SPECIAL_EVENT' | 'STUDENT_BOOKING'

/** Item of GET /api/bookings. Times are ISO strings in UTC. */
export interface Booking {
  id: string
  title: string | null
  booking_type: BookingType
  status: BookingStatus
  start_time: string
  end_time: string
  room: { id: string; room_name: string }
}

/** A booking clipped to one Bangkok day, in minutes since midnight */
export interface DayBlock {
  booking: Booking
  startMin: number
  endMin: number
  lane: number
  lanes: number
}

export type UserRole = 'STUDENT' | 'LECTURER' | 'STAFF' | 'ADMIN'

/** Booking rules of one room (GET /api/rooms/:id once T9 adds them) */
export interface RoomRules {
  max_hours: number
  allowed_roles: UserRole[]
}

/** Body of POST /api/bookings. Times are ISO strings with offset. */
export interface CreateBookingInput {
  room_id: string
  start_time: string
  end_time: string
  title?: string
}

/** Body of PATCH /api/bookings/:id */
export interface UpdateBookingTimeInput {
  start_time: string
  end_time: string
}

export type MyBookingsScope = 'upcoming' | 'past' | 'all'

/** Item of GET /api/bookings/mine */
export interface MyBooking {
  id: string
  room_name: string
  start_time: string
  end_time: string
  status: BookingStatus
}

export interface Page<T> {
  items: T[]
  page: number
  limit: number
  total: number
}

/** GET /api/bookings/:id (owner view) */
export interface BookingDetail {
  id: string
  title: string | null
  booking_type: BookingType
  status: BookingStatus
  start_time: string
  end_time: string
  room: { id: string; room_name: string }
  reject_reason: string | null
  cancel_reason: string | null
  created_at: string
}

export type BookingEventAction = 'CREATED' | 'UPDATED' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

/** Item of GET /api/bookings/:id/events */
export interface BookingEvent {
  action: BookingEventAction
  by: string | null
  at: string
  note: string | null
}
