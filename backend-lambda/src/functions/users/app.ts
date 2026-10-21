import { and, asc, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../shared/auth';
import { createApp } from '../../shared/create-app';
import { getDb } from '../../shared/db/client';
import { USER_ROLES, users } from '../../shared/db/schema';
import { successResponse } from '../../shared/http/response';
import { validate } from '../../shared/http/validate';

export const app = createApp('/api/users');

app.get('/me', requireAuth(), (c) => {
  const user = c.get('user')!;
  return c.json(
    successResponse(
      { id: user.id, username: user.username, display_name: user.displayName, role: user.role },
      'User retrieved successfully',
    ),
  );
});

const listQuery = z.object({
  role: z
    .string()
    .optional()
    .transform((s) => s?.split(',').map((r) => r.trim()))
    .pipe(z.array(z.enum(USER_ROLES, { error: 'Must be one of STUDENT, LECTURER, STAFF, ADMIN' })).optional()),
});

// Who staff can book a room for (e.g. ?role=LECTURER); STAFF and ADMIN only
app.get('/', requireAuth(), requireRole('STAFF', 'ADMIN'), validate('query', listQuery), async (c) => {
  const { role } = c.req.valid('query');
  const rows = await getDb()
    .select({ id: users.id, username: users.username, display_name: users.displayName, role: users.role })
    .from(users)
    .where(and(isNull(users.deletedAt), role ? inArray(users.role, role) : undefined))
    .orderBy(asc(users.displayName));
  return c.json(successResponse(rows, 'Users retrieved successfully'));
});

