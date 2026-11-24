import { getDb } from '../../shared/db/client';
import { markNoShows } from '../bookings/bookings.repository';
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
  // mondayUtcMs is the Monday at 00:00 UTC, so its date part is the Bangkok calendar date
  return { mondayBkk, label: new Date(mondayUtcMs).toISOString().slice(0, 10) };
}

const toItem = (row: RoomWeekStat) => ({
  room_name: row.roomName,
  bookings: row.bookings,
  hours: row.hours,
  checked_in: row.checkedIn,
  no_shows: row.noShows,
});

export const statsService = {
  async weekly(query: WeeklyQuery) {
    // Admin-only and rare, so it always sweeps: overdue no-shows are counted as no-shows
    await markNoShows(getDb());
    const { mondayBkk, label } = mondayOfWeek(query.week);
    const rows = await weeklyRoomStats(mondayBkk, new Date(mondayBkk.getTime() + 7 * DAY_MS));
    const items = rows.map(toItem);
    return {
      week_start: label,
      total_bookings: items.reduce((n, r) => n + r.bookings, 0),
      // Sum of rounded floats: round again so 0.1 + 0.2 never shows as 0.30000000000000004
      total_hours: Math.round(items.reduce((n, r) => n + r.hours, 0) * 100) / 100,
      total_no_shows: items.reduce((n, r) => n + r.no_shows, 0),
      rooms: items,
      top_room: items[0]?.room_name ?? null,
    };
  },
};
