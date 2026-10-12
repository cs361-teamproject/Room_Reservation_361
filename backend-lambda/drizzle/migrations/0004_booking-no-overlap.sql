-- Drizzle cannot express EXCLUDE constraints, so this one is kept by hand.
-- Two PENDING/APPROVED bookings of the same room may not overlap; REJECTED and CANCELLED free the slot.
-- '[)' makes back-to-back bookings (10:00-11:00 then 11:00-12:00) legal.
-- Inserts that violate it fail with SQLSTATE 23P01, mapped to 409 in src/shared/http/errors.ts.
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "Booking" ADD CONSTRAINT "booking_no_overlap"
  EXCLUDE USING gist ("room_id" WITH =, tstzrange("start_time", "end_time", '[)') WITH &&)
  WHERE ("status" IN ('PENDING', 'APPROVED'));
