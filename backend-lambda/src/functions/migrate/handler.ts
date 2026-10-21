import { fileURLToPath } from 'node:url';
import { getDb } from '../../shared/db/client';
import { runMigrations } from '../../shared/db/migrate';
import { runClassReset, runClassSetup } from '../../shared/db/class-setup';
import { runSeed } from '../../shared/db/seed';
import { getEnv } from '../../shared/env';

// build.mjs copies drizzle/migrations next to the bundled index.mjs
const migrationsFolder = fileURLToPath(new URL('./migrations', import.meta.url));

/**
 * Not behind API Gateway. Migrations only:
 *   aws lambda invoke --function-name roomres-migrate-dev --payload '{}' out.json
 * Migrations then sample data:
 *   aws lambda invoke --function-name roomres-migrate-dev --payload '{"seed": true}' out.json
 */
export const handler = async (event?: { seed?: boolean; classSetup?: boolean; classReset?: boolean }) => {
  const result = await runMigrations(getEnv().DATABASE_URL, migrationsFolder);
  const seed = event?.seed === true ? await runSeed(getDb()) : undefined;
  // CS361 in-class test data: {"classSetup": true} adds it, {"classReset": true} goes back to the baseline
  const classData = event?.classReset ? await runClassReset(getDb()) : event?.classSetup ? await runClassSetup(getDb()) : undefined;
  const summary = { ...result, seeded: seed !== undefined, ...seed, ...(classData && { classData }) };
  console.log(JSON.stringify(summary));
  return summary;
};
