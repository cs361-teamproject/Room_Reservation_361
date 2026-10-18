import { getDb } from '../../src/shared/db/client';
import { runSeed } from '../../src/shared/db/seed';

await runSeed(getDb());
console.log('Seed complete. Users: 6709616541, 6709000002 (STUDENT), lecturer, staff, admin. Passwords are in Cognito.');
process.exit(0);
