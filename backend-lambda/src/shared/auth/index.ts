import { setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { and, eq, isNull } from 'drizzle-orm';
import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../create-app';
import { getDb } from '../db/client';
import { type UserRole, users } from '../db/schema';
import { getEnv } from '../env';
import { forbidden, HttpError, unauthorized } from '../http/errors';

export interface AuthUser {
  id: string;
  /** Student/staff ID, equal to the Cognito username */
  username: string;
  role: UserRole;
  displayName: string | null;
}

let verifier: ReturnType<typeof CognitoJwtVerifier.create<{ userPoolId: string; tokenUse: 'id'; clientId: string }>> | undefined;

/** Checks Cognito ID tokens ourselves; only used where no API Gateway authorizer did it already */
function idTokenVerifier() {
  const { COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID } = getEnv();
  if (!COGNITO_USER_POOL_ID || !COGNITO_CLIENT_ID) {
    throw unauthorized('Bearer tokens need COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID in the env');
  }
  if (!verifier) {
    // The JWKS lives in us-east-1. Node tries each address for only 250 ms before moving on, which
    // is shorter than a TCP connect from Thailand, so every attempt timed out. Allow 2 s each.
    setDefaultAutoSelectFamilyAttemptTimeout(2000);
  }
  verifier ??= CognitoJwtVerifier.create({ userPoolId: COGNITO_USER_POOL_ID, tokenUse: 'id', clientId: COGNITO_CLIENT_ID });
  return verifier;
}

/**
 * Who is calling, as a username, or undefined when nobody is logged in. In order:
 * 1. On AWS, API Gateway's Cognito authorizer verifies the token before the Lambda runs
 *    and passes the claims in `event.requestContext.authorizer.claims`.
 * 2. STAGE=local has no API Gateway, so a `Bearer <ID token>` is verified here (signature,
 *    expiry, user pool and app client) — the frontend's real login works against `npm run dev`.
 * 3. STAGE=local also accepts `X-Dev-User: <username>` for curl and tests.
 * Neither 2 nor 3 is looked at on any other stage.
 */
async function callerUsername(c: Context<AppEnv>): Promise<string | undefined> {
  const requestContext = c.env?.event?.requestContext;
  if (requestContext && 'authorizer' in requestContext) {
    const { claims } = requestContext.authorizer as { claims?: Record<string, string> };
    const username = claims?.['cognito:username'];
    if (username) return username;
  }

  if (getEnv().STAGE !== 'local') return undefined;

  const bearer = c.req.header('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer) {
    try {
      const claims = await idTokenVerifier().verify(bearer);
      return String(claims['cognito:username']);
    } catch (err) {
      if (err instanceof HttpError) throw err; // missing Cognito config, from idTokenVerifier()
      throw unauthorized('Invalid or expired token');
    }
  }
  return c.req.header('X-Dev-User') || undefined;
}

/** 401 without a login, 403 when the login has no active row in User. Sets `c.var.user`. */
export const requireAuth = () =>
  createMiddleware<AppEnv>(async (c, next) => {
    const username = await callerUsername(c);
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
