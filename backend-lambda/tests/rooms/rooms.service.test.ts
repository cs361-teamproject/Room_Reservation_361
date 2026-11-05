/**
 * roomsService with the repository and S3 mocked: no database, no AWS.
 * Checks the business rules (404/409/400, field mapping, photo keys) the routes rely on.
 */
import { roomsRepository } from '../../src/functions/rooms/rooms.repository';
import { roomsService } from '../../src/functions/rooms/rooms.service';
import { deleteObjectQuietly, presignPhotoPost } from '../../src/shared/aws/s3';
import { HttpError } from '../../src/shared/http/errors';

jest.mock('../../src/functions/rooms/rooms.repository', () => ({
  roomsRepository: {
    listPhotos: jest.fn(),
    insertPhoto: jest.fn(),
    deletePhoto: jest.fn(),
    reorderPhotos: jest.fn(),
    findAllWithDetails: jest.fn(),
    findByIdWithDetails: jest.fn(),
    insertRoom: jest.fn(),
    updateRoom: jest.fn(),
    softDeleteRoom: jest.fn(),
    findLiveRoom: jest.fn(),
    hasFutureActiveBookings: jest.fn(),
  },
}));

jest.mock('../../src/shared/aws/s3', () => ({
  PHOTO_CONTENT_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  PHOTO_MAX_BYTES: 5 * 1024 * 1024,
  objectUrl: (key: string) => `https://bucket.test/${key}`,
  presignPhotoPost: jest.fn(),
  deleteObjectQuietly: jest.fn(),
}));

const repo = jest.mocked(roomsRepository);
const ROOM_ID = 'room-1';
const UUID = '0b6c1f2e-8a8e-4c55-9d7e-3f1a2b3c4d5e';

/** A room as findByIdWithDetails returns it (camelCase, Thai facility names) */
function dbRoom(overrides: Record<string, unknown> = {}) {
  return {
    id: ROOM_ID,
    roomName: 'Lab 101',
    description: null,
    roomType: 'LAB',
    size: 'MEDIUM',
    status: 'AVAILABLE',
    seatCapacity: 40,
    maxHours: 3,
    allowedRoles: ['STUDENT', 'LECTURER'],
    deletedAt: null,
    roomFacilities: [
      { quantity: 40, brokenQuantity: 2, note: null, facility: { name: 'คอมพิวเตอร์' } },
      { quantity: 1, brokenQuantity: 0, note: 'HDMI', facility: { name: 'โปรเจกเตอร์' } },
      { quantity: 3, brokenQuantity: 0, note: null, facility: { name: 'ไวท์บอร์ด' } },
    ],
    photos: [{ id: 'p1', objectKey: 'lec4.jpg' }],
    ...overrides,
  } as never;
}

const photo = (id: string, objectKey: string, sortOrder: number) => ({ id, objectKey, sortOrder });

/** Runs `fn` and returns the HttpError status it threw */
async function statusOf(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (err) {
    if (err instanceof HttpError) return err.status;
    throw err;
  }
  throw new Error('expected an HttpError');
}

