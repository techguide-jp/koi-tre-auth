ALTER TABLE "practice_turns" ADD COLUMN "presentation" jsonb;--> statement-breakpoint
ALTER TABLE "practices" ADD COLUMN "adventure" jsonb;--> statement-breakpoint
ALTER TABLE "practices" ADD COLUMN "reward" jsonb;--> statement-breakpoint
ALTER TABLE "practices" ADD COLUMN "favorite_turn" integer;--> statement-breakpoint
ALTER TABLE "practices" ADD COLUMN "rehearsal" jsonb;