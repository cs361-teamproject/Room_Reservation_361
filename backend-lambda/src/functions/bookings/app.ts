import { requireAuth, requireRole } from '../../shared/auth';
import { createApp } from '../../shared/create-app';
import { successResponse } from '../../shared/http/response';
import { validate } from '../../shared/http/validate';
import { createBookingBody, idParam, listQuery, manageQuery, rejectBody } from './bookings.schema';
import { bookingsService as service } from './bookings.service';

export const app = createApp('/api/bookings');

app.get('/', validate('query', listQuery), async (c) => {
  return c.json(successResponse(await service.list(c.req.valid('query')), 'Bookings retrieved successfully'));
});

// Staff queue before /:id would shadow nothing here, but keep literal paths first by convention
app.get('/manage', requireAuth(), requireRole('STAFF', 'ADMIN'), validate('query', manageQuery), async (c) => {
  return c.json(successResponse(await service.manage(c.req.valid('query')), 'Bookings retrieved successfully'));
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
