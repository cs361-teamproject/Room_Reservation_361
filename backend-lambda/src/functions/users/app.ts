import { requireAuth } from '../../shared/auth';
import { createApp } from '../../shared/create-app';
import { successResponse } from '../../shared/http/response';

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
