// Idempotent sample data: safe to run more than once.
// Callable from the migrate Lambda, the only place that can reach RDS.
import { inArray } from 'drizzle-orm';
import type { Db } from './client';
import { bookingEvents, bookings, facilities, roomFacilities, roomPhotos, rooms, users } from './schema';

export interface SeedResult {
  /** Photos and bookings are only seeded into an empty table, so these say whether this run inserted them. */
  photosInserted: boolean;
  bookingsInserted: boolean;
}

export async function runSeed(db: Db): Promise<SeedResult> {
  await db
    .insert(users)
    .values([
      // Usernames match the demo accounts in the Cognito user pool; passwords live only in Cognito
      { username: '6709616541', role: 'STUDENT', displayName: 'นักศึกษา ทดสอบ 1', email: 'student@dome.tu.ac.th' },
      { username: '6709000002', role: 'STUDENT', displayName: 'นักศึกษา ทดสอบ 2' },
      { username: 'lecturer', role: 'LECTURER', displayName: 'อาจารย์ ทดสอบ', email: 'lecturer@dome.tu.ac.th' },
      { username: 'staff', role: 'STAFF', displayName: 'เจ้าหน้าที่ ทดสอบ', email: 'staff@dome.tu.ac.th' },
      { username: 'admin', role: 'ADMIN', displayName: 'ผู้ดูแลระบบ', email: 'admin@dome.tu.ac.th' },
    ])
    .onConflictDoNothing({ target: users.username });

  const facilityNames = ['คอมพิวเตอร์', 'โปรเจกเตอร์', 'ไมโครโฟน', 'ไวท์บอร์ด', 'เครื่องปรับอากาศ'];
  await db
    .insert(facilities)
    .values(facilityNames.map((name) => ({ name })))
    .onConflictDoNothing({ target: facilities.name });

  await db
    .insert(rooms)
    .values([
      // Booking rules: LAB rooms are for lecturers only
      { roomName: 'LC-101', description: 'ห้องเรียนสำหรับทำกิจกรรมแล็บในรายวิชา', seatCapacity: 39, status: 'AVAILABLE', size: 'LARGE', roomType: 'LAB', maxHours: 3, allowedRoles: ['LECTURER'] },
      { roomName: 'LC-102', description: 'ห้องเรียนสำหรับทำกิจกรรมแล็บในรายวิชา', seatCapacity: 67, status: 'AVAILABLE', size: 'LARGE', roomType: 'LAB', maxHours: 3, allowedRoles: ['LECTURER'] },
      { roomName: 'LC-103', description: 'ห้องบรรยายขนาดกลาง', seatCapacity: 39, status: 'AVAILABLE', size: 'MEDIUM', roomType: 'LECTURE', maxHours: 2, allowedRoles: ['STUDENT', 'LECTURER'] },
      { roomName: 'LC-104', description: 'ห้องบรรยายขนาดกลาง', seatCapacity: 40, status: 'AVAILABLE', size: 'MEDIUM', roomType: 'LECTURE', maxHours: 2, allowedRoles: ['STUDENT', 'LECTURER'] },
      { roomName: 'LC-105', description: 'ห้องบรรยายขนาดเล็ก', seatCapacity: 30, status: 'MAINTENANCE', size: 'SMALL', roomType: 'LECTURE', maxHours: 2, allowedRoles: ['STUDENT', 'LECTURER'] },
      { roomName: 'LC-106', description: 'ห้องประชุมกลุ่มย่อย', seatCapacity: 12, status: 'AVAILABLE', size: 'SMALL', roomType: 'MEETING', maxHours: 2, allowedRoles: ['STUDENT', 'LECTURER'] },
      { roomName: 'Co-working Space', description: 'พื้นที่ทำงานร่วมกัน เหมาะสำหรับนั่งทำงานและอ่านหนังสือ', seatCapacity: 50, status: 'AVAILABLE', size: 'LARGE', roomType: 'COWORKING', maxHours: 4, allowedRoles: ['STUDENT', 'LECTURER'] },
    ])
    .onConflictDoNothing({ target: rooms.roomName });

  const facilityId = Object.fromEntries(
    (await db.select().from(facilities).where(inArray(facilities.name, facilityNames))).map((f) => [f.name, f.id]),
  );
  const roomId = Object.fromEntries((await db.select().from(rooms)).map((r) => [r.roomName, r.id]));

  await db
    .insert(roomFacilities)
    .values([
      { roomId: roomId['LC-101'], facilityId: facilityId['คอมพิวเตอร์'], quantity: 39, sortOrder: 1 },
      { roomId: roomId['LC-101'], facilityId: facilityId['โปรเจกเตอร์'], quantity: 1, sortOrder: 2 },
      { roomId: roomId['LC-101'], facilityId: facilityId['ไมโครโฟน'], quantity: 2, sortOrder: 3 },
      { roomId: roomId['LC-101'], facilityId: facilityId['ไวท์บอร์ด'], quantity: 1, sortOrder: 4 },
      { roomId: roomId['LC-101'], facilityId: facilityId['เครื่องปรับอากาศ'], quantity: 3, sortOrder: 5 },

      { roomId: roomId['LC-102'], facilityId: facilityId['คอมพิวเตอร์'], quantity: 67, sortOrder: 1 },
      { roomId: roomId['LC-102'], facilityId: facilityId['โปรเจกเตอร์'], quantity: 2, sortOrder: 2 },
      { roomId: roomId['LC-102'], facilityId: facilityId['ไมโครโฟน'], quantity: 2, sortOrder: 3 },
      { roomId: roomId['LC-102'], facilityId: facilityId['ไวท์บอร์ด'], quantity: 1, sortOrder: 4 },
      { roomId: roomId['LC-102'], facilityId: facilityId['เครื่องปรับอากาศ'], quantity: 3, sortOrder: 5 },

      { roomId: roomId['LC-103'], facilityId: facilityId['โปรเจกเตอร์'], quantity: 1, sortOrder: 1 },
      { roomId: roomId['LC-103'], facilityId: facilityId['ไมโครโฟน'], quantity: 2, sortOrder: 2 },
      { roomId: roomId['LC-103'], facilityId: facilityId['ไวท์บอร์ด'], quantity: 1, sortOrder: 3 },
      { roomId: roomId['LC-103'], facilityId: facilityId['เครื่องปรับอากาศ'], quantity: 2, sortOrder: 4 },

      { roomId: roomId['LC-104'], facilityId: facilityId['โปรเจกเตอร์'], quantity: 1, sortOrder: 1 },
      { roomId: roomId['LC-104'], facilityId: facilityId['ไมโครโฟน'], quantity: 1, sortOrder: 2 },
      { roomId: roomId['LC-104'], facilityId: facilityId['ไวท์บอร์ด'], quantity: 1, sortOrder: 3 },
      { roomId: roomId['LC-104'], facilityId: facilityId['เครื่องปรับอากาศ'], quantity: 2, sortOrder: 4 },

      { roomId: roomId['LC-105'], facilityId: facilityId['โปรเจกเตอร์'], quantity: 1, sortOrder: 1 },
      { roomId: roomId['LC-105'], facilityId: facilityId['ไมโครโฟน'], quantity: 1, sortOrder: 2 },
      { roomId: roomId['LC-105'], facilityId: facilityId['ไวท์บอร์ด'], quantity: 1, sortOrder: 3 },
      { roomId: roomId['LC-105'], facilityId: facilityId['เครื่องปรับอากาศ'], quantity: 1, sortOrder: 4 },

      { roomId: roomId['LC-106'], facilityId: facilityId['โปรเจกเตอร์'], quantity: 1, sortOrder: 1 },
      { roomId: roomId['LC-106'], facilityId: facilityId['ไวท์บอร์ด'], quantity: 1, sortOrder: 2 },
      { roomId: roomId['LC-106'], facilityId: facilityId['เครื่องปรับอากาศ'], quantity: 1, sortOrder: 3 },

      { roomId: roomId['Co-working Space'], facilityId: facilityId['ไวท์บอร์ด'], quantity: 2, sortOrder: 1 },
      { roomId: roomId['Co-working Space'], facilityId: facilityId['เครื่องปรับอากาศ'], quantity: 3, sortOrder: 2 },
    ])
    .onConflictDoNothing({ target: [roomFacilities.roomId, roomFacilities.facilityId] });


  // Photos and bookings have no natural unique key: only seed them into an empty table
  const [anyPhoto] = await db.select({ id: roomPhotos.id }).from(roomPhotos).limit(1);
  if (!anyPhoto) {
      await db.insert(roomPhotos).values([
      { roomId: roomId['LC-101'], objectKey: 'Room1.jpg', sortOrder: 1 },
      { roomId: roomId['LC-101'], objectKey: 'Room1-1.jpg', sortOrder: 2 },
      { roomId: roomId['LC-101'], objectKey: 'Room1-2.jpg', sortOrder: 3 },

      { roomId: roomId['LC-102'], objectKey: 'Room102.jpg', sortOrder: 1 },
      { roomId: roomId['LC-102'], objectKey: 'Room105(4).jpg', sortOrder: 2 },
      { roomId: roomId['LC-102'], objectKey: 'Room106.jpg', sortOrder: 3 },

      { roomId: roomId['LC-103'], objectKey: 'lec1.jpg', sortOrder: 1 },
      { roomId: roomId['LC-103'], objectKey: 'lec4.jpg', sortOrder: 2 },
      { roomId: roomId['LC-103'], objectKey: 'lec5.jpg', sortOrder: 3 },

      { roomId: roomId['LC-104'], objectKey: 'lec2.jpg', sortOrder: 1 },
      { roomId: roomId['LC-104'], objectKey: 'lec4.jpg', sortOrder: 2 },
      { roomId: roomId['LC-104'], objectKey: 'lec5.jpg', sortOrder: 3 },

      { roomId: roomId['LC-105'], objectKey: 'lec3.jpg', sortOrder: 1 },
      { roomId: roomId['LC-105'], objectKey: 'lec4.jpg', sortOrder: 2 },
      { roomId: roomId['LC-105'], objectKey: 'lec5.jpg', sortOrder: 3 },

      { roomId: roomId['LC-106'], objectKey: 'meet1.jpg', sortOrder: 1 },
      { roomId: roomId['LC-106'], objectKey: 'meet2.jpg', sortOrder: 2 },
      { roomId: roomId['LC-106'], objectKey: 'meet3.jpg', sortOrder: 3 },

      { roomId: roomId['Co-working Space'], objectKey: 'co-working.jpg', sortOrder: 1 },
      { roomId: roomId['Co-working Space'], objectKey: 'co2.png', sortOrder: 2 },
      { roomId: roomId['Co-working Space'], objectKey: 'co3.jpg', sortOrder: 3 },
    ]);
  }

  const [anyBooking] = await db.select({ id: bookings.id }).from(bookings).limit(1);
  if (!anyBooking) await seedBookings(db, roomId);

  return { photosInserted: !anyPhoto, bookingsInserted: !anyBooking };
}

