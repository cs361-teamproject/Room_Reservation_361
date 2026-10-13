import { and, eq, isNull } from 'drizzle-orm';
import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../create-app';
import { getDb } from '../db/client';
import { type UserRole, users } from '../db/schema';
import { getEnv } from '../env';
import { forbidden, unauthorized } from '../http/errors';

export interface AuthUser {
  id: string;
  /** Student/staff ID, equal to the Cognito username */
  username: string;
  role: UserRole;
  displayName: string | null;
}

/**
 * Who is calling, as a username, or undefined when nobody is logged in.
 *
 * On AWS, API Gateway's Cognito authorizer verifies the token before the Lambda runs
 * and passes the claims in `event.requestContext.authorizer.claims` (T2 reads them here).
 * The local dev server has no API Gateway, so with STAGE=local the `X-Dev-User: <username>`
 * header stands in for a login. It is ignored on every other stage.
 */
function callerUsername(c: Context<AppEnv>): string | undefined {
  const requestContext = c.env?.event?.requestContext;
  if (requestContext && 'authorizer' in requestContext) {
    const { claims } = requestContext.authorizer as { claims?: Record<string, string> };
    const username = claims?.['cognito:username'];
    if (username) return username;
  }

  if (getEnv().STAGE === 'local') return c.req.header('X-Dev-User') || undefined;
  return undefined;
}

/** 401 without a login, 403 when the login has no active row in User. Sets `c.var.user`. */
export const requireAuth = () =>
  createMiddleware<AppEnv>(async (c, next) => {
    const username = callerUsername(c);
    if (!username) throw unauthorized();

    const [user] = await getDb()
      .select({ id: users.id, username: users.username, role: users.role, displayName: users.displayName })
      .from(users)
      .where(and(eq(users.username, username), isNull(users.deletedAt)))
      .limit(1);
    if (!user) throw forbidden('This account is not registered in the system');

    c.set('user', user);
    await next();
  });

/** Use after requireAuth(): 403 unless the caller has one of the roles. */
export const requireRole = (...roles: UserRole[]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get('user');
    if (!user) throw unauthorized();
    if (!roles.includes(user.role)) throw forbidden();
    await next();
  });
