import { and, asc, eq, gt, inArray, isNull, lt } from 'drizzle-orm';
import { type Db, getDb, type Tx } from '../../shared/db/client';
import { bookingEvents, bookings, rooms } from '../../shared/db/schema';

export interface BookingFilters {
  /** Start of range (inclusive boundary): bookings with end_time > fromEdge */
  fromEdge: Date;
  /** End of range (exclusive boundary): bookings with start_time < toEdge */
  toEdge: Date;
  statuses: Array<'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'>;
  roomId?: string;
}

export async function findBookingsInRange(filters: BookingFilters) {
  const { fromEdge, toEdge, statuses, roomId } = filters;

  const conditions = [
    // Overlap condition: booking overlaps [fromEdge, toEdge) when:
    //   booking.start_time < toEdge  AND  booking.end_time > fromEdge
    lt(bookings.startTime, toEdge),
    gt(bookings.endTime, fromEdge),
    inArray(bookings.status, statuses),
  ];

  if (roomId) {
    conditions.push(eq(bookings.roomId, roomId));
  }

  const rows = await getDb()
    .select({
      id: bookings.id,
      title: bookings.title,
      bookingType: bookings.bookingType,
      status: bookings.status,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      roomId: rooms.id,
      roomName: rooms.roomName,
    })
    .from(bookings)
    .innerJoin(rooms, eq(bookings.roomId, rooms.id))
    .where(and(...conditions))
    .orderBy(asc(bookings.startTime), asc(rooms.roomName));

  return rows;
}

export type BookingRow = Awaited<ReturnType<typeof findBookingsInRange>>[number];

/** The room fields POST /bookings checks its rules against; undefined for a missing or deleted room. */
export async function findRoomForBooking(tx: Db | Tx, roomId: string) {
  const [room] = await tx
    .select({
      id: rooms.id,
      roomName: rooms.roomName,
      status: rooms.status,
      maxHours: rooms.maxHours,
      allowedRoles: rooms.allowedRoles,
    })
    .from(rooms)
    .where(and(eq(rooms.id, roomId), isNull(rooms.deletedAt)))
    .limit(1);
  return room;
}

export type RoomForBooking = NonNullable<Awaited<ReturnType<typeof findRoomForBooking>>>;

/** Fails with SQLSTATE 23P01 (booking_no_overlap) when the slot is taken; the caller's transaction then rolls back. */
export async function insertBooking(tx: Db | Tx, values: typeof bookings.$inferInsert) {
  const [booking] = await tx.insert(bookings).values(values).returning();
  return booking;
}

export type BookingEventAction = (typeof bookingEvents.$inferInsert)['action'];

/**
 * Appends one row to a booking's timeline. Pass the transaction that changes the booking,
 * so the change and its event are committed (or rolled back) together.
 */
export async function recordEvent(
  tx: Db | Tx,
  event: { bookingId: string; actorId: string | null; action: BookingEventAction; note?: string | null },
) {
  await tx.insert(bookingEvents).values({ ...event, note: event.note ?? null });
}