type Status = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
type Type = 'CLASS' | 'SCHEDULE' | 'SPECIAL_EVENT' | 'STUDENT_BOOKING';

/**
 * Bookings for last week (all in the past: history and stats) and next week (every status),
 * each with its timeline. PENDING/APPROVED rows never overlap, or booking_no_overlap rejects the seed.
 */
async function seedBookings(db: Db, roomId: Record<string, string>) {
  const userId = Object.fromEntries((await db.select().from(users)).map((u) => [u.username, u.id]));
  const student1 = userId['6709616541'];
  const student2 = userId['6709000002'];
  const lecturer = userId['lecturer'];
  const staff = userId['staff'];

  // Monday of next week in Bangkok time, so day 0..4 is always in the future and -14..-10 (last week) in the past
  const bangkokNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const daysToMonday = (8 - bangkokNow.getUTCDay()) % 7 || 7;
  const monday = new Date(
    Date.UTC(bangkokNow.getUTCFullYear(), bangkokNow.getUTCMonth(), bangkokNow.getUTCDate() + daysToMonday),
  );
  // at(0, '09:00') = next Monday 09:00 Bangkok time; at(-14, ...) = Monday of last week
  const at = (day: number, time: string) =>
    new Date(`${new Date(monday.getTime() + day * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}T${time}:00+07:00`);

  const rows: Array<{
    userId: string; room: string; type: Type; title: string; day: number; from: string; to: string; status: Status; reason?: string;
  }> = [
    // Last week
    { userId: lecturer, room: 'LC-101', type: 'CLASS', title: 'CS101 ปฏิบัติการ', day: -14, from: '09:00', to: '12:00', status: 'APPROVED' },
    { userId: lecturer, room: 'LC-103', type: 'CLASS', title: 'CS102 บรรยาย', day: -14, from: '13:00', to: '15:00', status: 'APPROVED' },
    { userId: student1, room: 'LC-106', type: 'STUDENT_BOOKING', title: 'ประชุมโปรเจกต์กลุ่ม', day: -13, from: '10:00', to: '12:00', status: 'APPROVED' },
    { userId: lecturer, room: 'LC-102', type: 'CLASS', title: 'CS211 ปฏิบัติการ', day: -12, from: '09:00', to: '12:00', status: 'APPROVED' },
    { userId: student2, room: 'Co-working Space', type: 'STUDENT_BOOKING', title: 'อ่านหนังสือสอบ', day: -12, from: '13:00', to: '16:00', status: 'APPROVED' },
    { userId: student1, room: 'LC-104', type: 'STUDENT_BOOKING', title: 'ติวสอบย่อย', day: -11, from: '15:00', to: '17:00', status: 'REJECTED', reason: 'ห้องถูกใช้จัดกิจกรรมของภาควิชา' },
    { userId: lecturer, room: 'LC-101', type: 'CLASS', title: 'CS201 ปฏิบัติการ', day: -10, from: '13:00', to: '16:00', status: 'APPROVED' },
    { userId: student2, room: 'LC-106', type: 'STUDENT_BOOKING', title: 'นัดพบอาจารย์ที่ปรึกษา', day: -10, from: '10:00', to: '11:00', status: 'CANCELLED', reason: 'อาจารย์ติดธุระ' },
    // Next week: Monday
    { userId: lecturer, room: 'LC-101', type: 'CLASS', title: 'CS101 ปฏิบัติการ', day: 0, from: '09:00', to: '12:00', status: 'APPROVED' },
    { userId: lecturer, room: 'LC-103', type: 'CLASS', title: 'CS102 บรรยาย', day: 0, from: '09:00', to: '11:00', status: 'APPROVED' },
    { userId: lecturer, room: 'LC-101', type: 'CLASS', title: 'CS201 ปฏิบัติการ', day: 0, from: '13:00', to: '16:00', status: 'APPROVED' },
    { userId: student1, room: 'LC-106', type: 'STUDENT_BOOKING', title: 'ประชุมโปรเจกต์กลุ่ม', day: 0, from: '10:00', to: '12:00', status: 'APPROVED' },
    { userId: student2, room: 'LC-106', type: 'STUDENT_BOOKING', title: 'นัดพบอาจารย์ที่ปรึกษา', day: 0, from: '12:00', to: '13:00', status: 'APPROVED' },
    // Tuesday
    { userId: lecturer, room: 'LC-102', type: 'CLASS', title: 'CS211 ปฏิบัติการ', day: 1, from: '09:00', to: '12:00', status: 'APPROVED' },
    { userId: lecturer, room: 'LC-104', type: 'CLASS', title: 'CS213 บรรยาย', day: 1, from: '13:00', to: '15:00', status: 'APPROVED' },
    { userId: lecturer, room: 'Co-working Space', type: 'SPECIAL_EVENT', title: 'Workshop Cloud เบื้องต้น', day: 1, from: '13:00', to: '17:00', status: 'APPROVED' },
    // Wednesday
    { userId: lecturer, room: 'LC-101', type: 'CLASS', title: 'CS101 ปฏิบัติการ', day: 2, from: '09:00', to: '12:00', status: 'APPROVED' },
    { userId: student2, room: 'LC-103', type: 'STUDENT_BOOKING', title: 'ติวสอบกลางภาค', day: 2, from: '15:00', to: '17:00', status: 'PENDING' },
    { userId: student1, room: 'LC-106', type: 'STUDENT_BOOKING', title: 'ประชุมชมรม', day: 2, from: '16:00', to: '18:00', status: 'CANCELLED', reason: 'เลื่อนการประชุม' },
    // Thursday
    { userId: lecturer, room: 'LC-102', type: 'CLASS', title: 'CS211 ปฏิบัติการ', day: 3, from: '09:00', to: '12:00', status: 'APPROVED' },
    { userId: student1, room: 'LC-106', type: 'STUDENT_BOOKING', title: 'ซ้อมสัมภาษณ์ฝึกงาน', day: 3, from: '10:00', to: '12:00', status: 'PENDING' },
    { userId: student2, room: 'LC-104', type: 'STUDENT_BOOKING', title: 'อ่านหนังสือกลุ่ม', day: 3, from: '13:00', to: '15:00', status: 'REJECTED', reason: 'จำนวนผู้ใช้น้อยเกินไปสำหรับห้องบรรยาย' },
    { userId: student1, room: 'LC-104', type: 'STUDENT_BOOKING', title: 'ซ้อมนำเสนองาน', day: 3, from: '14:00', to: '16:00', status: 'APPROVED' },
    // Friday
    { userId: lecturer, room: 'LC-103', type: 'CLASS', title: 'CS102 บรรยาย', day: 4, from: '09:00', to: '11:00', status: 'APPROVED' },
    { userId: lecturer, room: 'LC-102', type: 'SCHEDULE', title: 'สอบปฏิบัติ CS211', day: 4, from: '13:00', to: '16:00', status: 'APPROVED' },
    { userId: student2, room: 'Co-working Space', type: 'STUDENT_BOOKING', title: 'ทำโปรเจกต์จบ', day: 4, from: '09:00', to: '12:00', status: 'PENDING' },
  ];

  const now = new Date();
  const reviewed = (r: (typeof rows)[number]) => r.status === 'APPROVED' || r.status === 'REJECTED';
  const inserted = await db
    .insert(bookings)
    .values(
      rows.map((r) => ({
        userId: r.userId,
        roomId: roomId[r.room],
        bookingType: r.type,
        title: r.title,
        startTime: at(r.day, r.from),
        endTime: at(r.day, r.to),
        status: r.status,
        ...(reviewed(r) && { reviewedBy: staff, reviewedAt: now }),
        ...(r.status === 'REJECTED' && { rejectReason: r.reason }),
        ...(r.status === 'CANCELLED' && { cancelledBy: r.userId, cancelledAt: now, cancelReason: r.reason }),
      })),
    )
    .returning({ id: bookings.id });

  // Every booking was CREATED by its owner; a second event records how it left PENDING.
  // The second batch is a later statement, so its created_at sorts after CREATED.
  await db.insert(bookingEvents).values(
    rows.map((r, i) => ({ bookingId: inserted[i].id, actorId: r.userId, action: 'CREATED' as const })),
  );
  const decided = rows.flatMap((r, i) =>
    r.status === 'PENDING'
      ? []
      : [{ bookingId: inserted[i].id, actorId: reviewed(r) ? staff : r.userId, action: r.status, note: r.reason ?? null }],
  );
  await db.insert(bookingEvents).values(decided);
}
