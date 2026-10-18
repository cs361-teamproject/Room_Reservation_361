import { randomUUID } from 'node:crypto';
import { deleteObjectQuietly, objectUrl, presignPhotoPost } from '../../shared/aws/s3';
import { badRequest, conflict, notFound } from '../../shared/http/errors';
import { type NewRoom, type RoomDetail, type RoomFilters, type RoomWithDetails, roomsRepository as repo } from './rooms.repository';
import {
  type CreateRoomBody,
  type ListQuery,
  PHOTO_MAX_COUNT,
  type PhotoUploadBody,
  type RoomRulesBody,
  type UpdateRoomBody,
} from './rooms.schema';

const PHOTO_EXTENSIONS: Record<PhotoUploadBody['content_type'], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Uploaded photos live under rooms/<roomId>/, one key per upload. Seeded photos use shared
 * keys (several rooms point at lec4.jpg), so only keys under this prefix are deleted from S3.
 */
const photoPrefix = (roomId: string) => `rooms/${roomId}/`;

async function photosOf(roomId: string) {
  return mapPhotos(await repo.listPhotos(roomId));
}

async function requireLiveRoom(id: string) {
  if (!(await repo.findLiveRoom(id))) throw notFound(`Room with ID "${id}" not found`);
}

// Facility names as seeded (scripts/db/seed.ts) → the count fields the room cards show
const COUNTED_FACILITIES: Record<string, 'computers' | 'projector' | 'mic'> = {
  คอมพิวเตอร์: 'computers',
  โปรเจกเตอร์: 'projector',
  ไมโครโฟน: 'mic',
};

// Maps API-facing facility filter keys → Thai DB names for the repository
const FACILITY_KEY_TO_NAME: Record<string, string> = {
  computers: 'คอมพิวเตอร์',
  projector: 'โปรเจกเตอร์',
  mic: 'ไมโครโฟน',
};

type CountField = 'computers' | 'projector' | 'mic';

function countFacilities(facilities: { facility: { name: string }; quantity: number }[]): Record<CountField, number> {
  const counts: Record<CountField, number> = { computers: 0, projector: 0, mic: 0 };
  for (const rf of facilities) {
    const field = COUNTED_FACILITIES[rf.facility.name];
    if (field) counts[field] += rf.quantity;
  }
  return counts;
}

const mapPhotos = (photos: { id: string; objectKey: string }[]) =>
  photos.map((p) => ({ id: p.id, object_key: p.objectKey, url: objectUrl(p.objectKey) }));

// API responses keep snake_case keys, like the rest of the API contract
const toListItem = (room: RoomWithDetails) => ({
  id: room.id,
  room_name: room.roomName,
  description: room.description,
  room_type: room.roomType,
  size: room.size,
  status: room.status,
  seat_capacity: room.seatCapacity,
  // The admin room table edits from the list, so it needs the rules too
  max_hours: room.maxHours,
  allowed_roles: room.allowedRoles,
  ...countFacilities(room.roomFacilities),
  photos: mapPhotos(room.photos),
});

const toDetailItem = (room: RoomDetail) => ({
  id: room.id,
  room_name: room.roomName,
  description: room.description,
  room_type: room.roomType,
  size: room.size,
  status: room.status,
  seat_capacity: room.seatCapacity,
  max_hours: room.maxHours,
  allowed_roles: room.allowedRoles,
  ...countFacilities(room.roomFacilities),
  facilities: room.roomFacilities.map((rf) => ({
    name: rf.facility.name,
    quantity: rf.quantity,
    broken_quantity: rf.brokenQuantity,
    note: rf.note,
  })),
  photos: mapPhotos(room.photos),
});

function toRepoFilters(query: ListQuery): RoomFilters {
  return {
    q: query.q,
    roomTypes: query.room_type,
    // Translate API keys → Thai facility names expected by the DB
    facilityNames: query.facilities?.map((k: string) => FACILITY_KEY_TO_NAME[k]).filter(Boolean),
    start: query.start ? new Date(query.start) : undefined,
    end: query.end ? new Date(query.end) : undefined,
  };
}

