import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import type { LambdaContext, LambdaEvent } from 'hono/aws-lambda';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { logger } from 'hono/logger';
import type { AuthUser } from './auth';
import { getEnv } from './env';
import { fromDbError, HttpError } from './http/errors';
import { errorResponse } from './http/response';

export type AppEnv = {
  // Present when invoked through Lambda; undefined in the local dev server
  Bindings: { event?: LambdaEvent; lambdaContext?: LambdaContext };
  // `user` is set by requireAuth() (shared/auth)
  Variables: { requestId: string; user?: AuthUser };
};

/**
 * Every Lambda function builds its Hono app from here so all of them share
 * CORS, request id, logging and the error envelope.
 */
export function createApp(basePath: `/${string}`) {
  const app = new Hono<AppEnv>().basePath(basePath);

  app.use('*', async (c, next) => {
    const requestId = c.env?.lambdaContext?.awsRequestId ?? randomUUID();
    c.set('requestId', requestId);
    await next();
    c.header('X-Request-Id', requestId);
  });
  app.use('*', logger());
  app.use(
    '*',
    cors({
      origin: (origin) => (getEnv().ALLOWED_ORIGINS.includes(origin) ? origin : null),
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Dev-User'],
      credentials: true,
    }),
  );

  app.notFound((c) => c.json(errorResponse(`Cannot ${c.req.method} ${c.req.path}`), 404));

  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json(errorResponse(err.details), err.status);
    if (err instanceof HTTPException) return c.json(errorResponse(err.message), err.status);

    const log = (level: 'warn' | 'error') =>
      console[level](
        JSON.stringify({
          requestId: c.get('requestId'),
          method: c.req.method,
          path: c.req.path,
          error: String(err),
          cause: err.cause === undefined ? undefined : String(err.cause),
          stack: err.stack,
        }),
      );

    const dbError = fromDbError(err);
    if (dbError) {
      // Bad input is the client's problem; an unreachable or slow database is ours
      log(dbError.status >= 500 ? 'error' : 'warn');
      return c.json(errorResponse(dbError.details), dbError.status);
    }

    log('error');
    return c.json(errorResponse('Internal server error'), 500);
  });

  return app;
}
