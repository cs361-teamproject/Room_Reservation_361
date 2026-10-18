import { sql } from 'drizzle-orm';
import { getDb } from '../../shared/db/client';

export interface RoomWeekStat {
  roomName: string;
  bookings: number;
  hours: number;
}

/**
 * One SQL statement: APPROVED bookings whose start falls in [weekStart, weekEnd),
 * grouped by room. Hours come from EXTRACT(EPOCH) so fractional bookings count.
 * Week boundaries are computed in JS (Bangkok) and passed as parameters.
 */
export async function weeklyRoomStats(weekStart: Date, weekEnd: Date): Promise<RoomWeekStat[]> {
  const rows = await getDb().execute(sql`
    SELECT r."room_name" AS "roomName",
           COUNT(*)::int AS "bookings",
           ROUND(SUM(EXTRACT(EPOCH FROM (b."end_time" - b."start_time"))) / 3600, 2)::float AS "hours"
      FROM "Booking" b
      JOIN "Room" r ON r."id" = b."room_id"
     WHERE b."status" = 'APPROVED'
       AND b."start_time" >= ${weekStart}
       AND b."start_time" < ${weekEnd}
     GROUP BY r."id", r."room_name"
     ORDER BY "hours" DESC, "bookings" DESC
  `);
  return rows as unknown as RoomWeekStat[];
}
