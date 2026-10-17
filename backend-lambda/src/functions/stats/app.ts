import { requireAuth, requireRole } from '../../shared/auth';
import { createApp } from '../../shared/create-app';
import { successResponse } from '../../shared/http/response';
import { validate } from '../../shared/http/validate';
import { weeklyQuery } from './stats.schema';
import { statsService as service } from './stats.service';

export const app = createApp('/api/stats');

app.get('/weekly', requireAuth(), requireRole('ADMIN'), validate('query', weeklyQuery), async (c) => {
  return c.json(successResponse(await service.weekly(c.req.valid('query')), 'Weekly stats retrieved successfully'));
});
