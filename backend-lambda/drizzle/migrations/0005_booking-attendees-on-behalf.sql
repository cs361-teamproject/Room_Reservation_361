ALTER TABLE "Room" ALTER COLUMN "seat_capacity" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "Booking" ADD COLUMN "attendee_count" integer;--> statement-breakpoint
ALTER TABLE "Booking" ADD COLUMN "purpose" text;--> statement-breakpoint
ALTER TABLE "Booking" ADD COLUMN "booked_for_user_id" text;--> statement-breakpoint
ALTER TABLE "Booking" ADD COLUMN "equipment_request" text;--> statement-breakpoint
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_booked_for_user_id_fkey" FOREIGN KEY ("booked_for_user_id") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_attendee_count_check" CHECK ("Booking"."attendee_count" IS NULL OR "Booking"."attendee_count" > 0);