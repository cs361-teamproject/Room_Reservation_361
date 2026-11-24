-- Check-in / no-show (FR8). Additive only.
-- NO_SHOW frees the slot: booking_no_overlap (0004) only covers PENDING and APPROVED.
ALTER TYPE "public"."BookingEventAction" ADD VALUE 'CHECKED_IN';--> statement-breakpoint
ALTER TYPE "public"."BookingEventAction" ADD VALUE 'NO_SHOW';--> statement-breakpoint
ALTER TYPE "public"."BookingStatus" ADD VALUE 'NO_SHOW';--> statement-breakpoint
ALTER TABLE "Booking" ADD COLUMN "checked_in_at" timestamp (3) with time zone;--> statement-breakpoint
-- Existing bookings were made before check-in existed: exempt (false). New ones need it (default true).
ALTER TABLE "Booking" ADD COLUMN "requires_check_in" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "Booking" ALTER COLUMN "requires_check_in" SET DEFAULT true;
