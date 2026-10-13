import { requireAuth, requireRole } from '../../shared/auth';
import { createApp } from '../../shared/create-app';
import { successResponse } from '../../shared/http/response';
import { validate } from '../../shared/http/validate';
import { createFacilityBody, idParam, updateFacilityBody } from './facilities.schema';
import { facilitiesService as service } from './facilities.service';

export const app = createApp('/api/facilities');

app.get('/', async (c) => {
  return c.json(successResponse(await service.list(), 'Facilities retrieved successfully'));
});

app.get('/:id', validate('param', idParam), async (c) => {
  const { id } = c.req.valid('param');
  return c.json(successResponse(await service.get(id), 'Facility retrieved successfully'));
});

app.post('/', requireAuth(), requireRole('ADMIN'), validate('json', createFacilityBody), async (c) => {
  const facility = await service.create(c.req.valid('json'));
  return c.json(successResponse(facility, 'Facility created successfully'), 201);
});

app.patch('/:id', requireAuth(), requireRole('ADMIN'), validate('param', idParam), validate('json', updateFacilityBody), async (c) => {
  const { id } = c.req.valid('param');
  const facility = await service.update(id, c.req.valid('json'));
  return c.json(successResponse(facility, 'Facility updated successfully'));
});

app.delete('/:id', requireAuth(), requireRole('ADMIN'), validate('param', idParam), async (c) => {
  const { id } = c.req.valid('param');
  return c.json(successResponse(await service.remove(id), 'Facility deleted successfully'));
});
