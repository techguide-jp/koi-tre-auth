CREATE TABLE "practice_tip_ratings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "practice_tip_ratings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"uid" varchar(255) NOT NULL,
	"tip_id" varchar(16) NOT NULL,
	"value" varchar(16) NOT NULL,
	"rated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "practices" ADD COLUMN "tip_id" varchar(16);--> statement-breakpoint
ALTER TABLE "practices" ADD COLUMN "tip_shown_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "practice_tip_ratings" ADD CONSTRAINT "practice_tip_ratings_uid_users_firebase_uid_fk" FOREIGN KEY ("uid") REFERENCES "public"."users"("firebase_uid") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "practice_tip_ratings_uid_tip_date_idx" ON "practice_tip_ratings" USING btree ("uid","tip_id","rated_at");