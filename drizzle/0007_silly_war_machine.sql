CREATE TABLE "knowledge_releases" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"version" integer GENERATED ALWAYS AS IDENTITY (sequence name "knowledge_releases_version_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"content" jsonb NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"note" varchar(200) NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_releases_version_unique" UNIQUE("version")
);
--> statement-breakpoint
CREATE TABLE "knowledge_settings" (
	"id" varchar(16) PRIMARY KEY NOT NULL,
	"draft" jsonb NOT NULL,
	"draft_revision" integer DEFAULT 0 NOT NULL,
	"active_release_id" varchar(36),
	"preview" jsonb,
	"updated_by" varchar(255) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "practice_turns" ADD COLUMN "policy_context" jsonb;--> statement-breakpoint
ALTER TABLE "practices" ADD COLUMN "policy_release_id" varchar(36);--> statement-breakpoint
ALTER TABLE "knowledge_settings" ADD CONSTRAINT "knowledge_settings_active_release_id_knowledge_releases_id_fk" FOREIGN KEY ("active_release_id") REFERENCES "public"."knowledge_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practices" ADD CONSTRAINT "practices_policy_release_id_knowledge_releases_id_fk" FOREIGN KEY ("policy_release_id") REFERENCES "public"."knowledge_releases"("id") ON DELETE no action ON UPDATE no action;