describe('Room service: read', () => {
  test('list maps to snake_case and counts computers/projector/mic', async () => {
    repo.findAllWithDetails.mockResolvedValue([dbRoom()]);
    const [room] = await roomsService.list();
    expect(room).toMatchObject({
      id: ROOM_ID,
      room_name: 'Lab 101',
      room_type: 'LAB',
      seat_capacity: 40,
      max_hours: 3,
      computers: 40,
      projector: 1,
      mic: 0,
      photos: [{ id: 'p1', object_key: 'lec4.jpg', url: 'https://bucket.test/lec4.jpg' }],
    });
  });

  test('list turns facility keys into Thai DB names and start/end into Dates', async () => {
    repo.findAllWithDetails.mockResolvedValue([]);
    await roomsService.list({
      facilities: ['projector', 'mic'],
      start: '2026-11-05T09:00:00+07:00',
      end: '2026-11-05T11:00:00+07:00',
    });
    expect(repo.findAllWithDetails).toHaveBeenCalledWith({
      q: undefined,
      roomTypes: undefined,
      facilityNames: ['โปรเจกเตอร์', 'ไมโครโฟน'],
      start: new Date('2026-11-05T02:00:00Z'),
      end: new Date('2026-11-05T04:00:00Z'),
    });
  });

  test('get returns every facility with broken_quantity and note', async () => {
    repo.findByIdWithDetails.mockResolvedValue(dbRoom());
    const room = await roomsService.get(ROOM_ID);
    expect(room.facilities).toEqual([
      { name: 'คอมพิวเตอร์', quantity: 40, broken_quantity: 2, note: null },
      { name: 'โปรเจกเตอร์', quantity: 1, broken_quantity: 0, note: 'HDMI' },
      { name: 'ไวท์บอร์ด', quantity: 3, broken_quantity: 0, note: null },
    ]);
  });

  test('get of a missing or deleted room answers 404', async () => {
    repo.findByIdWithDetails.mockResolvedValue(null);
    expect(await statusOf(() => roomsService.get('nope'))).toBe(404);
  });
});

describe('Room service: write', () => {
  test('create sends camelCase values and description null when omitted', async () => {
    repo.insertRoom.mockResolvedValue({ id: ROOM_ID } as never);
    repo.findByIdWithDetails.mockResolvedValue(dbRoom());
    await roomsService.create({ room_name: 'Lab 101', room_type: 'LAB', size: 'MEDIUM', seat_capacity: 40, status: 'AVAILABLE' });
    expect(repo.insertRoom).toHaveBeenCalledWith({
      roomName: 'Lab 101',
      description: null,
      roomType: 'LAB',
      size: 'MEDIUM',
      seatCapacity: 40,
      status: 'AVAILABLE',
    });
  });

  test('update writes only the fields that were sent', async () => {
    repo.findLiveRoom.mockResolvedValue({ id: ROOM_ID });
    repo.findByIdWithDetails.mockResolvedValue(dbRoom({ status: 'MAINTENANCE' }));
    const room = await roomsService.update(ROOM_ID, { status: 'MAINTENANCE' });
    expect(repo.updateRoom).toHaveBeenCalledWith(ROOM_ID, { status: 'MAINTENANCE' });
    expect(room.status).toBe('MAINTENANCE');
  });

  test('update of a missing room answers 404 and writes nothing', async () => {
    repo.findLiveRoom.mockResolvedValue(undefined);
    expect(await statusOf(() => roomsService.update('nope', { seat_capacity: 10 }))).toBe(404);
    expect(repo.updateRoom).not.toHaveBeenCalled();
  });

  test('updateRules saves max_hours and allowed_roles', async () => {
    repo.findLiveRoom.mockResolvedValue({ id: ROOM_ID });
    repo.findByIdWithDetails.mockResolvedValue(dbRoom());
    await roomsService.updateRules(ROOM_ID, { max_hours: 4, allowed_roles: ['LECTURER'] });
    expect(repo.updateRoom).toHaveBeenCalledWith(ROOM_ID, { maxHours: 4, allowedRoles: ['LECTURER'] });
  });

  test('remove of a room with a future booking answers 409', async () => {
    repo.findLiveRoom.mockResolvedValue({ id: ROOM_ID });
    repo.hasFutureActiveBookings.mockResolvedValue(true);
    expect(await statusOf(() => roomsService.remove(ROOM_ID))).toBe(409);
    expect(repo.softDeleteRoom).not.toHaveBeenCalled();
  });

  test('remove soft-deletes and returns id and deleted_at', async () => {
    const deletedAt = new Date('2026-11-05T00:00:00Z');
    repo.findLiveRoom.mockResolvedValue({ id: ROOM_ID });
    repo.hasFutureActiveBookings.mockResolvedValue(false);
    repo.softDeleteRoom.mockResolvedValue({ id: ROOM_ID, deletedAt } as never);
    expect(await roomsService.remove(ROOM_ID)).toEqual({ id: ROOM_ID, deleted_at: deletedAt });
  });
});

