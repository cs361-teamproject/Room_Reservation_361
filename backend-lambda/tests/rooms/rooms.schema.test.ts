import {
  createRoomBody,
  listQuery,
  photoOrderBody,
  photoUploadBody,
  roomRulesBody,
  updateRoomBody,
} from '../../src/functions/rooms/rooms.schema';

/** The messages the API would answer with, in the same "path: message" form as shared/http/validate.ts */
function errorsOf(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  return (result.error?.issues ?? []).map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message));
}

describe('List query', () => {
  test('Full query: q, room_type, facilities, start/end with offset', () => {
    const r = listQuery.safeParse({
      q: 'Lab',
      room_type: 'LAB,MEETING',
      facilities: 'projector',
      start: '2026-11-05T09:00:00+07:00',
      end: '2026-11-05T11:00:00+07:00',
    });
    expect(r.success).toBe(true);
    expect(r.data?.room_type).toEqual(['LAB', 'MEETING']);
  });

  test('CSV values are trimmed (" LAB , LECTURE ")', () => {
    expect(listQuery.parse({ room_type: ' LAB , LECTURE ' }).room_type).toEqual(['LAB', 'LECTURE']);
  });

  test('Unknown room_type is rejected', () => {
    expect(errorsOf(listQuery.safeParse({ room_type: 'LAB,KITCHEN' }))).toContain(
      'room_type.1: Must be one of LAB, LECTURE, MEETING, COWORKING',
    );
  });

  test('Unknown facility key is rejected', () => {
    expect(listQuery.safeParse({ facilities: 'wifi' }).success).toBe(false);
  });

  test('start without end is rejected', () => {
    expect(errorsOf(listQuery.safeParse({ start: '2026-11-05T09:00:00Z' }))).toEqual([
      'start and end must be sent together',
    ]);
  });

  test('end equal to start is rejected', () => {
    const t = '2026-11-05T09:00:00Z';
    expect(errorsOf(listQuery.safeParse({ start: t, end: t }))).toEqual(['end: Must be after start']);
  });

  test('Datetime without UTC offset is rejected', () => {
    const r = listQuery.safeParse({ start: '2026-11-05T09:00:00', end: '2026-11-05T10:00:00' });
    expect(r.success).toBe(false);
  });

  test('q longer than 100 characters is rejected', () => {
    expect(listQuery.safeParse({ q: 'a'.repeat(101) }).success).toBe(false);
  });
});

describe('Create room body', () => {
  const valid = { room_name: 'Lab 101', room_type: 'LAB', size: 'MEDIUM', seat_capacity: 40 };

  test('status defaults to AVAILABLE', () => {
    expect(createRoomBody.parse(valid).status).toBe('AVAILABLE');
  });

  test('room_name is trimmed', () => {
    expect(createRoomBody.parse({ ...valid, room_name: '  Lab 101  ' }).room_name).toBe('Lab 101');
  });

  test('Blank room_name (spaces only) is rejected', () => {
    expect(errorsOf(createRoomBody.safeParse({ ...valid, room_name: '   ' }))).toContain(
      'room_name: room_name is required',
    );
  });

  test('seat_capacity "30" from a form is coerced to a number', () => {
    expect(createRoomBody.parse({ ...valid, seat_capacity: '30' }).seat_capacity).toBe(30);
  });

  test.each([
    ['0', 0],
    ['negative', -5],
    ['over 1000', 1001],
    ['decimal', 12.5],
  ])('Invalid seat_capacity is rejected [%s]', (_label, seat_capacity) => {
    expect(createRoomBody.safeParse({ ...valid, seat_capacity }).success).toBe(false);
  });

  test('Unknown size is rejected', () => {
    expect(errorsOf(createRoomBody.safeParse({ ...valid, size: 'HUGE' }))).toContain(
      'size: Must be one of SMALL, MEDIUM, LARGE',
    );
  });
});

describe('Update room body', () => {
  test('Empty body is rejected', () => {
    expect(errorsOf(updateRoomBody.safeParse({}))).toEqual(['At least one field is required']);
  });

  test('One field alone is enough', () => {
    expect(updateRoomBody.parse({ status: 'MAINTENANCE' })).toEqual({ status: 'MAINTENANCE' });
  });

  test('description can be cleared with null', () => {
    expect(updateRoomBody.parse({ description: null })).toEqual({ description: null });
  });
});

describe('Room rules body', () => {
  test('max_hours 1-12 with STUDENT and LECTURER is accepted', () => {
    expect(roomRulesBody.safeParse({ max_hours: 12, allowed_roles: ['STUDENT', 'LECTURER'] }).success).toBe(true);
  });

  test.each([0, 13])('max_hours out of range is rejected [%s]', (max_hours) => {
    expect(roomRulesBody.safeParse({ max_hours, allowed_roles: ['STUDENT'] }).success).toBe(false);
  });

  test('Empty allowed_roles is rejected', () => {
    expect(errorsOf(roomRulesBody.safeParse({ max_hours: 2, allowed_roles: [] }))).toContain(
      'allowed_roles: allowed_roles must have at least 1 role',
    );
  });

  test('STAFF or ADMIN cannot be a booking role', () => {
    expect(roomRulesBody.safeParse({ max_hours: 2, allowed_roles: ['ADMIN'] }).success).toBe(false);
  });
});

describe('Photo bodies', () => {
  test('JPG under 5 MB is accepted', () => {
    expect(photoUploadBody.safeParse({ content_type: 'image/jpeg', size: 1024 }).success).toBe(true);
  });

  test('GIF is rejected with the Thai message', () => {
    expect(errorsOf(photoUploadBody.safeParse({ content_type: 'image/gif', size: 1024 }))).toContain(
      'content_type: รองรับเฉพาะไฟล์ JPG, PNG หรือ WebP',
    );
  });

  test('File over 5 MB is rejected', () => {
    const r = photoUploadBody.safeParse({ content_type: 'image/png', size: 5 * 1024 * 1024 + 1 });
    expect(errorsOf(r)).toContain('size: ไฟล์ต้องมีขนาดไม่เกิน 5 MB');
  });

  test('Reorder with more than 10 ids is rejected', () => {
    const ids = Array.from({ length: 11 }, (_, i) => `p${i}`);
    expect(photoOrderBody.safeParse({ ids }).success).toBe(false);
  });
});
