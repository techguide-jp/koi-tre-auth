CREATE TABLE "character_policy_releases" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"character_id" varchar(32) NOT NULL,
	"version" integer GENERATED ALWAYS AS IDENTITY (sequence name "character_policy_releases_version_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"content" jsonb NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"note" varchar(200) NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "character_policy_releases_version_unique" UNIQUE("version")
);
--> statement-breakpoint
CREATE TABLE "character_policy_settings" (
	"character_id" varchar(32) PRIMARY KEY NOT NULL,
	"draft" jsonb NOT NULL,
	"draft_revision" integer DEFAULT 0 NOT NULL,
	"active_release_id" varchar(36),
	"preview" jsonb,
	"updated_by" varchar(255) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "practices" ADD COLUMN "character_context" jsonb;--> statement-breakpoint
ALTER TABLE "character_policy_settings" ADD CONSTRAINT "character_policy_settings_active_release_id_character_policy_releases_id_fk" FOREIGN KEY ("active_release_id") REFERENCES "public"."character_policy_releases"("id") ON DELETE no action ON UPDATE no action;