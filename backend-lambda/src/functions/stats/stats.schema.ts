import { z } from 'zod';

// YYYY-MM-DD calendar date; any day inside the target week (Bangkok)
const weekDate = z.string().refine(
  (s) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const year = Number(s.slice(0, 4));
    const month = Number(s.slice(5, 7));
    const day = Number(s.slice(8, 10));
    const d = new Date(Date.UTC(year, month - 1, day));
    return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month && d.getUTCDate() === day;
  },
  { message: 'Must be a date in YYYY-MM-DD format' },
);

export const weeklyQuery = z.object({
  week: weekDate,
});

export type WeeklyQuery = z.infer<typeof weeklyQuery>;
