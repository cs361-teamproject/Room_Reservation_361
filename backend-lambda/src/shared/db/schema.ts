// Baseline pulled with `drizzle-kit pull` from the DB built by backend/prisma migrations,
// so table/column/index names match the existing database exactly.
// From here on Drizzle owns the schema: edit this file, then `npm run db:generate`.
import { randomUUID } from 'node:crypto';
import { check, foreignKey, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const USER_ROLES = ['STUDENT', 'LECTURER', 'STAFF', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];
export const userRole = pgEnum('UserRole', ['STUDENT', 'ADMIN', 'LECTURER', 'STAFF']);
// Whether the room can be booked at all (AVAILABLE = open, MAINTENANCE = closed).
// Free/busy for a time slot comes from Booking, not from this column.
// RESERVED is unused: kept only because Postgres cannot drop an enum value easily.
export const roomStatus = pgEnum('RoomStatus', ['AVAILABLE', 'MAINTENANCE', 'RESERVED']);
export const roomSize = pgEnum('RoomSize', ['SMALL', 'MEDIUM', 'LARGE']);
export const roomType = pgEnum('RoomType', ['LAB', 'LECTURE', 'MEETING', 'COWORKING']);
export const bookingType = pgEnum('BookingType', ['CLASS', 'SCHEDULE', 'SPECIAL_EVENT', 'STUDENT_BOOKING']);
export const bookingStatus = pgEnum('BookingStatus', ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']);
export const bookingEventAction = pgEnum('BookingEventAction', ['CREATED', 'UPDATED', 'APPROVED', 'REJECTED', 'CANCELLED']);

const id = () => text('id').primaryKey().$defaultFn(() => randomUUID());
const ts = (name: string) => timestamp(name, { precision: 3, mode: 'date', withTimezone: true });
const createdAt = () => ts('created_at').default(sql`CURRENT_TIMESTAMP`).notNull();
// No DB default (same as Prisma @updatedAt); Drizzle fills it on insert and update.
const updatedAt = () =>
  ts('updated_at')
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date());

export const examples = pgTable(
  'Example',
  {
    id: id(),
    author: text('author').notNull(),
    comment: text('comment').default('Hello world!').notNull(),
  },
  (t) => [uniqueIndex('Example_author_key').using('btree', t.author.asc().nullsLast().op('text_ops'))],
);

export const users = pgTable(
  'User',
  {
    id: id(),
    // Student/staff ID; the same value is the Cognito username (`cognito:username` claim)
    username: text('username').notNull(),
    // Unused since login moved to Cognito; kept nullable for rows created before V3
    passwordHash: text('password_hash'),
    role: userRole('role').default('STUDENT').notNull(),
    email: text('email'),
    displayName: text('display_name'),
    // Filled on first login, links the row to its Cognito user
    cognitoSub: text('cognito_sub'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [
    uniqueIndex('User_username_key').using('btree', t.username.asc().nullsLast().op('text_ops')),
    uniqueIndex('User_cognito_sub_key').on(t.cognitoSub),
  ],
);

export const rooms = pgTable(
  'Room',
  {
    id: id(),
    roomName: text('room_name').notNull(),
    description: text('description'),
    // Null when the capacity is not known (classrooms, meeting rooms): never guess one
    seatCapacity: integer('seat_capacity'),
    status: roomStatus('status').notNull(),
    size: roomSize('size').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts('deleted_at'),
    roomType: roomType('room_type').default('LECTURE').notNull(),
    // Booking rules, editable per room by ADMIN
    maxHours: integer('max_hours').default(2).notNull(),
    // text[] rather than UserRole[]: a migration cannot use enum values added in the same transaction
    allowedRoles: text('allowed_roles')
      .array()
      .$type<UserRole[]>()
      .default(sql`ARRAY['STUDENT', 'LECTURER']::text[]`)
      .notNull(),
  },
  (t) => [
    uniqueIndex('Room_room_name_key').using('btree', t.roomName.asc().nullsLast().op('text_ops')),
    check('Room_max_hours_check', sql`${t.maxHours} BETWEEN 1 AND 12`),
    check(
      'Room_allowed_roles_check',
      sql`cardinality(${t.allowedRoles}) >= 1 AND ${t.allowedRoles} <@ ARRAY['STUDENT', 'LECTURER', 'STAFF', 'ADMIN']::text[]`,
    ),
  ],
);

export const facilities = pgTable(
  'Facilities',
  {
    id: id(),
    name: text('name').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [uniqueIndex('Facilities_name_key').using('btree', t.name.asc().nullsLast().op('text_ops'))],
);

export const roomFacilities = pgTable(
  'RoomFacilities',
  {
    id: id(),
    roomId: text('room_id').notNull(),
    facilityId: text('facility_id').notNull(),
    quantity: integer('quantity').default(1).notNull(),
    brokenQuantity: integer('broken_quantity').default(0).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    note: text('note'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [
    uniqueIndex('RoomFacilities_room_id_facility_id_key').using(
      'btree',
      t.roomId.asc().nullsLast().op('text_ops'),
      t.facilityId.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({ columns: [t.roomId], foreignColumns: [rooms.id], name: 'RoomFacilities_room_id_fkey' })
      .onUpdate('cascade')
      .onDelete('cascade'),
    foreignKey({ columns: [t.facilityId], foreignColumns: [facilities.id], name: 'RoomFacilities_facility_id_fkey' })
      .onUpdate('cascade')
      .onDelete('restrict'),
  ],
);

export const roomPhotos = pgTable(
  'RoomPhotos',
  {
    id: id(),
    roomId: text('room_id').notNull(),
    objectKey: text('object_key').notNull(),
    caption: text('caption'),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({ columns: [t.roomId], foreignColumns: [rooms.id], name: 'RoomPhotos_room_id_fkey' })
      .onUpdate('cascade')
      .onDelete('cascade'),
  ],
);

export const bookings = pgTable(
  'Booking',
  {
    id: id(),
    userId: text('user_id').notNull(),
    roomId: text('room_id').notNull(),
    bookingType: bookingType('booking_type').notNull(),
    title: text('title'),
    startTime: ts('start_time').notNull(),
    endTime: ts('end_time').notNull(),
    status: bookingStatus('status').default('PENDING').notNull(),
    remark: text('remark'),
    // How many people will use the room; checked against seat_capacity when that is known
    attendeeCount: integer('attendee_count'),
    purpose: text('purpose'),
    // Staff booking on behalf of someone: user_id is who made the booking, this is who uses the room
    bookedForUserId: text('booked_for_user_id'),
    // Extra needs (wireless mic, hotspot); a request only, not equipment the room is known to have
    equipmentRequest: text('equipment_request'),
    cancelledBy: text('cancelled_by'),
    cancelReason: text('cancel_reason'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    cancelledAt: ts('cancelled_at'),
    // Set by STAFF on approve / reject
    reviewedBy: text('reviewed_by'),
    reviewedAt: ts('reviewed_at'),
    rejectReason: text('reject_reason'),
  },
  // The no-overlap EXCLUDE constraint (booking_no_overlap) is not expressible in Drizzle;
  // it lives in the custom migration 0004_booking-no-overlap.sql.
  (t) => [
    check('Booking_time_valid', sql`${t.endTime} > ${t.startTime}`),
    check('Booking_attendee_count_check', sql`${t.attendeeCount} IS NULL OR ${t.attendeeCount} > 0`),
    foreignKey({ columns: [t.bookedForUserId], foreignColumns: [users.id], name: 'Booking_booked_for_user_id_fkey' })
      .onUpdate('cascade')
      .onDelete('set null'),
    foreignKey({ columns: [t.reviewedBy], foreignColumns: [users.id], name: 'Booking_reviewed_by_fkey' })
      .onUpdate('cascade')
      .onDelete('set null'),
    foreignKey({ columns: [t.userId], foreignColumns: [users.id], name: 'Booking_user_id_fkey' })
      .onUpdate('cascade')
      .onDelete('cascade'),
    foreignKey({ columns: [t.cancelledBy], foreignColumns: [users.id], name: 'Booking_cancelled_by_fkey' })
      .onUpdate('cascade')
      .onDelete('set null'),
    foreignKey({ columns: [t.roomId], foreignColumns: [rooms.id], name: 'Booking_room_id_fkey' })
      .onUpdate('cascade')
      .onDelete('restrict'),
  ],
);

// Timeline of a booking: one row per state change, written in the same transaction as the change
export const bookingEvents = pgTable(
  'BookingEvent',
  {
    id: id(),
    bookingId: text('booking_id').notNull(),
    // Null when the user was deleted, or for changes made by the system
    actorId: text('actor_id'),
    action: bookingEventAction('action').notNull(),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [
    index('BookingEvent_booking_id_created_at_idx').on(t.bookingId, t.createdAt),
    foreignKey({ columns: [t.bookingId], foreignColumns: [bookings.id], name: 'BookingEvent_booking_id_fkey' })
      .onUpdate('cascade')
      .onDelete('cascade'),
    foreignKey({ columns: [t.actorId], foreignColumns: [users.id], name: 'BookingEvent_actor_id_fkey' })
      .onUpdate('cascade')
      .onDelete('set null'),
  ],
);
