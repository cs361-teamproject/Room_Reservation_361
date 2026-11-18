import { fileURLToPath } from 'node:url';
import { getDb } from '../../shared/db/client';
import { runMigrations } from '../../shared/db/migrate';
import { runClassReset, runClassSetup } from '../../shared/db/class-setup';
import { runLoadtestCleanup, runLoadtestUsersSetup } from '../../shared/db/loadtest-users';
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
export const handler = async (event?: {
  seed?: boolean;
  classSetup?: boolean;
  classReset?: boolean;
  loadtestUsers?: boolean;
  loadtestCleanup?: boolean;
  dryRun?: boolean;
}) => {
  const result = await runMigrations(getEnv().DATABASE_URL, migrationsFolder);
  const seed = event?.seed === true ? await runSeed(getDb()) : undefined;
  // CS361 in-class test data: {"classSetup": true} adds it, {"classReset": true} goes back to the baseline
  const classData = event?.classReset ? await runClassReset(getDb()) : event?.classSetup ? await runClassSetup(getDb()) : undefined;
  // Load-test accounts: {"loadtestUsers": true} adds them; {"loadtestCleanup": true, "dryRun": true} counts first.
  // Cleanup deletes for real only when dryRun is exactly false, so a forgotten flag never deletes.
  const loadtest = event?.loadtestUsers
    ? await runLoadtestUsersSetup(getDb())
    : event?.loadtestCleanup
      ? await runLoadtestCleanup(getDb(), event.dryRun !== false)
      : undefined;
  const summary = { ...result, seeded: seed !== undefined, ...seed, ...(classData && { classData }), ...(loadtest && { loadtest }) };
  console.log(JSON.stringify(summary));
  return summary;
};
