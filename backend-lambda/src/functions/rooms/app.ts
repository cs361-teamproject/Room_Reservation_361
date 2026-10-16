import { requireAuth, requireRole } from '../../shared/auth';
import { createApp } from '../../shared/create-app';
import { validate } from '../../shared/http/validate';
import { successResponse } from '../../shared/http/response';
import { createRoomBody, idParam, listQuery, roomRulesBody, updateRoomBody } from './rooms.schema';
import { roomsService as service } from './rooms.service';

export const app = createApp('/api/rooms');

app.get('/', validate('query', listQuery), async (c) => {
  return c.json(successResponse(await service.list(c.req.valid('query')), 'Rooms retrieved successfully'));
});

app.get('/:id', validate('param', idParam), async (c) => {
  const { id } = c.req.valid('param');
  return c.json(successResponse(await service.get(id), 'Room retrieved successfully'));
});

// Literal sub-path before /:id so Hono never treats "rules" as an id
app.put(
  '/:id/rules',
  requireAuth(),
  requireRole('ADMIN'),
  validate('param', idParam),
  validate('json', roomRulesBody),
  async (c) => {
    const room = await service.updateRules(c.req.valid('param').id, c.req.valid('json'));
    return c.json(successResponse(room, 'Room rules updated successfully'));
  },
);

app.post('/', requireAuth(), requireRole('STAFF', 'ADMIN'), validate('json', createRoomBody), async (c) => {
  return c.json(successResponse(await service.create(c.req.valid('json')), 'Room created successfully'), 201);
});

app.patch(
  '/:id',
  requireAuth(),
  requireRole('STAFF', 'ADMIN'),
  validate('param', idParam),
  validate('json', updateRoomBody),
  async (c) => {
    const room = await service.update(c.req.valid('param').id, c.req.valid('json'));
    return c.json(successResponse(room, 'Room updated successfully'));
  },
);

app.delete('/:id', requireAuth(), requireRole('STAFF', 'ADMIN'), validate('param', idParam), async (c) => {
  return c.json(successResponse(await service.remove(c.req.valid('param').id), 'Room deleted successfully'));
});
