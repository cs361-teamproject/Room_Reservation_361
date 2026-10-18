import axiosInstance from '../config/axios'
import type {
  Booking,
  BookingDetail,
  BookingEvent,
  CreateBookingInput,
  MyBooking,
  MyBookingsScope,
  Page,
  UpdateBookingTimeInput,
} from '../types/booking'
import { getData, send } from './api'

/** Bookings of one room between two Bangkok dates (inclusive). Defaults to PENDING + APPROVED. */
export const getRoomBookings = (roomId: string, from: string, to: string) =>
  getData<Booking[]>('/bookings', { room_id: roomId, from, to })

export const createBooking = (input: CreateBookingInput): Promise<BookingDetail> =>
  send(axiosInstance.post('/bookings', input))

export const getMyBookings = (scope: MyBookingsScope, page = 1, limit = 10): Promise<Page<MyBooking>> =>
  send(axiosInstance.get('/bookings/mine', { params: { scope, page, limit } }))

export const getBooking = (id: string): Promise<BookingDetail> => send(axiosInstance.get(`/bookings/${id}`))

export const getBookingEvents = (id: string): Promise<BookingEvent[]> => send(axiosInstance.get(`/bookings/${id}/events`))

/** Only PENDING bookings; the API checks the room rules and overlaps again */
export const updateBookingTime = (id: string, input: UpdateBookingTimeInput): Promise<unknown> =>
  send(axiosInstance.patch(`/bookings/${id}`, input))

export const cancelBooking = (id: string, reason?: string): Promise<unknown> =>
  send(axiosInstance.post(`/bookings/${id}/cancel`, { reason }))
