import { and, asc, eq, exists, gt, gte, ilike, inArray, isNull, lt, notExists } from 'drizzle-orm';
import { type Db, getDb, type Tx } from '../../shared/db/client';
import { bookings, facilities, roomFacilities, roomPhotos, rooms } from '../../shared/db/schema';

export interface RoomFilters {
  q?: string;
  roomTypes?: Array<'LAB' | 'LECTURE' | 'MEETING' | 'COWORKING'>;
  /** DB-side facility names (Thai), each must have quantity >= 1 */
  facilityNames?: string[];
  start?: Date;
  end?: Date;
}

async function findAllWithDetails(filters: RoomFilters = {}) {
  const { q, roomTypes, facilityNames, start, end } = filters;
  const db = getDb();

  // --- Step 1: collect matching room IDs via scalar SELECT ---
  // db.query (Relational API) does not support correlated subqueries in `where`,
  // so we resolve the filter conditions separately and pass the resulting IDs in.
  const hasSubqueryFilter =
    (facilityNames && facilityNames.length > 0) || (start !== undefined && end !== undefined);

  let allowedIds: string[] | null = null;

  if (hasSubqueryFilter) {
    // Build WHERE conditions for the ID-only query
    const idConditions = [isNull(rooms.deletedAt)];

    if (q) idConditions.push(ilike(rooms.roomName, `%${q}%`));
    if (roomTypes && roomTypes.length > 0) idConditions.push(inArray(rooms.roomType, roomTypes));

    // Each required facility → correlated EXISTS subquery
    if (facilityNames && facilityNames.length > 0) {
      for (const name of facilityNames) {
        idConditions.push(
          exists(
            db
              .select({ one: roomFacilities.id })
              .from(roomFacilities)
              .innerJoin(facilities, eq(roomFacilities.facilityId, facilities.id))
              .where(
                and(
                  eq(roomFacilities.roomId, rooms.id),
                  isNull(roomFacilities.deletedAt),
                  isNull(facilities.deletedAt),
                  eq(facilities.name, name),
                  gte(roomFacilities.quantity, 1),
                ),
              ),
          ),
        );
      }
    }

    if (start && end) {
      // Only AVAILABLE rooms can be booked
      idConditions.push(eq(rooms.status, 'AVAILABLE'));

      // No overlapping PENDING or APPROVED bookings
      // Overlap: booking.start_time < end AND booking.end_time > start
      idConditions.push(
        notExists(
          db
            .select({ one: bookings.id })
            .from(bookings)
            .where(
              and(
                eq(bookings.roomId, rooms.id),
                inArray(bookings.status, ['PENDING', 'APPROVED']),
                lt(bookings.startTime, end),
                gt(bookings.endTime, start),
              ),
            ),
        ),
      );
    }

    const rows = await db
      .select({ id: rooms.id })
      .from(rooms)
      .where(and(...idConditions));

    allowedIds = rows.map((r) => r.id);

    // No rooms matched — skip the relational query
    if (allowedIds.length === 0) return [];
  }

  // --- Step 2: relational query with eager-loaded relations ---
  // Simple scalar conditions can go directly into where; subquery results come as inArray
  const relConditions = [isNull(rooms.deletedAt)];

  if (!hasSubqueryFilter) {
    if (q) relConditions.push(ilike(rooms.roomName, `%${q}%`));
    if (roomTypes && roomTypes.length > 0) relConditions.push(inArray(rooms.roomType, roomTypes));
  } else if (allowedIds !== null) {
    relConditions.push(inArray(rooms.id, allowedIds));
  }

  return db.query.rooms.findMany({
    where: and(...relConditions),
    orderBy: asc(rooms.roomName),
    with: {
      roomFacilities: {
        where: isNull(roomFacilities.deletedAt),
        columns: { quantity: true },
        with: { facility: { columns: { name: true } } },
      },
      photos: {
        orderBy: asc(roomPhotos.sortOrder),
        columns: { id: true, objectKey: true },
      },
    },
  });
}

