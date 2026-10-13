// End-to-end checks for POST /api/bookings against a running API, local only.
//   npm run test:bookings                       dev server (npm run dev)
//   API_URL=<localstack url>/api npm run test:bookings
// Logs in with the X-Dev-User header, so the API must run with STAGE=local.
// Test bookings are titled "[test] ..." and deleted from DATABASE_URL afterwards.
import { inArray, like } from 'drizzle-orm';
import { getDb } from '../../src/shared/db/client';
import { bookingEvents, bookings } from '../../src/shared/db/schema';

const API_URL = (process.env.API_URL ?? 'http://localhost:3000/api').replace(/\/$/, '');
const STUDENT = '6709616541';
const LECTURER = 'lecturer';
const STAFF = 'staff';

let failed = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n      ${JSON.stringify(detail)}`}`);
};

async function post(user: string | null, body: unknown) {
  const res = await fetch(`${API_URL}/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(user && { 'X-Dev-User': user }) },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as { message: string | string[]; data: any } };
}

// A random far-future day, so reruns do not collide with each other or with the seed
const day = new Date(Date.UTC(2031, 0, 1) + Math.floor(Math.random() * 700) * 86_400_000).toISOString().slice(0, 10);
const at = (time: string) => `${day}T${time}:00+07:00`;

const getData = async <T>(path: string) => ((await (await fetch(`${API_URL}${path}`)).json()) as { data: T }).data;

const rooms = await getData<Array<{ id: string; room_name: string }>>('/rooms');
const room = Object.fromEntries(rooms.map((r) => [r.room_name, r.id]));
const meeting = room['LC-106']; // STUDENT + LECTURER, 2 hours
const lab = room['LC-101']; // LECTURER only, 3 hours
const closed = room['LC-105']; // MAINTENANCE
const slot = { room_id: meeting, start_time: at('10:00'), end_time: at('12:00'), title: '[test] ประชุมกลุ่ม' };

console.log(`API ${API_URL}, test day ${day}\n`);
try {
  let r = await post(null, slot);
  check('no login -> 401', r.status === 401, r);

  r = await post('nobody-999', slot);
  check('unknown user -> 403', r.status === 403, r);

  r = await post(STAFF, slot);
  check('STAFF cannot book -> 403', r.status === 403, r);

  r = await post(STUDENT, { room_id: meeting, start_time: '2031-01-01 10:00' });
  check('bad body -> 400 per field', r.status === 400 && String(r.body.message).includes('end_time'), r);

  r = await post(STUDENT, { ...slot, room_id: 'no-such-room' });
  check('unknown room -> 404', r.status === 404, r);

  r = await post(STUDENT, { ...slot, room_id: lab });
  check('student books lecturer-only room -> 403', r.status === 403 && String(r.body.message).includes('อาจารย์'), r);

  r = await post(STUDENT, { ...slot, room_id: closed });
  check('MAINTENANCE room -> 400', r.status === 400, r);

  r = await post(STUDENT, { ...slot, start_time: '2020-01-01T10:00:00+07:00', end_time: '2020-01-01T11:00:00+07:00' });
  check('start in the past -> 400', r.status === 400, r);

  r = await post(STUDENT, { ...slot, end_time: at('09:00') });
  check('end before start -> 400', r.status === 400, r);

  r = await post(STUDENT, { ...slot, end_time: at('13:00') });
  check('longer than max_hours (3h > 2h) -> 400', r.status === 400 && String(r.body.message).includes('2 ชั่วโมง'), r);

  r = await post(STUDENT, slot);
  check(
    'valid booking -> 201 PENDING STUDENT_BOOKING',
    r.status === 201 && r.body.data.status === 'PENDING' && r.body.data.booking_type === 'STUDENT_BOOKING' && r.body.data.title === slot.title,
    r,
  );
  const createdId: string = r.body.data?.id;

  r = await post(LECTURER, slot);
  check('same slot again -> 409', r.status === 409, r);

  r = await post(LECTURER, { ...slot, start_time: at('11:00'), end_time: at('13:00') });
  check('partial overlap -> 409', r.status === 409, r);

  r = await post(LECTURER, { ...slot, start_time: at('12:00'), end_time: at('13:00') });
  check('back-to-back (12:00-13:00) -> 201 CLASS', r.status === 201 && r.body.data.booking_type === 'CLASS', r);

  const race = await Promise.all(
    Array.from({ length: 10 }, () => post(STUDENT, { ...slot, start_time: at('15:00'), end_time: at('16:00') })),
  );
  const statuses = race.map((x) => x.status).sort();
  check('10 requests race for one slot -> one 201, nine 409', statuses.join() === ['201', ...Array(9).fill('409')].join(), statuses);

  const list = await getData<Array<{ id: string; title: string | null }>>(`/bookings?from=${day}&to=${day}&room_id=${meeting}`);
  const listed = list.find((b) => b.id === createdId);
  check('GET /bookings lists it, title hidden for STUDENT_BOOKING', list.length === 3 && listed?.title === null, list);

  const ids = list.map((b) => b.id);
  const events = await getDb().select().from(bookingEvents).where(inArray(bookingEvents.bookingId, ids));
  check(
    'exactly one CREATED event per booking (none from rejected requests)',
    events.length === 3 && events.every((e) => e.action === 'CREATED'),
    events.length,
  );
} finally {
  await getDb().delete(bookings).where(like(bookings.title, '[test]%'));
}

console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