describe('Room service: photos', () => {
  beforeEach(() => {
    repo.findLiveRoom.mockResolvedValue({ id: ROOM_ID });
  });

  test('upload-url key is rooms/<roomId>/<uuid>.<ext>', async () => {
    repo.listPhotos.mockResolvedValue([]);
    jest.mocked(presignPhotoPost).mockResolvedValue({ url: 'https://s3.test', fields: {} });
    const res = await roomsService.photoUploadUrl(ROOM_ID, { content_type: 'image/webp', size: 1000 });
    expect(res.object_key).toMatch(new RegExp(`^rooms/${ROOM_ID}/[0-9a-f-]{36}\\.webp$`));
    expect(presignPhotoPost).toHaveBeenCalledWith(res.object_key, 'image/webp');
  });

  test('upload-url for a room that already has 10 photos answers 400', async () => {
    repo.listPhotos.mockResolvedValue(Array.from({ length: 10 }, (_, i) => photo(`p${i}`, `k${i}`, i + 1)));
    expect(await statusOf(() => roomsService.photoUploadUrl(ROOM_ID, { content_type: 'image/png', size: 1 }))).toBe(400);
  });

  test.each([
    ['another room', `rooms/room-2/${UUID}.jpg`],
    ['not a uuid', `rooms/${ROOM_ID}/cat.jpg`],
    ['wrong extension', `rooms/${ROOM_ID}/${UUID}.gif`],
  ])('addPhoto rejects a key it did not hand out [%s]', async (_label, key) => {
    expect(await statusOf(() => roomsService.addPhoto(ROOM_ID, key))).toBe(400);
  });

  test('addPhoto of the same key twice answers 409', async () => {
    const key = `rooms/${ROOM_ID}/${UUID}.jpg`;
    repo.listPhotos.mockResolvedValue([photo('p1', key, 1)]);
    expect(await statusOf(() => roomsService.addPhoto(ROOM_ID, key))).toBe(409);
  });

  test('addPhoto puts the new photo last (max sortOrder + 1)', async () => {
    const key = `rooms/${ROOM_ID}/${UUID}.png`;
    repo.listPhotos.mockResolvedValue([photo('p1', 'a.jpg', 1), photo('p2', 'b.jpg', 5)]);
    await roomsService.addPhoto(ROOM_ID, key);
    expect(repo.insertPhoto).toHaveBeenCalledWith({ roomId: ROOM_ID, objectKey: key, sortOrder: 6 });
  });

  test('removePhoto deletes an uploaded file from S3', async () => {
    const key = `rooms/${ROOM_ID}/${UUID}.jpg`;
    repo.deletePhoto.mockResolvedValue({ objectKey: key });
    repo.listPhotos.mockResolvedValue([]);
    await roomsService.removePhoto(ROOM_ID, 'p1');
    expect(deleteObjectQuietly).toHaveBeenCalledWith(key);
  });

  test('removePhoto keeps a shared seeded file (lec4.jpg) in S3', async () => {
    repo.deletePhoto.mockResolvedValue({ objectKey: 'lec4.jpg' });
    repo.listPhotos.mockResolvedValue([]);
    await roomsService.removePhoto(ROOM_ID, 'p1');
    expect(deleteObjectQuietly).not.toHaveBeenCalled();
  });

  test.each([
    ['missing one', ['p1']],
    ['duplicate', ['p1', 'p1']],
    ['foreign id', ['p1', 'x9']],
  ])('reorderPhotos rejects ids that are not exactly this room\'s photos [%s]', async (_label, ids) => {
    repo.listPhotos.mockResolvedValue([photo('p1', 'a', 1), photo('p2', 'b', 2)]);
    expect(await statusOf(() => roomsService.reorderPhotos(ROOM_ID, ids))).toBe(400);
    expect(repo.reorderPhotos).not.toHaveBeenCalled();
  });
});
