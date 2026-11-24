import { sql } from 'drizzle-orm';
import { getDb } from '../../shared/db/client';

export interface RoomWeekStat {
  roomName: string;
  bookings: number;
  hours: number;
  checkedIn: number;
  noShows: number;
}

/**
 * One SQL statement: bookings that were approved (APPROVED, or NO_SHOW = approved but nobody came)
 * whose start falls in [weekStart, weekEnd), grouped by room. `bookings` and `hours` count only
 * APPROVED, as before; `checkedIn` and `noShows` show how many were really used.
 * Hours come from EXTRACT(EPOCH) so fractional bookings count.
 * Week boundaries are computed in JS (Bangkok) and passed as parameters.
 */
export async function weeklyRoomStats(weekStart: Date, weekEnd: Date): Promise<RoomWeekStat[]> {
  const rows = await getDb().execute(sql`
    SELECT r."room_name" AS "roomName",
           COUNT(*) FILTER (WHERE b."status" = 'APPROVED')::int AS "bookings",
           COALESCE(ROUND(SUM(EXTRACT(EPOCH FROM (b."end_time" - b."start_time")))
             FILTER (WHERE b."status" = 'APPROVED') / 3600, 2), 0)::float AS "hours",
           COUNT(*) FILTER (WHERE b."checked_in_at" IS NOT NULL)::int AS "checkedIn",
           COUNT(*) FILTER (WHERE b."status" = 'NO_SHOW')::int AS "noShows"
      FROM "Booking" b
      JOIN "Room" r ON r."id" = b."room_id"
     WHERE b."status" IN ('APPROVED', 'NO_SHOW')
       AND b."start_time" >= ${weekStart.toISOString()}
       AND b."start_time" < ${weekEnd.toISOString()}
     GROUP BY r."id", r."room_name"
     ORDER BY "hours" DESC, "bookings" DESC
  `);
  return rows as unknown as RoomWeekStat[];
}
