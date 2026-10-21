// CS361 V3 Project 3, Self-test 1 and 2 (docs/CS361_V3_Project3_In_Class_Setup_and_Self_Test.docx.pdf)
// against a running API, local only (X-Dev-User). Needs `npm run db:class-setup` first.
//   npm run test:class                       dev server
//   API_URL=<localstack url>/api npm run test:class
// Ends with class-reset, so the class rooms are back to the CS100 baseline.
import { getDb } from '../../src/shared/db/client';
import { runClassReset } from '../../src/shared/db/class-setup';

const API_URL = (process.env.API_URL ?? 'http://localhost:3000/api').replace(/\/$/, '');

let failed = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n      ${JSON.stringify(detail)}`}`);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Body = { message: unknown; data: any };
async function call(method: string, path: string, user: string, body?: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Dev-User': user },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as Body };
}

const rooms = (await call('GET', '/rooms', 'stu-a')).body.data as Array<{ id: string; room_name: string }>;
const room = Object.fromEntries(rooms.map((r) => [r.room_name, r.id]));
const cs100 = async () =>
  ((await call('GET', `/bookings?from=2026-11-01&to=2026-11-30&room_id=${room['บร.2-107']}`, 'stu-a')).body.data as unknown[])
    .length;
const cs100Before = await cs100();

const users = (await call('GET', '/users?role=LECTURER', 'staff-1')).body.data as Array<{ id: string; username: string }>;
const facA = users.find((u) => u.username === 'fac-a')!;

try {
  console.log('Self-test 1: STU-A books บร.2-213 (Lab, 65) on 03/11/2026 09:30–11:00 for 60 people\n');
  const st1 = {
    room_id: room['บร.2-213'],
    start_time: '2026-11-03T09:30:00+07:00',
    end_time: '2026-11-03T11:00:00+07:00',
    title: 'CS102',
    purpose: 'เรียน/กิจกรรมรายวิชา CS102',
    attendee_count: 60,
  };
  let r = await call('POST', '/bookings', 'stu-a', { ...st1, attendee_count: 66 });
  check('66 people in a 65-seat room -> 400', r.status === 400 && String(r.body.message).includes('65'), r);

  r = await call('POST', '/bookings', 'stu-a', st1);
  check('request -> 201 PENDING, 60 people', r.status === 201 && r.body.data.status === 'PENDING' && r.body.data.attendee_count === 60, r);
  const id1 = r.body.data?.id;

  r = await call('GET', `/bookings/${id1}`, 'stu-a');
  const d1 = r.body.data;
  check(
    'read back after refresh: room, date/time, 60 people, requester, status',
    r.status === 200 &&
      d1.room.room_name === 'บร.2-213' &&
      d1.start_time === '2026-11-03T02:30:00.000Z' &&
      d1.end_time === '2026-11-03T04:00:00.000Z' &&
      d1.attendee_count === 60 &&
      d1.requester.display_name === 'น.ส.ณิชา ศรีสุข' &&
      d1.status === 'PENDING',
    d1,
  );
  check('CS100 baseline unchanged', (await cs100()) === cs100Before && cs100Before === 5, { cs100Before });

  console.log('\nSelf-test 2: STAFF-1 books บร.2-111 (Lab, 50) for FAC-A on 04/11/2026 13:30–15:00, 45 people\n');
  const st2 = {
    room_id: room['บร.2-111'],
    start_time: '2026-11-04T13:30:00+07:00',
    end_time: '2026-11-04T15:00:00+07:00',
    title: 'อบรมพิเศษ',
    purpose: 'อบรมพิเศษ',
    attendee_count: 45,
    equipment_request: 'ไมโครโฟนลอย, Hotspot / Internet สำรอง',
    booked_for_user_id: facA.id,
  };
  r = await call('POST', '/bookings', 'stu-a', st2);
  check('a student cannot book on behalf -> 403', r.status === 403, r);
  const { booked_for_user_id: _, ...withoutFor } = st2;
  r = await call('POST', '/bookings', 'staff-1', withoutFor);
  check('staff without a room user -> 400', r.status === 400, r);
  r = await call('POST', '/bookings', 'staff-1', { ...st2, attendee_count: 51 });
  check('51 people in a 50-seat room -> 400', r.status === 400, r);

  r = await call('POST', '/bookings', 'staff-1', st2);
  check('staff books for FAC-A -> 201', r.status === 201, r);
  const id2 = r.body.data?.id;

  r = await call('GET', `/bookings/${id2}`, 'staff-1');
  const d2 = r.body.data;
  check(
    'requester STAFF-1 and room user FAC-A are kept apart',
    d2.requester.display_name === 'คุณวาริชา วงศ์ดี' && d2.booked_for?.display_name === 'อ.ดร.กิตติพงษ์ นิรันดร์',
    d2,
  );
  check('45 people ≤ 50 seats, time 13:30–15:00', d2.attendee_count === 45 && d2.room.seat_capacity === 50 && d2.start_time === '2026-11-04T06:30:00.000Z', d2);
  check('equipment stored as a request', d2.equipment_request === st2.equipment_request, d2);
  check('status follows the workflow (staff booking = APPROVED)', d2.status === 'APPROVED', d2.status);

  r = await call('GET', '/bookings/mine?scope=all&limit=50', 'fac-a');
  check('FAC-A sees it in "my bookings"', (r.body.data.items as Array<{ id: string }>).some((b) => b.id === id2), r);

  console.log('\nOther rules\n');
  r = await call('POST', '/bookings', 'fac-a', {
    room_id: room['บร.2-306'],
    start_time: '2026-11-05T09:00:00+07:00',
    end_time: '2026-11-05T10:00:00+07:00',
    attendee_count: 200,
  });
  check('room with no known capacity is not compared to a guess -> 201', r.status === 201, r);
  r = await call('POST', '/bookings', 'stu-a', { ...st1, start_time: '2026-11-03T10:00:00+07:00', end_time: '2026-11-03T10:30:00+07:00' });
  check('overlap with Self-test 1 -> 409', r.status === 409, r);
} finally {
  await runClassReset(getDb());
}

console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
