import { requireAuth, requireRole } from '../../shared/auth';
import { createApp } from '../../shared/create-app';
import { successResponse } from '../../shared/http/response';
import { validate } from '../../shared/http/validate';
import { createBookingBody, listQuery } from './bookings.schema';
import { bookingsService as service } from './bookings.service';

export const app = createApp('/api/bookings');

app.get('/', validate('query', listQuery), async (c) => {
  return c.json(successResponse(await service.list(c.req.valid('query')), 'Bookings retrieved successfully'));
});

app.post('/', requireAuth(), requireRole('STUDENT', 'LECTURER'), validate('json', createBookingBody), async (c) => {
  // requireAuth() guarantees the user is set
  const booking = await service.create(c.get('user')!, c.req.valid('json'));
  return c.json(successResponse(booking, 'Booking created successfully'), 201);
});
