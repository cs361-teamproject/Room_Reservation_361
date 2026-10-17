import { and, asc, desc, eq, gt, inArray, isNull, lt } from 'drizzle-orm';
import { type Db, getDb, type Tx } from '../../shared/db/client';
import { bookingEvents, bookings, rooms, users } from '../../shared/db/schema';

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
 * Staff manage queue: latest bookings first with booker display name + room.
 * Caller filters by status (default PENDING) and caps rows with limit (max 50).
 */
export async function findManagedBookings(filters: {
  statuses: Array<'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'>;
  limit: number;
}) {
  return getDb()
    .select({
      id: bookings.id,
      title: bookings.title,
      status: bookings.status,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      createdAt: bookings.createdAt,
      displayName: users.displayName,
      role: users.role,
      roomName: rooms.roomName,
    })
    .from(bookings)
    .innerJoin(users, eq(bookings.userId, users.id))
    .innerJoin(rooms, eq(bookings.roomId, rooms.id))
    .where(inArray(bookings.status, filters.statuses))
    .orderBy(desc(bookings.createdAt))
    .limit(filters.limit);
}

export type ManagedBookingRow = Awaited<ReturnType<typeof findManagedBookings>>[number];

/**
 * PENDING -> APPROVED guarded by status so two staff racing on the same row
 * leave exactly one winner (0 updated rows = already handled).
 */
export async function approveIfPending(tx: Db | Tx, bookingId: string, reviewerId: string) {
  const [row] = await tx
    .update(bookings)
    .set({ status: 'APPROVED', reviewedBy: reviewerId, reviewedAt: new Date() })
    .where(and(eq(bookings.id, bookingId), eq(bookings.status, 'PENDING')))
    .returning();
  return row;
}

/** Same guard as approve, plus the mandatory reject reason. */
export async function rejectIfPending(tx: Db | Tx, bookingId: string, reviewerId: string, reason: string) {
  const [row] = await tx
    .update(bookings)
    .set({ status: 'REJECTED', reviewedBy: reviewerId, reviewedAt: new Date(), rejectReason: reason })
    .where(and(eq(bookings.id, bookingId), eq(bookings.status, 'PENDING')))
    .returning();
  return row;
}

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
