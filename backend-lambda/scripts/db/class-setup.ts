// npm run db:class-setup  /  npm run db:class-reset  (local database)
import { getDb } from '../../src/shared/db/client';
import { runClassReset, runClassSetup } from '../../src/shared/db/class-setup';

const result = process.argv.includes('--reset') ? await runClassReset(getDb()) : await runClassSetup(getDb());
console.log(JSON.stringify(result));
process.exit(0);
