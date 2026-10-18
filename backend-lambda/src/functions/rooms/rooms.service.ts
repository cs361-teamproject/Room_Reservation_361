import { objectUrl } from '../../shared/aws/s3';
import { conflict, notFound } from '../../shared/http/errors';
import { type NewRoom, type RoomDetail, type RoomFilters, type RoomWithDetails, roomsRepository as repo } from './rooms.repository';
import type { CreateRoomBody, ListQuery, RoomRulesBody, UpdateRoomBody } from './rooms.schema';

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

const mapPhotos = (photos: { objectKey: string }[]) =>
  photos.map((p) => ({ object_key: p.objectKey, url: objectUrl(p.objectKey) }));

// API responses keep snake_case keys, like the rest of the API contract
const toListItem = (room: RoomWithDetails) => ({
  id: room.id,
  room_name: room.roomName,
  description: room.description,
  room_type: room.roomType,
  size: room.size,
  status: room.status,
  seat_capacity: room.seatCapacity,
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
};
