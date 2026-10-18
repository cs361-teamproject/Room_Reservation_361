import type { AuthUser } from '../../shared/auth';
import { getDb } from '../../shared/db/client';
import type { UserRole } from '../../shared/db/schema';
import { badRequest, conflict, forbidden, notFound } from '../../shared/http/errors';
import {
  approveIfPending,
  type BookingRow,
  cancelBooking,
  findBookingById,
  findBookingEvents,
  findBookingsInRange,
  findManagedBookings,
  findMyBookings,
  findRoomForBooking,
  insertBooking,
  type ManagedBookingRow,
  recordEvent,
  rejectIfPending,
  type RoomForBooking,
  updateBookingTimes,
} from './bookings.repository';
import type {
  CancelBookingBody,
  CreateBookingBody,
  ListQuery,
  ManageQuery,
  MineQuery,
  UpdateBookingBody,
} from './bookings.schema';

// Asia/Bangkok is UTC+7, no DST — offset is always +07:00
const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Converts a YYYY-MM-DD string (Asia/Bangkok) to the UTC Date at 00:00 BKK.
 * e.g. "2026-09-21" → 2026-09-20T17:00:00.000Z
 */
function toStartOfDay(date: string): Date {
  return new Date(`${date}T00:00:00+07:00`);
}

/**
 * Converts a YYYY-MM-DD string (Asia/Bangkok) to the UTC Date at 24:00 BKK
 * (i.e. 00:00 of the next day in BKK = end of the given day).
 * e.g. "2026-09-21" → 2026-09-21T17:00:00.000Z
 */
function toEndOfDay(date: string): Date {
  return new Date(toStartOfDay(date).getTime() + 24 * 60 * 60 * 1000);
}

// STUDENT_BOOKING titles are hidden until auth is implemented —
// without login anyone can read booking titles, which may be sensitive.
const toResponse = (row: BookingRow) => ({
  id: row.id,
  title: row.bookingType === 'STUDENT_BOOKING' ? null : row.title,
  booking_type: row.bookingType,
  status: row.status,
  start_time: row.startTime,
  end_time: row.endTime,
  room: {
    id: row.roomId,
    room_name: row.roomName,
  },
});

const toManagedItem = (row: ManagedBookingRow) => ({
  id: row.id,
  title: row.title,
  status: row.status,
  start_time: row.startTime,
  end_time: row.endTime,
  created_at: row.createdAt,
  room_name: row.roomName,
  user: { display_name: row.displayName, role: row.role },
});

const toDecisionItem = (booking: { id: string; status: string; reviewedBy: string | null; reviewedAt: Date | null; rejectReason: string | null }) => ({
  id: booking.id,
  status: booking.status,
  reviewed_by: booking.reviewedBy,
  reviewed_at: booking.reviewedAt,
  reject_reason: booking.rejectReason,
});

const HOUR_MS = 60 * 60 * 1000;

const ROLE_LABELS: Record<UserRole, string> = {
  STUDENT: 'นักศึกษา',
  LECTURER: 'อาจารย์',
  STAFF: 'เจ้าหน้าที่',
  ADMIN: 'ผู้ดูแลระบบ',
};

// Only STUDENT and LECTURER reach create() (requireRole in app.ts)
const BOOKING_TYPE_BY_ROLE = { STUDENT: 'STUDENT_BOOKING', LECTURER: 'CLASS' } as const;

/** The room's booking rules: every broken one, so the user can fix them all at once. */
function ruleViolations(room: RoomForBooking, start: Date, end: Date, now: Date): string[] {
  const problems: string[] = [];
  if (room.status !== 'AVAILABLE') problems.push('ห้องนี้ปิดปรับปรุง ยังจองไม่ได้');
  if (start.getTime() <= now.getTime()) problems.push('start_time: ต้องเป็นเวลาในอนาคต');
  if (end.getTime() <= start.getTime()) {
    problems.push('end_time: ต้องอยู่หลัง start_time');
  } else if (end.getTime() - start.getTime() > room.maxHours * HOUR_MS) {
    problems.push(`ห้องนี้จองได้ไม่เกิน ${room.maxHours} ชั่วโมงต่อครั้ง`);
  }
  return problems;
}

