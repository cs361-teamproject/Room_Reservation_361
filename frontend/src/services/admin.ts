import axiosInstance from '../config/axios'
import type { AdminRoom, RoomInput, RoomPhoto, RoomRulesInput } from '../types/admin'
import type { BookingStatus, ManageBooking, UserRole, WeeklyStats } from '../types/booking'
import { ApiError, send } from './api'

// STAFF/ADMIN endpoints (T8–T10, T9.1)

const ALL_STATUSES: BookingStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']

/** Latest requests first; the API defaults to PENDING, so "ALL" lists every status */
export const getManageBookings = (status: BookingStatus | 'ALL', limit = 10): Promise<ManageBooking[]> =>
  send(
    axiosInstance.get('/bookings/manage', {
      params: { status: (status === 'ALL' ? ALL_STATUSES : [status]).join(','), limit },
    }),
  )

export const getPendingCount = async (): Promise<number> => (await getManageBookings('PENDING', 50)).length

/** Both answer only the decision fields; the screens reload the list afterwards */
export const approveBooking = (id: string): Promise<unknown> => send(axiosInstance.post(`/bookings/${id}/approve`))

export const rejectBooking = (id: string, reason: string): Promise<unknown> =>
  send(axiosInstance.post(`/bookings/${id}/reject`, { reason }))

/** Item of GET /api/rooms and the answer of the room write endpoints */
interface ApiRoom extends Omit<AdminRoom, 'photos' | 'max_hours' | 'allowed_roles' | 'status'> {
  status: AdminRoom['status'] | 'RESERVED'
  max_hours: number
  allowed_roles: UserRole[]
  photos: { id: string; url: string }[]
}

const toAdminRoom = (r: ApiRoom): AdminRoom => ({
  id: r.id,
  room_name: r.room_name,
  description: r.description,
  room_type: r.room_type,
  size: r.size,
  seat_capacity: r.seat_capacity,
  // RESERVED is an unused legacy value: treat it as open
  status: r.status === 'MAINTENANCE' ? 'MAINTENANCE' : 'AVAILABLE',
  max_hours: r.max_hours,
  allowed_roles: r.allowed_roles,
  photos: r.photos.map((p) => ({ id: p.id, url: p.url })),
})

export const getAdminRooms = async (): Promise<AdminRoom[]> =>
  (await send<ApiRoom[]>(axiosInstance.get('/rooms'))).map(toAdminRoom)

export const createRoom = async (input: RoomInput): Promise<AdminRoom> =>
  toAdminRoom(await send(axiosInstance.post('/rooms', input)))

export const updateRoom = async (id: string, input: Partial<RoomInput>): Promise<AdminRoom> =>
  toAdminRoom(await send(axiosInstance.patch(`/rooms/${id}`, input)))

export const updateRoomRules = async (id: string, input: RoomRulesInput): Promise<AdminRoom> =>
  toAdminRoom(await send(axiosInstance.put(`/rooms/${id}/rules`, input)))

export const deleteRoom = async (id: string): Promise<void> => {
  await send(axiosInstance.delete(`/rooms/${id}`))
}

/** `week` is any Bangkok date in the week; the API answers for Monday–Sunday */
export const getWeeklyStats = (week: string): Promise<WeeklyStats> =>
  send(axiosInstance.get('/stats/weekly', { params: { week } }))

// Room photos (T9.1). The file goes straight to S3 with a presigned POST: API Gateway caps bodies
// at 10 MB, and S3 itself enforces the type and the 5 MB limit written into the signed policy.
export async function uploadRoomPhoto(roomId: string, file: File): Promise<RoomPhoto[]> {
  const upload = await send<{ upload_url: string; fields: Record<string, string>; object_key: string }>(
    axiosInstance.post(`/rooms/${roomId}/photos/upload-url`, { content_type: file.type, size: file.size }),
  )
  const form = new FormData()
  for (const [key, value] of Object.entries(upload.fields)) form.append(key, value)
  form.append('file', file) // must come after the policy fields
  const s3 = await fetch(upload.upload_url, { method: 'POST', body: form }).catch(() => null)
  if (!s3?.ok) throw new ApiError(s3?.status ?? 0, 'อัปโหลดรูปไป S3 ไม่สำเร็จ กรุณาลองใหม่')
  return send(axiosInstance.post(`/rooms/${roomId}/photos`, { object_key: upload.object_key }))
}

export const deleteRoomPhoto = (roomId: string, photoId: string): Promise<RoomPhoto[]> =>
  send(axiosInstance.delete(`/rooms/${roomId}/photos/${photoId}`))

export const reorderRoomPhotos = (roomId: string, ids: string[]): Promise<RoomPhoto[]> =>
  send(axiosInstance.patch(`/rooms/${roomId}/photos/order`, { ids }))
