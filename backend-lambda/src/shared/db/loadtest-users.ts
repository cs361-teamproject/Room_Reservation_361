// Load-test accounts for CS361 V3 Project 3 (loadtest/locustfile.py).
// Usernames must match the Cognito users made by loadtest/cognito-users.sh; passwords live only in Cognito.
// 6709616541 (existing demo student) is also used by the load test but belongs to the seed, so it is never deleted here.
import { and, count, eq, inArray, isNull, like, notExists, notLike, or } from 'drizzle-orm';
import type { Db } from './client';
import { bookingEvents, bookings, users } from './schema';

export const LOADTEST_USERS = [
  { username: '6709900001', role: 'STUDENT', displayName: 'Bravery Jane' },
  { username: '6709900002', role: 'STUDENT', displayName: 'Peter Griffin' },
  { username: 'claude.sandisk', role: 'LECTURER', displayName: 'Claude Sandisk' },
  { username: 'paul.smith', role: 'LECTURER', displayName: 'Paul Smith' },
  { username: '6709900003', role: 'STUDENT', displayName: 'Lara Croft' },
  { username: '6709900004', role: 'STUDENT', displayName: 'Lemon James' },
  { username: '6709900005', role: 'STUDENT', displayName: 'Harry Toddler' },
  { username: '6709900006', role: 'STUDENT', displayName: 'Steve Bob' },
  { username: 'mick.ankinson', role: 'LECTURER', displayName: 'Mick Ankinson' },
  { username: 'amazon.webservice', role: 'LECTURER', displayName: 'Amazon Webservice' },
] as const;

/** Every booking the load test creates starts with this (see TITLE_PREFIX in locustfile.py) */
const LOADTEST_TITLE = '[LOADTEST]%';
const usernames = LOADTEST_USERS.map((u) => u.username);
const isTestBooking = like(bookings.title, LOADTEST_TITLE);
const isRealBooking = or(isNull(bookings.title), notLike(bookings.title, LOADTEST_TITLE));

/** Idempotent: adds the accounts, leaves existing rows alone */
export async function runLoadtestUsersSetup(db: Db) {
  const inserted = await db
    .insert(users)
    .values([...LOADTEST_USERS])
    .onConflictDoNothing({ target: users.username })
    .returning({ username: users.username });
  return { inserted: inserted.map((u) => u.username), accounts: usernames };
}

/**
 * Removes [LOADTEST] bookings (any user; their events cascade) and then the accounts above.
 * An account still referenced by a real booking or event is kept and listed in `kept`.
 * dryRun: only counts, deletes nothing.
 */
export async function runLoadtestCleanup(db: Db, dryRun: boolean) {
  if (dryRun) {
    const accountIds = db.select({ id: users.id }).from(users).where(inArray(users.username, usernames));
    const [b] = await db.select({ n: count() }).from(bookings).where(isTestBooking);
    const [u] = await db.select({ n: count() }).from(users).where(inArray(users.username, usernames));
    const [real] = await db
      .select({ n: count() })
      .from(bookings)
      .where(
        and(
          isRealBooking,
          or(inArray(bookings.userId, accountIds), inArray(bookings.bookedForUserId, accountIds), inArray(bookings.reviewedBy, accountIds)),
        ),
      );
    return { dryRun: true, bookingsToDelete: b.n, accountsFound: u.n, realBookingsBlockingAccounts: real.n };
  }

  return db.transaction(async (tx) => {
    const deletedBookings = await tx.delete(bookings).where(isTestBooking).returning({ id: bookings.id });
    const referencedBy = (col: typeof bookings.userId | typeof bookings.bookedForUserId | typeof bookings.reviewedBy) => tx.select().from(bookings).where(eq(col, users.id));
    const deletedUsers = await tx
      .delete(users)
      .where(
        and(
          inArray(users.username, usernames),
          notExists(referencedBy(bookings.userId)),
          notExists(referencedBy(bookings.bookedForUserId)),
          notExists(referencedBy(bookings.reviewedBy)),
          notExists(tx.select().from(bookingEvents).where(eq(bookingEvents.actorId, users.id))),
        ),
      )
      .returning({ username: users.username });
    const kept = usernames.filter((n) => !deletedUsers.some((u) => u.username === n));
    return { dryRun: false, deletedBookings: deletedBookings.length, deletedUsers: deletedUsers.map((u) => u.username), kept };
  });
}