export const roomsService = {
  async list(query: ListQuery = {}) {
    return (await repo.findAllWithDetails(toRepoFilters(query))).map(toListItem);
  },

  async get(id: string) {
    const room = await repo.findByIdWithDetails(id);
    if (!room) throw notFound(`Room with ID "${id}" not found`);
    return toDetailItem(room);
  },

  /** Staff/Admin. Duplicate names answer 409 via the unique index (fromDbError 23505). */
  async create(body: CreateRoomBody) {
    const inserted = await repo.insertRoom({
      roomName: body.room_name,
      description: body.description ?? null,
      roomType: body.room_type,
      size: body.size,
      seatCapacity: body.seat_capacity,
      status: body.status,
    } satisfies NewRoom);
    const room = await repo.findByIdWithDetails(inserted.id);
    if (!room) throw notFound(`Room with ID "${inserted.id}" not found`);
    return toDetailItem(room);
  },

  /** Staff/Admin: name, description, capacity, status only — rules go through updateRules. */
  async update(id: string, body: UpdateRoomBody) {
    const live = await repo.findLiveRoom(id);
    if (!live) throw notFound(`Room with ID "${id}" not found`);
    const values: Partial<NewRoom> = {};
    if (body.room_name !== undefined) values.roomName = body.room_name;
    if (body.room_type !== undefined) values.roomType = body.room_type;
    if (body.size !== undefined) values.size = body.size;
    if (body.description !== undefined) values.description = body.description;
    if (body.seat_capacity !== undefined) values.seatCapacity = body.seat_capacity;
    if (body.status !== undefined) values.status = body.status;
    await repo.updateRoom(id, values);
    const room = await repo.findByIdWithDetails(id);
    if (!room) throw notFound(`Room with ID "${id}" not found`);
    return toDetailItem(room);
  },

  /**
   * Staff/Admin soft delete. A room still holding a future PENDING/APPROVED
   * booking answers 409 so active reservations are never orphaned.
   */
  async remove(id: string) {
    const live = await repo.findLiveRoom(id);
    if (!live) throw notFound(`Room with ID "${id}" not found`);
    if (await repo.hasFutureActiveBookings(id, new Date())) {
      throw conflict('ห้องนี้ยังมีการจองในอนาคต ไม่สามารถลบได้');
    }
    const deleted = await repo.softDeleteRoom(id);
    return { id: deleted.id, deleted_at: deleted.deletedAt };
  },

  /** Admin only (route guard): per-room booking rules shown on GET /:id. */
  async updateRules(id: string, body: RoomRulesBody) {
    const live = await repo.findLiveRoom(id);
    if (!live) throw notFound(`Room with ID "${id}" not found`);
    await repo.updateRoom(id, {
      maxHours: body.max_hours,
      allowedRoles: [...body.allowed_roles],
    } satisfies Partial<NewRoom>);
    const room = await repo.findByIdWithDetails(id);
    if (!room) throw notFound(`Room with ID "${id}" not found`);
    return toDetailItem(room);
  },

  /** Step 1 of an upload: a presigned POST the browser sends the file to (5 minutes, ≤5 MB, this type only) */
  async photoUploadUrl(roomId: string, body: PhotoUploadBody) {
    await requireLiveRoom(roomId);
    if ((await repo.listPhotos(roomId)).length >= PHOTO_MAX_COUNT) {
      throw badRequest(`ห้องหนึ่งมีรูปได้ไม่เกิน ${PHOTO_MAX_COUNT} รูป`);
    }
    const objectKey = `${photoPrefix(roomId)}${randomUUID()}.${PHOTO_EXTENSIONS[body.content_type]}`;
    const { url, fields } = await presignPhotoPost(objectKey, body.content_type);
    return { upload_url: url, fields, object_key: objectKey };
  },

  /** Step 2: after S3 accepted the file, attach it to the room as the last photo */
  async addPhoto(roomId: string, objectKey: string) {
    await requireLiveRoom(roomId);
    // Only keys handed out by photoUploadUrl for this room
    const pattern = new RegExp(`^${photoPrefix(roomId)}[0-9a-f-]{36}\\.(jpg|png|webp)$`);
    if (!pattern.test(objectKey)) throw badRequest('object_key: ไม่ใช่ไฟล์ที่อัปโหลดให้ห้องนี้');
    const photos = await repo.listPhotos(roomId);
    if (photos.some((p) => p.objectKey === objectKey)) throw conflict('รูปนี้ถูกเพิ่มให้ห้องแล้ว');
    if (photos.length >= PHOTO_MAX_COUNT) throw badRequest(`ห้องหนึ่งมีรูปได้ไม่เกิน ${PHOTO_MAX_COUNT} รูป`);
    const last = photos.reduce((max, p) => Math.max(max, p.sortOrder), 0);
    await repo.insertPhoto({ roomId, objectKey, sortOrder: last + 1 });
    return photosOf(roomId);
  },

  async removePhoto(roomId: string, photoId: string) {
    await requireLiveRoom(roomId);
    const removed = await repo.deletePhoto(roomId, photoId);
    if (!removed) throw notFound('Photo not found');
    if (removed.objectKey.startsWith(photoPrefix(roomId))) await deleteObjectQuietly(removed.objectKey);
    return photosOf(roomId);
  },

  /** `ids` must be exactly this room's photos, in the new order */
  async reorderPhotos(roomId: string, ids: string[]) {
    await requireLiveRoom(roomId);
    const current = (await repo.listPhotos(roomId)).map((p) => p.id);
    const same = ids.length === current.length && new Set(ids).size === ids.length && ids.every((id) => current.includes(id));
    if (!same) throw badRequest('ids: ต้องเป็นรูปทั้งหมดของห้องนี้ ไม่ซ้ำ และไม่ขาด');
    await repo.reorderPhotos(roomId, ids);
    return photosOf(roomId);
  },
};
