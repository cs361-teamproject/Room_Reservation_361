import { isAxiosError } from 'axios'
import axiosInstance from '../config/axios'
import { DEFAULT_ROOM_RULES, MOCK_ROOM_RULES, mockBookings } from '../mocks/bookings'
import type {
  Booking,
  BookingDetail,
  BookingEvent,
  CreateBookingInput,
  MyBooking,
  MyBookingsScope,
  Page,
  RoomRules,
  UpdateBookingTimeInput,
} from '../types/booking'
import { ApiError, getData } from './api'

/** Bookings of one room between two Bangkok dates (inclusive). Defaults to PENDING + APPROVED. */
export const getRoomBookings = (roomId: string, from: string, to: string) =>
  getData<Booking[]>('/bookings', { room_id: roomId, from, to })

// The write endpoints and "my bookings" (T5–T7) are mocked until the frontend is wired to them.
// Set VITE_USE_MOCK_BOOKINGS=false to call the real API; the shapes are the same.
const USE_MOCK = import.meta.env.VITE_USE_MOCK_BOOKINGS !== 'false'

/** Unwraps { success, message, data } and turns HTTP errors into ApiError (status + messages) */
async function send<T>(request: Promise<{ data: { data: T } }>): Promise<T> {
  try {
    return (await request).data.data
  } catch (e) {
    if (isAxiosError(e) && e.response) {
      throw new ApiError(e.response.status, e.response.data?.message ?? e.message)
    }
    throw new ApiError(0, 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่')
  }
}

/** Rules of a room. Until GET /api/rooms/:id returns them (T9), they come from the backend seed values. */
export const getRoomRules = (roomName: string): RoomRules => MOCK_ROOM_RULES[roomName] ?? DEFAULT_ROOM_RULES

export const createBooking = (input: CreateBookingInput): Promise<BookingDetail> =>
  USE_MOCK ? mockBookings.create(input) : send(axiosInstance.post('/bookings', input))

export const getMyBookings = (scope: MyBookingsScope, page = 1, limit = 10): Promise<Page<MyBooking>> =>
  USE_MOCK
    ? mockBookings.listMine(scope, page, limit)
    : send(axiosInstance.get('/bookings/mine', { params: { scope, page, limit } }))

export const getBooking = (id: string): Promise<BookingDetail> =>
  USE_MOCK ? mockBookings.get(id) : send(axiosInstance.get(`/bookings/${id}`))

export const getBookingEvents = (id: string): Promise<BookingEvent[]> =>
  USE_MOCK ? mockBookings.events(id) : send(axiosInstance.get(`/bookings/${id}/events`))

export const updateBookingTime = (id: string, input: UpdateBookingTimeInput): Promise<BookingDetail> =>
  USE_MOCK ? mockBookings.updateTime(id, input) : send(axiosInstance.patch(`/bookings/${id}`, input))

export const cancelBooking = (id: string, reason?: string): Promise<BookingDetail> =>
  USE_MOCK ? mockBookings.cancel(id, reason) : send(axiosInstance.post(`/bookings/${id}/cancel`, { reason }))
