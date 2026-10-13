import type { ContentfulStatusCode } from 'hono/utils/http-status';

export class HttpError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly details: string | string[],
  ) {
    super(Array.isArray(details) ? details.join(', ') : details);
  }
}

export const badRequest = (message: string | string[]) => new HttpError(400, message);
export const unauthorized = (message = 'Login required') => new HttpError(401, message);
export const forbidden = (message = 'You do not have permission to do this') => new HttpError(403, message);
export const notFound = (message: string) => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);
export const serviceUnavailable = (message: string) => new HttpError(503, message);

/** The fields of a postgres-js PostgresError that we read. */
interface PgError {
  code: string;
  detail?: string;
  column_name?: string;
  constraint_name?: string;
}

// postgres-js sets these codes when it cannot reach or loses the database
const CONNECTION_ERRORS = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'ETIMEDOUT',
  'CONNECT_TIMEOUT',
  'CONNECTION_CLOSED',
  'CONNECTION_ENDED',
  'CONNECTION_DESTROYED',
]);

/** Drizzle wraps driver errors in DrizzleQueryError, so the Postgres error sits somewhere in the cause chain. */
function findDbError(err: unknown): PgError | undefined {
  for (let e = err, depth = 0; e && depth < 5; e = (e as { cause?: unknown }).cause, depth++) {
    if (typeof e === 'object' && 'code' in e && typeof e.code === 'string') return e as PgError;
  }
  return undefined;
}

/** "Key (room_id, facility_id)=(a, b) already exists." -> "room_id, facility_id" */
const keyColumns = (detail?: string) => detail?.match(/^Key \(([^)]+)\)=/)?.[1];

/**
 * Turns a database error into a response the client can act on, or undefined when it is a bug.
 * Messages name the offending column but never echo SQL or values.
 */
export function fromDbError(err: unknown): HttpError | undefined {
  const pg = findDbError(err);
  if (!pg) return undefined;
  const columns = keyColumns(pg.detail);

  switch (pg.code) {
    case '23505': // unique_violation
      return conflict(columns ? `A record with this ${columns} already exists` : 'Resource already exists');
    case '23503': // foreign_key_violation
      return pg.detail?.includes('is still referenced')
        ? conflict('Cannot delete or change this record because other records still use it')
        : badRequest(columns ? `${columns} refers to a record that does not exist` : 'A referenced record does not exist');
    case '23502': // not_null_violation
      return badRequest(pg.column_name ? `${pg.column_name} is required` : 'A required field is missing');
    case '23P01': // exclusion_violation, only booking_no_overlap today
      return conflict('ช่วงเวลานี้มีการจองแล้ว');
    case '23514': // check_violation
      return badRequest('A value is outside the allowed range');
    case '22P02': // invalid_text_representation, e.g. an unknown enum value
      return badRequest('A value has an invalid format');
    case '22001': // string_data_right_truncation
      return badRequest('A value is too long');
    case '22003': // numeric_value_out_of_range
      return badRequest('A number is out of range');
    case '22007': // invalid_datetime_format
    case '22008': // datetime_field_overflow
      return badRequest('A date or time is invalid');
    case '40001': // serialization_failure
    case '40P01': // deadlock_detected
      return conflict('The request clashed with another request. Please try again');
    case '57014': // query_canceled, raised by statement_timeout
      return serviceUnavailable('The database took too long to respond. Please try again');
    case '53300': // too_many_connections
      return serviceUnavailable('The database is busy. Please try again shortly');
  }
  if (CONNECTION_ERRORS.has(pg.code)) {
    return serviceUnavailable('The database is unavailable. Please try again shortly');
  }
  return undefined;
}
