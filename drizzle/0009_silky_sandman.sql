CREATE TABLE "guest_practices" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"session_id" varchar(64) NOT NULL,
	"character_id" varchar(32) NOT NULL,
	"character_context" jsonb NOT NULL,
	"policy_release_id" varchar(36),
	"story_context" jsonb NOT NULL,
	"state" jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"pending_token" varchar(36),
	"claimed_uid" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guest_practices_session_character_key" UNIQUE("session_id","character_id")
);
--> statement-breakpoint
CREATE TABLE "guest_rate_limits" (
	"key" varchar(128) PRIMARY KEY NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guest_sessions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guest_practices" ADD CONSTRAINT "guest_practices_session_id_guest_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."guest_sessions"("id") ON DELETE cascade ON UPDATE no action;