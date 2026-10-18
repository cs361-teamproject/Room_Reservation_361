import { requireAuth, requireRole } from '../../shared/auth';
import { createApp } from '../../shared/create-app';
import { successResponse } from '../../shared/http/response';
import { validate } from '../../shared/http/validate';
import {
  cancelBookingBody,
  createBookingBody,
  idParam,
  listQuery,
  manageQuery,
  mineQuery,
  rejectBody,
  updateBookingBody,
} from './bookings.schema';
import { bookingsService as service } from './bookings.service';

export const app = createApp('/api/bookings');

app.get('/', validate('query', listQuery), async (c) => {
  return c.json(successResponse(await service.list(c.req.valid('query')), 'Bookings retrieved successfully'));
});

// IMPORTANT: literal paths (/manage, /mine) must be declared BEFORE /:id, or Hono will treat them as an id
app.get('/manage', requireAuth(), requireRole('STAFF', 'ADMIN'), validate('query', manageQuery), async (c) => {
  return c.json(successResponse(await service.manage(c.req.valid('query')), 'Bookings retrieved successfully'));
});

app.get('/mine', requireAuth(), validate('query', mineQuery), async (c) => {
  const user = c.get('user')!;
  const data = await service.getMine(user, c.req.valid('query'));
  return c.json(successResponse(data, 'My bookings retrieved successfully'));
});

app.get('/:id', requireAuth(), async (c) => {
  const user = c.get('user')!;
  const bookingId = c.req.param('id');
  const data = await service.getById(user, bookingId);
  return c.json(successResponse(data, 'Booking retrieved successfully'));
});

app.get('/:id/events', requireAuth(), async (c) => {
  const user = c.get('user')!;
  const bookingId = c.req.param('id');
  const data = await service.getEvents(user, bookingId);
  return c.json(successResponse(data, 'Booking events retrieved successfully'));
});

app.post('/', requireAuth(), requireRole('STUDENT', 'LECTURER'), validate('json', createBookingBody), async (c) => {
  // requireAuth() guarantees the user is set
  const booking = await service.create(c.get('user')!, c.req.valid('json'));
  return c.json(successResponse(booking, 'Booking created successfully'), 201);
});

// STAFF-only decisions: ADMIN calling these gets 403 per T8, manage stays STAFF+ADMIN
app.post(
  '/:id/approve',
  requireAuth(),
  requireRole('STAFF'),
  validate('param', idParam),
  async (c) => {
    const booking = await service.approve(c.get('user')!, c.req.valid('param').id);
    return c.json(successResponse(booking, 'Booking approved successfully'));
  },
);

app.post(
  '/:id/reject',
  requireAuth(),
  requireRole('STAFF'),
  validate('param', idParam),
  validate('json', rejectBody),
  async (c) => {
    const booking = await service.reject(c.get('user')!, c.req.valid('param').id, c.req.valid('json').reason);
    return c.json(successResponse(booking, 'Booking rejected successfully'));
  },
);

app.patch('/:id', requireAuth(), validate('json', updateBookingBody), async (c) => {
  const user = c.get('user')!;
  const bookingId = c.req.param('id');
  const data = await service.update(user, bookingId, c.req.valid('json'));
  return c.json(successResponse(data, 'Booking updated successfully'));
});

app.post('/:id/cancel', requireAuth(), validate('json', cancelBookingBody), async (c) => {
  const user = c.get('user')!;
  const bookingId = c.req.param('id');
  const data = await service.cancel(user, bookingId, c.req.valid('json'));
  return c.json(successResponse(data, 'Booking cancelled successfully'));
});