export const bookingsService = {
  async list(query: ListQuery) {
    const rows = await findBookingsInRange({
      fromEdge: toStartOfDay(query.from),
      toEdge: toEndOfDay(query.to),
      statuses: query.status as Array<'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'>,
      roomId: query.room_id,
    });

    return rows.map(toResponse);
  },

  /**
   * Books a room as PENDING. Checks run in the order the API documents (404, 403, 400);
   * an overlapping slot is left to the booking_no_overlap constraint, which makes the
   * insert fail with 23P01 (answered 409) even when two requests race for the same slot.
   */
  async create(user: AuthUser, body: CreateBookingBody) {
    const start = new Date(body.start_time);
    const end = new Date(body.end_time);

    return getDb().transaction(async (tx) => {
      const room = await findRoomForBooking(tx, body.room_id);
      if (!room) throw notFound('Room not found');

      if (!room.allowedRoles.includes(user.role)) {
        throw forbidden(`ห้องนี้จองได้เฉพาะ${room.allowedRoles.map((r) => ROLE_LABELS[r]).join(' และ ')}`);
      }

      const problems = ruleViolations(room, start, end, new Date());
      if (problems.length > 0) throw badRequest(problems);

      const booking = await insertBooking(tx, {
        userId: user.id,
        roomId: room.id,
        bookingType: BOOKING_TYPE_BY_ROLE[user.role as keyof typeof BOOKING_TYPE_BY_ROLE],
        title: body.title ?? null,
        startTime: start,
        endTime: end,
        status: 'PENDING',
      });
      await recordEvent(tx, { bookingId: booking.id, actorId: user.id, action: 'CREATED' });

      // The caller owns this booking, so the title is shown even for STUDENT_BOOKING
      return {
        id: booking.id,
        title: booking.title,
        booking_type: booking.bookingType,
        status: booking.status,
        start_time: booking.startTime,
        end_time: booking.endTime,
        room: { id: room.id, room_name: room.roomName },
      };
    });
  },

  /** Staff/Admin queue: latest bookings first. Writes are STAFF-only (app.ts). */
  async manage(query: ManageQuery) {
    const rows = await findManagedBookings({
      statuses: query.status as Array<'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'>,
      limit: query.limit,
    });
    return rows.map(toManagedItem);
  },

  /**
   * STAFF approves a PENDING booking. The UPDATE is guarded by status so a
   * double-click or two staff racing leave one winner; the loser gets 409.
   * Unknown ids answer 404 (checked first, outside the guarded update).
   */
  async approve(staff: AuthUser, bookingId: string) {
    return getDb().transaction(async (tx) => {
      const booking = await tx.query.bookings.findFirst({
        where: (b, { eq }) => eq(b.id, bookingId),
        columns: { id: true, status: true },
      });
      if (!booking) throw notFound('Booking not found');

      const approved = await approveIfPending(tx, bookingId, staff.id);
      if (!approved) throw conflict('รายการนี้ถูกดำเนินการแล้ว');
      await recordEvent(tx, { bookingId, actorId: staff.id, action: 'APPROVED' });
      return toDecisionItem(approved);
    });
  },

  /** Same race guard as approve, with the mandatory reject reason stored. */
  async reject(staff: AuthUser, bookingId: string, reason: string) {
    return getDb().transaction(async (tx) => {
      const booking = await tx.query.bookings.findFirst({
        where: (b, { eq }) => eq(b.id, bookingId),
        columns: { id: true, status: true },
      });
      if (!booking) throw notFound('Booking not found');

      const rejected = await rejectIfPending(tx, bookingId, staff.id, reason);
      if (!rejected) throw conflict('รายการนี้ถูกดำเนินการแล้ว');
      await recordEvent(tx, { bookingId, actorId: staff.id, action: 'REJECTED', note: reason });
      return toDecisionItem(rejected);
    });
  },

  /**
   * Get bookings owned by the authenticated user with pagination
   */
  async getMine(user: AuthUser, query: MineQuery) {
    const { items, total } = await findMyBookings({
      userId: user.id,
      scope: query.scope,
      statuses: query.status,
      page: query.page,
      limit: query.limit,
    });

    return {
      items: items.map((item) => ({
        id: item.id,
        room_name: item.roomName,
        start_time: item.startTime,
        end_time: item.endTime,
        status: item.status,
      })),
      page: query.page,
      limit: query.limit,
      total,
    };
  },

  /**
   * Get full details of a booking.
   * Returns 404 if not found or user doesn't have access.
   */
  async getById(user: AuthUser, bookingId: string) {
    const booking = await findBookingById(bookingId);

    if (!booking) {
      throw notFound('Booking not found');
    }

    // Check authorization: must be owner or Staff/Admin
    const isOwner = booking.userId === user.id;
    const isStaffOrAdmin = user.role === 'STAFF' || user.role === 'ADMIN';

    if (!isOwner && !isStaffOrAdmin) {
      // Return 404 instead of 403 to not leak that the booking exists
      throw notFound('Booking not found');
    }

    return {
      id: booking.id,
      title: booking.title,
      booking_type: booking.bookingType,
      status: booking.status,
      start_time: booking.startTime,
      end_time: booking.endTime,
      reject_reason: booking.rejectReason,
      cancel_reason: booking.cancelReason,
      remark: booking.remark,
      created_at: booking.createdAt,
      room: {
        id: booking.roomId,
        room_name: booking.roomName,
      },
      // Staff look at other people's bookings, so they also see who made it
      ...(isStaffOrAdmin && { user: { display_name: booking.userDisplayName, role: booking.userRole } }),
    };
  },

  /**
   * Get timeline events for a booking.
   * Returns 404 if not found or user doesn't have access.
   */
  async getEvents(user: AuthUser, bookingId: string) {
    const booking = await findBookingById(bookingId);

    if (!booking) {
      throw notFound('Booking not found');
    }

    // Check authorization: must be owner or Staff/Admin
    const isOwner = booking.userId === user.id;
    const isStaffOrAdmin = user.role === 'STAFF' || user.role === 'ADMIN';

    if (!isOwner && !isStaffOrAdmin) {
      // Return 404 instead of 403 to not leak that the booking exists
      throw notFound('Booking not found');
    }

    const events = await findBookingEvents(bookingId);

    return events.map((event) => ({
      action: event.action,
      by: event.by || 'System', // Fallback for deleted users or system actions
      at: event.at,
      note: event.note,
    }));
  },

  /**
   * Update booking times (PATCH /:id).
   * Only the owner can update, and only when status is PENDING.
   */
  async update(user: AuthUser, bookingId: string, body: UpdateBookingBody) {
    const start = new Date(body.start_time);
    const end = new Date(body.end_time);

    return getDb().transaction(async (tx) => {
      // First fetch the booking to check access and get room details
      const booking = await findBookingById(bookingId, tx);
      
      if (!booking) {
        throw notFound('Booking not found');
      }

      // Check if the user is the owner
      if (booking.userId !== user.id) {
        throw notFound('Booking not found');
      }

      // Check if status is PENDING
      if (booking.status !== 'PENDING') {
        throw badRequest('สามารถแก้ไขได้เฉพาะการจองที่มีสถานะ PENDING เท่านั้น');
      }

      // Get room details to validate the new time
      const room = await findRoomForBooking(tx, booking.roomId);
      if (!room) {
        throw notFound('Room not found');
      }

      // Validate the new times using the same rules as create
      const problems = ruleViolations(room, start, end, new Date());
      if (problems.length > 0) {
        throw badRequest(problems);
      }

      // Update the booking with WHERE conditions for safety
      const rowsAffected = await updateBookingTimes(tx, {
        bookingId,
        userId: user.id,
        startTime: start,
        endTime: end,
      });

      // If no rows were affected, the booking state changed between our checks
      if (rowsAffected === 0) {
        throw conflict('ไม่สามารถแก้ไขการจองได้ สถานะอาจเปลี่ยนแปลงแล้ว');
      }

      // Record the UPDATED event
      await recordEvent(tx, {
        bookingId,
        actorId: user.id,
        action: 'UPDATED',
      });

      // Return updated booking details
      return {
        id: booking.id,
        title: booking.title,
        booking_type: booking.bookingType,
        status: booking.status,
        start_time: start,
        end_time: end,
        room: {
          id: booking.roomId,
          room_name: booking.roomName,
        },
      };
    });
  },

  /**
   * Cancel a booking (POST /:id/cancel).
   * Only the owner can cancel, and only when status is PENDING or APPROVED
   * and the start time hasn't passed yet.
   */
  async cancel(user: AuthUser, bookingId: string, body: CancelBookingBody) {
    return getDb().transaction(async (tx) => {
      // First fetch the booking to check all conditions
      const booking = await findBookingById(bookingId, tx);
      
      if (!booking) {
        throw notFound('Booking not found');
      }

      // Check if the user is the owner
      if (booking.userId !== user.id) {
        throw notFound('Booking not found');
      }

      // Check if already cancelled
      if (booking.status === 'CANCELLED') {
        throw conflict('การจองนี้ถูกยกเลิกไปแล้ว');
      }

      // Check if status is PENDING or APPROVED
      if (booking.status !== 'PENDING' && booking.status !== 'APPROVED') {
        throw badRequest('สามารถยกเลิกได้เฉพาะการจองที่มีสถานะ PENDING หรือ APPROVED เท่านั้น');
      }

      // Check if start time hasn't passed yet
      const now = new Date();
      if (booking.startTime.getTime() <= now.getTime()) {
        throw badRequest('ไม่สามารถยกเลิกการจองที่เริ่มแล้วหรือกำลังเริ่มได้');
      }

      // Cancel the booking with WHERE conditions for safety
      const result = await cancelBooking(tx, {
        bookingId,
        userId: user.id,
        cancelledBy: user.id,
        cancelReason: body.reason ?? null,
      });

      // If no rows were affected, the booking state changed between our checks
      if (result.length === 0) {
        throw conflict('ไม่สามารถยกเลิกการจองได้ สถานะอาจเปลี่ยนแปลงแล้ว');
      }

      // Record the CANCELLED event
      await recordEvent(tx, {
        bookingId,
        actorId: user.id,
        action: 'CANCELLED',
        note: body.reason ?? null,
      });

      return {
        id: booking.id,
        status: 'CANCELLED',
        cancelled_at: new Date(),
        cancelled_by: user.id,
        cancel_reason: body.reason ?? null,
      };
    });
  },
};
