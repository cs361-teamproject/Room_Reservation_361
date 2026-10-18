import { relations } from 'drizzle-orm';
import { bookingEvents, bookings, facilities, roomFacilities, roomPhotos, rooms, users } from './schema';

export const usersRelations = relations(users, ({ many }) => ({
  bookings: many(bookings, { relationName: 'bookingUser' }),
  cancelledBookings: many(bookings, { relationName: 'bookingCancelledBy' }),
  reviewedBookings: many(bookings, { relationName: 'bookingReviewedBy' }),
  bookingEvents: many(bookingEvents),
}));

export const roomsRelations = relations(rooms, ({ many }) => ({
  bookings: many(bookings),
  photos: many(roomPhotos),
  roomFacilities: many(roomFacilities),
}));

export const facilitiesRelations = relations(facilities, ({ many }) => ({
  roomFacilities: many(roomFacilities),
}));

export const roomFacilitiesRelations = relations(roomFacilities, ({ one }) => ({
  room: one(rooms, { fields: [roomFacilities.roomId], references: [rooms.id] }),
  facility: one(facilities, { fields: [roomFacilities.facilityId], references: [facilities.id] }),
}));

export const roomPhotosRelations = relations(roomPhotos, ({ one }) => ({
  room: one(rooms, { fields: [roomPhotos.roomId], references: [rooms.id] }),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  user: one(users, { fields: [bookings.userId], references: [users.id], relationName: 'bookingUser' }),
  cancelledByUser: one(users, {
    fields: [bookings.cancelledBy],
    references: [users.id],
    relationName: 'bookingCancelledBy',
  }),
  reviewedByUser: one(users, {
    fields: [bookings.reviewedBy],
    references: [users.id],
    relationName: 'bookingReviewedBy',
  }),
  room: one(rooms, { fields: [bookings.roomId], references: [rooms.id] }),
  events: many(bookingEvents),
}));

export const bookingEventsRelations = relations(bookingEvents, ({ one }) => ({
  booking: one(bookings, { fields: [bookingEvents.bookingId], references: [bookings.id] }),
  actor: one(users, { fields: [bookingEvents.actorId], references: [users.id] }),
}));
