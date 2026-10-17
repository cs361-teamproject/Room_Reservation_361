import { requireAuth, requireRole } from '../../shared/auth';
import { createApp } from '../../shared/create-app';
import { successResponse } from '../../shared/http/response';
import { validate } from '../../shared/http/validate';
import { cancelBookingBody, createBookingBody, listQuery, mineQuery, updateBookingBody } from './bookings.schema';
import { bookingsService as service } from './bookings.service';

export const app = createApp('/api/bookings');

app.get('/', validate('query', listQuery), async (c) => {
  return c.json(successResponse(await service.list(c.req.valid('query')), 'Bookings retrieved successfully'));
});

// IMPORTANT: /mine must be declared BEFORE /:id, or Hono will treat 'mine' as an id
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
