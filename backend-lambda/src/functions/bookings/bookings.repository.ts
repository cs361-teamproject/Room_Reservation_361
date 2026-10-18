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

/** Find bookings owned by a specific user with pagination */
export async function findMyBookings(params: {
  userId: string;
  scope: 'upcoming' | 'past' | 'all';
  statuses?: Array<'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'>;
  page: number;
  limit: number;
}) {
  const { userId, scope, statuses, page, limit } = params;
  const now = new Date();

  const conditions = [eq(bookings.userId, userId)];

  // Apply scope filter
  if (scope === 'upcoming') {
    // Not finished yet AND status is PENDING or APPROVED
    conditions.push(gt(bookings.endTime, now));
    conditions.push(inArray(bookings.status, ['PENDING', 'APPROVED']));
  } else if (scope === 'past') {
    // End time has passed
    conditions.push(lt(bookings.endTime, now));
  }
  // 'all' means no time filter

  // Apply status filter if provided
  if (statuses && statuses.length > 0) {
    conditions.push(inArray(bookings.status, statuses));
  }

  // Get total count
  const countRows = await getDb()
    .select({ count: bookings.id })
    .from(bookings)
    .where(and(...conditions));

  const total = countRows.length;

  // Get paginated results
  const offset = (page - 1) * limit;
  const rows = await getDb()
    .select({
      id: bookings.id,
      roomName: rooms.roomName,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      status: bookings.status,
    })
    .from(bookings)
    .innerJoin(rooms, eq(bookings.roomId, rooms.id))
    .where(and(...conditions))
    .orderBy(asc(bookings.startTime))
    .limit(limit)
    .offset(offset);

  return { items: rows, total };
}

/** Find a booking by ID with full details. Pass `tx` when calling from inside a transaction (the pool has only 1 connection, so reusing the pool there would deadlock). */
export async function findBookingById(bookingId: string, db: Db | Tx = getDb()) {
  const [booking] = await db
    .select({
      id: bookings.id,
      userId: bookings.userId,
      title: bookings.title,
      bookingType: bookings.bookingType,
      status: bookings.status,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      rejectReason: bookings.rejectReason,
      cancelReason: bookings.cancelReason,
      remark: bookings.remark,
      roomId: rooms.id,
      roomName: rooms.roomName,
    })
    .from(bookings)
    .innerJoin(rooms, eq(bookings.roomId, rooms.id))
    .where(eq(bookings.id, bookingId))
    .limit(1);

  return booking;
}

/** Find timeline events for a booking */
export async function findBookingEvents(bookingId: string) {
  const events = await getDb()
    .select({
      action: bookingEvents.action,
      by: users.displayName,
      at: bookingEvents.createdAt,
      note: bookingEvents.note,
    })
    .from(bookingEvents)
    .leftJoin(users, eq(bookingEvents.actorId, users.id))
    .where(eq(bookingEvents.bookingId, bookingId))
    .orderBy(asc(bookingEvents.createdAt));

  return events;
}

/** 
 * Update booking times. Returns the number of rows affected.
 * Use WHERE conditions to ensure only the owner can update and only when status is PENDING.
 */
export async function updateBookingTimes(
  tx: Db | Tx,
  params: {
    bookingId: string;
    userId: string;
    startTime: Date;
    endTime: Date;
  }
) {
  const result = await tx
    .update(bookings)
    .set({
      startTime: params.startTime,
      endTime: params.endTime,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(bookings.id, params.bookingId),
        eq(bookings.userId, params.userId),
        eq(bookings.status, 'PENDING')
      )
    )
    .returning({ id: bookings.id });

  return result.length;
}

/**
 * Cancel a booking. Returns the number of rows affected.
 * Use WHERE conditions to ensure only the owner can cancel and only when status is PENDING or APPROVED.
 */
export async function cancelBooking(
  tx: Db | Tx,
  params: {
    bookingId: string;
    userId: string;
    cancelledBy: string;
    cancelReason: string | null;
  }
) {
  const result = await tx
    .update(bookings)
    .set({
      status: 'CANCELLED',
      cancelledBy: params.cancelledBy,
      cancelledAt: new Date(),
      cancelReason: params.cancelReason,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(bookings.id, params.bookingId),
        eq(bookings.userId, params.userId),
        inArray(bookings.status, ['PENDING', 'APPROVED'])
      )
    )
    .returning({ id: bookings.id, startTime: bookings.startTime });

  return result;
}
