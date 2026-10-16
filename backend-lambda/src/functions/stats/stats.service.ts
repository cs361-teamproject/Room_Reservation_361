import { type RoomWeekStat, weeklyRoomStats } from './stats.repository';
import type { WeeklyQuery } from './stats.schema';

const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Monday 00:00 Bangkok of the week containing `day` (YYYY-MM-DD calendar date).
 * Shifts the date into Bangkok wall time first, so a Sunday 23:00 UTC that is
 * already Monday in Bangkok lands in the right week.
 */
function mondayOfWeek(day: string): { mondayBkk: Date; label: string } {
  const bangkokNoon = new Date(`${day}T12:00:00+07:00`).getTime();
  const bkkDay = new Date(bangkokNoon + BKK_OFFSET_MS);
  // getUTCDay: 0=Sun..6=Sat; Monday-based offset: Mon=0..Sun=6
  const mondayOffset = (bkkDay.getUTCDay() + 6) % 7;
  const mondayUtcMs = Date.UTC(bkkDay.getUTCFullYear(), bkkDay.getUTCMonth(), bkkDay.getUTCDate()) - mondayOffset * DAY_MS;
  const mondayBkk = new Date(mondayUtcMs - BKK_OFFSET_MS);
  return { mondayBkk, label: mondayBkk.toISOString().slice(0, 10) };
}

const toItem = (row: RoomWeekStat) => ({
  room_name: row.roomName,
  bookings: row.bookings,
  hours: row.hours,
});

export const statsService = {
  async weekly(query: WeeklyQuery) {
    const { mondayBkk, label } = mondayOfWeek(query.week);
    const rows = await weeklyRoomStats(mondayBkk, new Date(mondayBkk.getTime() + 7 * DAY_MS));
    const items = rows.map(toItem);
    return {
      week_start: label,
      total_bookings: items.reduce((n, r) => n + r.bookings, 0),
      total_hours: items.reduce((n, r) => n + r.hours, 0),
      rooms: items,
      top_room: items[0]?.room_name ?? null,
    };
  },
};
