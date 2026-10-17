import { z } from 'zod';

const BOOKING_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;

// Validates YYYY-MM-DD and rejects non-existent dates like 2026-02-30.
// (Lambda runs TZ=UTC; local dev may run TZ=Asia/Bangkok).
const dateString = z.string().refine(
  (s) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const year = Number(s.slice(0, 4));
    const month = Number(s.slice(5, 7)); // 1-12
    const day = Number(s.slice(8, 10));
    // Construct via UTC to avoid DST/TZ shifts, then verify components didn't overflow
    const d = new Date(Date.UTC(year, month - 1, day));
    return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month && d.getUTCDate() === day;
  },
  { message: 'Must be a date in YYYY-MM-DD format' },
);

// CSV helper for status — splits, trims, validates each value
function csvStatus() {
  return z.preprocess(
    (val) =>
      typeof val === 'string' ? val.split(',').map((v) => v.trim()) : val,
    z.array(
      z.enum(BOOKING_STATUSES, {
        error: 'Must be one of PENDING, APPROVED, REJECTED, CANCELLED',
      }),
    ),
  );
}

export const listQuery = z
  .object({
    from: z.string({ error: 'Required' }).pipe(dateString),
    to: z.string({ error: 'Required' }).pipe(dateString),
    room_id: z.string().optional(),
    status: csvStatus().default(['PENDING', 'APPROVED']),
  })
  .superRefine((data, ctx) => {
    // Both dates must be valid before comparing
    if (!data.from || !data.to) return;

    const fromMs = new Date(`${data.from}T00:00:00+07:00`).getTime();
    const toMs = new Date(`${data.to}T00:00:00+07:00`).getTime();

    if (toMs < fromMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Must be on or after from',
        path: ['to'],
      });
      return;
    }

    // Inclusive day count: to - from in days
    const diffDays = (toMs - fromMs) / (1000 * 60 * 60 * 24);
    if (diffDays > 31) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Range must not exceed 31 days',
        path: ['to'],
      });
    }
  });

export type ListQuery = z.infer<typeof listQuery>;

// ISO 8601 with an offset (Z or +07:00), so the instant is unambiguous whatever TZ the Lambda runs in
const isoDateTime = z.iso.datetime({ offset: true, error: 'Must be an ISO 8601 datetime with offset, e.g. 2026-10-20T14:00:00+07:00' });

export const createBookingBody = z.object({
  room_id: z.string({ error: 'Required' }).min(1, 'Required'),
  start_time: isoDateTime,
  end_time: isoDateTime,
  title: z.string().trim().min(1, 'Must not be empty').max(200, 'Must be at most 200 characters').optional(),
});

export type CreateBookingBody = z.infer<typeof createBookingBody>;

// GET /mine query parameters
const SCOPES = ['upcoming', 'past', 'all'] as const;

export const mineQuery = z
  .object({
    scope: z.enum(SCOPES, { error: 'Must be one of upcoming, past, all' }).default('upcoming'),
    status: csvStatus().optional(),
    page: z.coerce.number().int().min(1, 'Must be at least 1').default(1),
    limit: z.coerce.number().int().min(1, 'Must be at least 1').max(50, 'Must not exceed 50').default(10),
  });

export type MineQuery = z.infer<typeof mineQuery>;

// PATCH /:id - Update booking times
export const updateBookingBody = z.object({
  start_time: isoDateTime,
  end_time: isoDateTime,
});

export type UpdateBookingBody = z.infer<typeof updateBookingBody>;

// POST /:id/cancel - Cancel booking
export const cancelBookingBody = z.object({
  reason: z.string().trim().max(500, 'Must be at most 500 characters').optional(),
});

export type CancelBookingBody = z.infer<typeof cancelBookingBody>;
