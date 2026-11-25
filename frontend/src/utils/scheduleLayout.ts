import type { Booking, DayBlock } from '../types/booking'
import { bkkMidnight, minutesInDay } from './bkkDate'

/** Only PENDING and APPROVED block the room (same rule as the backend availability check) */
export const BLOCKING = new Set(['PENDING', 'APPROVED'])

/** Bookings that touch `day`, clipped to it, with side-by-side lanes for overlaps */
export function blocksForDay(bookings: Booking[], day: string): DayBlock[] {
  const dayStart = bkkMidnight(day)
  const dayEnd = dayStart + 86_400_000
  const blocks = bookings
    .filter((b) => BLOCKING.has(b.status))
    .filter((b) => Date.parse(b.start_time) < dayEnd && Date.parse(b.end_time) > dayStart)
    .map((b) => ({
      booking: b,
      startMin: Math.max(0, minutesInDay(Date.parse(b.start_time), day)),
      endMin: Math.min(24 * 60, minutesInDay(Date.parse(b.end_time), day)),
      lane: 0,
      lanes: 1,
    }))
    .sort((a, b) => a.startMin - b.startMin)

  // Bookings of different rooms (staff calendar) overlap all the time; one room's never should
  const laneEnds: number[] = []
  for (const block of blocks) {
    let lane = laneEnds.findIndex((end) => end <= block.startMin)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = block.endMin
    block.lane = lane
  }
  for (const block of blocks) block.lanes = Math.max(1, laneEnds.length)
  return blocks
}
