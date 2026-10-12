import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getEnv } from '../env';
import * as relations from './relations';
import * as tables from './schema';

export const schema = { ...tables, ...relations };

const createDb = (sql: postgres.Sql) => drizzle(sql, { schema });

export type Db = ReturnType<typeof createDb>;
/** The `tx` handed to `db.transaction(async (tx) => ...)` */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

let db: Db | undefined;

// Below the 15s Lambda timeout, so a stuck query fails with a 503 instead of API Gateway's bare 502/504
const STATEMENT_TIMEOUT_MS = 10_000;

/**
 * One connection per Lambda container, created outside the handler so warm
 * invocations reuse it. Use `?sslmode=require` in DATABASE_URL for RDS.
 * Migrations open their own connection (shared/db/migrate.ts), so this timeout does not limit them.
 */
export function getDb(): Db {
  if (!db) {
    const sql = postgres(getEnv().DATABASE_URL, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      connection: { statement_timeout: STATEMENT_TIMEOUT_MS },
    });
    db = createDb(sql);
  }
  return db;
}
