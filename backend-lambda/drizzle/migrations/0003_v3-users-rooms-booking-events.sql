CREATE TYPE "public"."BookingEventAction" AS ENUM('CREATED', 'UPDATED', 'APPROVED', 'REJECTED', 'CANCELLED');--> statement-breakpoint
ALTER TYPE "public"."UserRole" ADD VALUE 'LECTURER';--> statement-breakpoint
ALTER TYPE "public"."UserRole" ADD VALUE 'STAFF';--> statement-breakpoint
CREATE TABLE "BookingEvent" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL,
	"actor_id" text,
	"action" "BookingEventAction" NOT NULL,
	"note" text,
	"created_at" timestamp (3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "User" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "Booking" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "Booking" ADD COLUMN "reviewed_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "Booking" ADD COLUMN "reject_reason" text;--> statement-breakpoint
ALTER TABLE "Room" ADD COLUMN "max_hours" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "Room" ADD COLUMN "allowed_roles" text[] DEFAULT ARRAY['STUDENT', 'LECTURER']::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "cognito_sub" text;--> statement-breakpoint
ALTER TABLE "BookingEvent" ADD CONSTRAINT "BookingEvent_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."Booking"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "BookingEvent" ADD CONSTRAINT "BookingEvent_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "BookingEvent_booking_id_created_at_idx" ON "BookingEvent" USING btree ("booking_id","created_at");--> statement-breakpoint
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "User_cognito_sub_key" ON "User" USING btree ("cognito_sub");--> statement-breakpoint
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_time_valid" CHECK ("Booking"."end_time" > "Booking"."start_time");--> statement-breakpoint
ALTER TABLE "Room" ADD CONSTRAINT "Room_max_hours_check" CHECK ("Room"."max_hours" BETWEEN 1 AND 12);--> statement-breakpoint
ALTER TABLE "Room" ADD CONSTRAINT "Room_allowed_roles_check" CHECK (cardinality("Room"."allowed_roles") >= 1 AND "Room"."allowed_roles" <@ ARRAY['STUDENT', 'LECTURER', 'STAFF', 'ADMIN']::text[]);