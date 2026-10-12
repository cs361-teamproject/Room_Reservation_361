import type { RoomSize, RoomType } from '../types/admin'

// Same names as the room type filter on the rooms page (data/rooms.ts)
export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  LAB: 'ห้องแลป',
  LECTURE: 'ห้องเล็คเชอร์',
  MEETING: 'ห้องประชุม',
  COWORKING: 'ห้อง Co-working',
}

export const SIZE_LABELS: Record<RoomSize, string> = { SMALL: 'เล็ก', MEDIUM: 'กลาง', LARGE: 'ใหญ่' }
