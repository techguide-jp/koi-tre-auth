CREATE TABLE "practice_turns" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"practice_id" varchar(36) NOT NULL,
	"request_id" varchar(36) NOT NULL,
	"position" integer NOT NULL,
	"user_text" text NOT NULL,
	"assistant_text" text NOT NULL,
	"feedback" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "practice_turns_request_key" UNIQUE("practice_id","request_id"),
	CONSTRAINT "practice_turns_position_key" UNIQUE("practice_id","position")
);
--> statement-breakpoint
CREATE TABLE "practices" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"uid" varchar(255) NOT NULL,
	"scene_id" varchar(32) NOT NULL,
	"charged_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"pending_request_id" varchar(36),
	"pending_text" text,
	"pending_token" varchar(36),
	"pending_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "practice_turns" ADD CONSTRAINT "practice_turns_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practices" ADD CONSTRAINT "practices_uid_users_firebase_uid_fk" FOREIGN KEY ("uid") REFERENCES "public"."users"("firebase_uid") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "practices_uid_charged_at_idx" ON "practices" USING btree ("uid","charged_at");