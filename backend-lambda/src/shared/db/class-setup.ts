// In-class setup for CS361 V3 Project 3 (docs/CS361_V3_Project3_In_Class_Setup_and_Self_Test.docx.pdf).
// Rooms and capacities from the department, three test accounts, and the CS100 baseline.
// Idempotent; class-reset puts the class rooms back to just the baseline. Other data is untouched.
import { and, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import type { Db } from './client';
import { bookings, rooms, users } from './schema';

// Capacity null = not given by the department: the API must not guess one
const CLASS_ROOMS = [
  { roomName: 'บร.2-107', roomType: 'LAB', size: 'LARGE', seatCapacity: 80, description: 'ห้องปฏิบัติการคอมพิวเตอร์ (เรียนประจำ)' },
  { roomName: 'บร.2-213', roomType: 'LAB', size: 'LARGE', seatCapacity: 65, description: 'ห้องปฏิบัติการคอมพิวเตอร์ (จองครั้งเดียว)' },
  { roomName: 'บร.2-111', roomType: 'LAB', size: 'MEDIUM', seatCapacity: 50, description: 'ห้องปฏิบัติการคอมพิวเตอร์ (อบรมพิเศษ)' },
  { roomName: 'บร.2-306', roomType: 'LECTURE', size: 'MEDIUM', seatCapacity: null, description: 'ห้องเรียน (ไม่ระบุความจุ)' },
  { roomName: 'บร.2-308', roomType: 'LECTURE', size: 'MEDIUM', seatCapacity: null, description: 'ห้องเรียน (ไม่ระบุความจุ)' },
  { roomName: 'บร.2-310', roomType: 'LECTURE', size: 'MEDIUM', seatCapacity: null, description: 'ห้องเรียน (ไม่ระบุความจุ)' },
  { roomName: 'ห้องประชุม 1', roomType: 'MEETING', size: 'SMALL', seatCapacity: null, description: 'ห้องประชุม (ไม่ระบุความจุ)' },
  { roomName: 'ห้องประชุม 2', roomType: 'MEETING', size: 'SMALL', seatCapacity: null, description: 'ห้องประชุม (ไม่ระบุความจุ)' },
] as const;

// The existing Cognito demo accounts play the three roles of the handout:
// STU-A = 6709616541, STAFF-1 = staff, FAC-A = lecturer (display names follow the handout)
const CLASS_USERS = [
  { username: '6709616541', role: 'STUDENT', displayName: 'น.ส.ณิชา ศรีสุข' },
  { username: 'staff', role: 'STAFF', displayName: 'คุณวาริชา วงศ์ดี' },
  { username: 'lecturer', role: 'LECTURER', displayName: 'อ.ดร.กิตติพงษ์ นิรันดร์' },
] as const;

const BASELINE_TITLE = 'CS100';

/** Every Monday 09:30–12:30 Bangkok, 2 Nov 2026 – 8 Feb 2027 (15 classes) */
function cs100Sessions() {
  const first = Date.parse('2026-11-02T09:30:00+07:00');
  return Array.from({ length: 15 }, (_, i) => {
    const start = new Date(first + i * 7 * 86_400_000);
    return { startTime: start, endTime: new Date(start.getTime() + 3 * 3_600_000) };
  });
}

async function classRoomIds(db: Db) {
  const rows = await db
    .select({ id: rooms.id, roomName: rooms.roomName })
    .from(rooms)
    .where(inArray(rooms.roomName, CLASS_ROOMS.map((r) => r.roomName)));
  return Object.fromEntries(rows.map((r) => [r.roomName, r.id]));
}

export async function runClassSetup(db: Db) {
  await db
    .insert(rooms)
    .values(
      CLASS_ROOMS.map((r) => ({
        ...r,
        status: 'AVAILABLE' as const,
        maxHours: 3,
        allowedRoles: ['STUDENT', 'LECTURER'] as ('STUDENT' | 'LECTURER')[],
      })),
    )
    .onConflictDoNothing({ target: rooms.roomName });
  // Existing accounts keep their id and role; only the name shown follows the handout
  await db
    .insert(users)
    .values([...CLASS_USERS])
    .onConflictDoUpdate({ target: users.username, set: { displayName: sql`excluded.display_name` } });

  const roomId = await classRoomIds(db);
  const [faculty] = await db.select({ id: users.id }).from(users).where(inArray(users.username, ['lecturer']));

  // Baseline only once: no CS100 row in บร.2-107 yet
  const existing = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(inArray(bookings.roomId, [roomId['บร.2-107']]), inArray(bookings.title, [BASELINE_TITLE])));
  if (existing.length === 0) {
    await db.insert(bookings).values(
      cs100Sessions().map((s) => ({
        ...s,
        userId: faculty.id,
        roomId: roomId['บร.2-107'],
        bookingType: 'CLASS' as const,
        title: BASELINE_TITLE,
        purpose: 'เรียนประจำ CS100',
        attendeeCount: 80,
        status: 'APPROVED' as const,
      })),
    );
  }
  return { rooms: Object.keys(roomId).length, baselineInserted: existing.length === 0 };
}

/** Back to the baseline: drop every other booking in the class rooms (events cascade) */
export async function runClassReset(db: Db) {
  const roomId = await classRoomIds(db);
  const deleted = await db
    .delete(bookings)
    .where(
      and(
        inArray(bookings.roomId, Object.values(roomId)),
        or(ne(bookings.title, BASELINE_TITLE), isNull(bookings.title)),
      ),
    )
    .returning({ id: bookings.id });
  return { deleted: deleted.length, ...(await runClassSetup(db)) };
}