async function findByIdWithDetails(id: string) {
  const row = await getDb().query.rooms.findFirst({
    where: and(eq(rooms.id, id), isNull(rooms.deletedAt)),
    with: {
      roomFacilities: {
        where: isNull(roomFacilities.deletedAt),
        orderBy: asc(roomFacilities.sortOrder),
        columns: { quantity: true, brokenQuantity: true, note: true },
        with: { facility: { columns: { name: true } } },
      },
      photos: {
        orderBy: asc(roomPhotos.sortOrder),
        columns: { id: true, objectKey: true },
      },
    },
  });
  return row ?? null;
}

export type RoomWithDetails = Awaited<ReturnType<typeof findAllWithDetails>>[number];
export type RoomDetail = NonNullable<Awaited<ReturnType<typeof findByIdWithDetails>>>;

export type NewRoom = typeof rooms.$inferInsert;

/** Insert only; name conflicts surface as 23505 -> 409 via fromDbError. */
async function insertRoom(values: NewRoom) {
  const [row] = await getDb().insert(rooms).values(values).returning();
  return row;
}

async function updateRoom(id: string, values: Partial<NewRoom>) {
  const [row] = await getDb().update(rooms).set(values).where(eq(rooms.id, id)).returning();
  return row;
}

async function softDeleteRoom(id: string) {
  const [row] = await getDb().update(rooms).set({ deletedAt: new Date() }).where(eq(rooms.id, id)).returning();
  return row;
}

/** A live room (not deleted) by id, for the 404-before-write checks in the service. */
async function findLiveRoom(id: string) {
  const [row] = await getDb()
    .select({ id: rooms.id })
    .from(rooms)
    .where(and(eq(rooms.id, id), isNull(rooms.deletedAt)))
    .limit(1);
  return row;
}

/** True when a future PENDING/APPROVED booking still holds this room. Blocks soft delete. */
async function hasFutureActiveBookings(roomId: string, now: Date) {
  const [row] = await getDb()
    .select({ one: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.roomId, roomId),
        inArray(bookings.status, ['PENDING', 'APPROVED']),
        gt(bookings.endTime, now),
      ),
    )
    .limit(1);
  return row !== undefined;
}

/** A room's photos in display order (the first is the cover) */
async function listPhotos(roomId: string, db: Db | Tx = getDb()) {
  return db
    .select({ id: roomPhotos.id, objectKey: roomPhotos.objectKey, sortOrder: roomPhotos.sortOrder })
    .from(roomPhotos)
    .where(eq(roomPhotos.roomId, roomId))
    .orderBy(asc(roomPhotos.sortOrder), asc(roomPhotos.createdAt));
}

async function insertPhoto(values: typeof roomPhotos.$inferInsert) {
  await getDb().insert(roomPhotos).values(values);
}

/** Deletes one photo of this room; undefined when the id is not one of its photos */
async function deletePhoto(roomId: string, photoId: string) {
  const [row] = await getDb()
    .delete(roomPhotos)
    .where(and(eq(roomPhotos.id, photoId), eq(roomPhotos.roomId, roomId)))
    .returning({ objectKey: roomPhotos.objectKey });
  return row;
}

/** `ids` in their new order; one transaction so readers never see a half-sorted list */
async function reorderPhotos(roomId: string, ids: string[]) {
  await getDb().transaction(async (tx) => {
    for (const [i, id] of ids.entries()) {
      await tx
        .update(roomPhotos)
        .set({ sortOrder: i + 1 })
        .where(and(eq(roomPhotos.id, id), eq(roomPhotos.roomId, roomId)));
    }
  });
}

export const roomsRepository = {
  listPhotos,
  insertPhoto,
  deletePhoto,
  reorderPhotos,
  findAllWithDetails,
  findByIdWithDetails,
  insertRoom,
  updateRoom,
  softDeleteRoom,
  findLiveRoom,
  hasFutureActiveBookings,
};
