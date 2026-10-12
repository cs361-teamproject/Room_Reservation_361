import { isAxiosError } from 'axios'
import axiosInstance from '../config/axios'
import { USE_MOCK_API } from '../config/mock'
import { mockAdmin } from '../mocks/admin'
import type { AdminRoom, RoomInput, RoomPhoto, RoomRulesInput } from '../types/admin'
import type { BookingDetail, BookingStatus, ManageBooking, WeeklyStats } from '../types/booking'
import { ApiError } from './api'

// STAFF/ADMIN endpoints (T8–T10), mocked like services/bookings.ts until the backend is ready
const USE_MOCK = USE_MOCK_API

async function send<T>(request: Promise<{ data: { data: T } }>): Promise<T> {
  try {
    return (await request).data.data
  } catch (e) {
    if (isAxiosError(e) && e.response) throw new ApiError(e.response.status, e.response.data?.message ?? e.message)
    throw new ApiError(0, 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่')
  }
}

export const getManageBookings = (status: BookingStatus | 'ALL', limit = 10): Promise<ManageBooking[]> =>
  USE_MOCK
    ? mockAdmin.manageBookings(status, limit)
    : send(axiosInstance.get('/bookings/manage', { params: { ...(status !== 'ALL' && { status }), limit } }))

export const getPendingCount = (): Promise<number> =>
  USE_MOCK
    ? mockAdmin.pendingCount()
    : getManageBookings('PENDING', 50).then((items) => items.length)

export const approveBooking = (id: string): Promise<BookingDetail> =>
  USE_MOCK ? mockAdmin.approve(id) : send(axiosInstance.post(`/bookings/${id}/approve`))

export const rejectBooking = (id: string, reason: string): Promise<BookingDetail> =>
  USE_MOCK ? mockAdmin.reject(id, reason) : send(axiosInstance.post(`/bookings/${id}/reject`, { reason }))

export const getAdminRooms = (): Promise<AdminRoom[]> =>
  USE_MOCK ? mockAdmin.rooms() : send(axiosInstance.get('/rooms'))

export const createRoom = (input: RoomInput): Promise<AdminRoom> =>
  USE_MOCK ? mockAdmin.createRoom(input) : send(axiosInstance.post('/rooms', input))

export const updateRoom = (id: string, input: Partial<RoomInput>): Promise<AdminRoom> =>
  USE_MOCK ? mockAdmin.updateRoom(id, input) : send(axiosInstance.patch(`/rooms/${id}`, input))

export const updateRoomRules = (id: string, input: RoomRulesInput): Promise<AdminRoom> =>
  USE_MOCK ? mockAdmin.updateRules(id, input) : send(axiosInstance.put(`/rooms/${id}/rules`, input))

export const deleteRoom = (id: string): Promise<void> =>
  USE_MOCK ? mockAdmin.deleteRoom(id) : send(axiosInstance.delete(`/rooms/${id}`))

/** `week` is any Bangkok date in the week; the API answers for Monday–Sunday */
export const getWeeklyStats = (week: string): Promise<WeeklyStats> =>
  USE_MOCK ? mockAdmin.weeklyStats(week) : send(axiosInstance.get('/stats/weekly', { params: { week } }))

// Room photos (T9.1, not in the backend yet). The file goes straight to S3 with a presigned URL,
// because API Gateway caps request bodies at 10 MB and the Lambda never needs to see the bytes.
export async function uploadRoomPhoto(roomId: string, file: File): Promise<RoomPhoto[]> {
  if (USE_MOCK) return mockAdmin.addPhoto(roomId, file)
  const { upload_url, object_key } = await send<{ upload_url: string; object_key: string }>(
    axiosInstance.post(`/rooms/${roomId}/photos/upload-url`, { content_type: file.type, size: file.size }),
  )
  const put = await fetch(upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
  if (!put.ok) throw new ApiError(put.status, 'อัปโหลดรูปไป S3 ไม่สำเร็จ')
  return send(axiosInstance.post(`/rooms/${roomId}/photos`, { object_key }))
}

export const deleteRoomPhoto = (roomId: string, photoId: string): Promise<RoomPhoto[]> =>
  USE_MOCK ? mockAdmin.deletePhoto(roomId, photoId) : send(axiosInstance.delete(`/rooms/${roomId}/photos/${photoId}`))

export const reorderRoomPhotos = (roomId: string, ids: string[]): Promise<RoomPhoto[]> =>
  USE_MOCK ? mockAdmin.reorderPhotos(roomId, ids) : send(axiosInstance.patch(`/rooms/${roomId}/photos/order`, { ids }))
