CREATE TABLE "character_relationships" (
	"id" varchar(320) PRIMARY KEY NOT NULL,
	"uid" varchar(255) NOT NULL,
	"character_id" varchar(32) NOT NULL,
	"version" integer NOT NULL,
	"earned" integer DEFAULT 0 NOT NULL,
	"strain" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "character_relationships_uid_character_key" UNIQUE("uid","character_id")
);
--> statement-breakpoint
CREATE TABLE "episode_achievements" (
	"id" varchar(380) PRIMARY KEY NOT NULL,
	"uid" varchar(255) NOT NULL,
	"character_id" varchar(32) NOT NULL,
	"episode_id" varchar(64) NOT NULL,
	"version" integer NOT NULL,
	"best_score_tenths" integer,
	"best_passing_score_tenths" integer,
	"contribution" integer DEFAULT 0 NOT NULL,
	"cleared_at" timestamp with time zone,
	CONSTRAINT "episode_achievements_uid_character_episode_key" UNIQUE("uid","character_id","episode_id")
);
--> statement-breakpoint
CREATE TABLE "practice_evaluations" (
	"practice_id" varchar(36) PRIMARY KEY NOT NULL,
	"uid" varchar(255) NOT NULL,
	"character_id" varchar(32) NOT NULL,
	"version" integer NOT NULL,
	"result" jsonb NOT NULL,
	"settled_at" timestamp with time zone,
	"pending_token" varchar(36),
	"pending_until" timestamp with time zone,
	"retry_after" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "character_relationships" ADD CONSTRAINT "character_relationships_uid_users_firebase_uid_fk" FOREIGN KEY ("uid") REFERENCES "public"."users"("firebase_uid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_achievements" ADD CONSTRAINT "episode_achievements_uid_users_firebase_uid_fk" FOREIGN KEY ("uid") REFERENCES "public"."users"("firebase_uid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_evaluations" ADD CONSTRAINT "practice_evaluations_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_evaluations" ADD CONSTRAINT "practice_evaluations_uid_users_firebase_uid_fk" FOREIGN KEY ("uid") REFERENCES "public"."users"("firebase_uid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "practice_evaluations_uid_idx" ON "practice_evaluations" USING btree ("uid");