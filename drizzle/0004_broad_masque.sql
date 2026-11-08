CREATE TABLE "billing_checkouts" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"uid" varchar(255) NOT NULL,
	"product" varchar(40) NOT NULL,
	"stripe_session_id" varchar(255),
	"url" text,
	"status" varchar(32) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_checkouts_stripe_session_id_unique" UNIQUE("stripe_session_id")
);
--> statement-breakpoint
CREATE TABLE "billing_customers" (
	"uid" varchar(255) PRIMARY KEY NOT NULL,
	"stripe_customer_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_customers_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE "billing_events" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"type" varchar(100) NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_subscriptions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"uid" varchar(255) NOT NULL,
	"status" varchar(32) NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "character_endings" (
	"id" varchar(300) PRIMARY KEY NOT NULL,
	"uid" varchar(255) NOT NULL,
	"character_id" varchar(32) NOT NULL,
	"practice_id" varchar(36) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "character_endings_uid_character_key" UNIQUE("uid","character_id")
);
--> statement-breakpoint
CREATE TABLE "credit_grants" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"uid" varchar(255) NOT NULL,
	"kind" varchar(16) NOT NULL,
	"character_id" varchar(32),
	"units" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "credit_spends" (
	"id" varchar(320) PRIMARY KEY NOT NULL,
	"uid" varchar(255) NOT NULL,
	"practice_id" varchar(36) NOT NULL,
	"grant_id" varchar(255) NOT NULL,
	"units" integer NOT NULL,
	"state" varchar(16) NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "credit_spends_practice_grant_key" UNIQUE("practice_id","grant_id")
);
--> statement-breakpoint
CREATE TABLE "route_purchases" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"uid" varchar(255) NOT NULL,
	"character_id" varchar(32) NOT NULL,
	"payment_intent_id" varchar(255),
	"revoked_at" timestamp with time zone,
	"paid_at" timestamp with time zone NOT NULL,
	CONSTRAINT "route_purchases_payment_intent_id_unique" UNIQUE("payment_intent_id")
);
--> statement-breakpoint
ALTER TABLE "practices" ADD COLUMN "credit_cost" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "practices" ADD COLUMN "story_context" jsonb;--> statement-breakpoint
ALTER TABLE "practices" ADD COLUMN "story_ending" jsonb;--> statement-breakpoint
ALTER TABLE "billing_checkouts" ADD CONSTRAINT "billing_checkouts_uid_users_firebase_uid_fk" FOREIGN KEY ("uid") REFERENCES "public"."users"("firebase_uid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_customers" ADD CONSTRAINT "billing_customers_uid_users_firebase_uid_fk" FOREIGN KEY ("uid") REFERENCES "public"."users"("firebase_uid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_uid_users_firebase_uid_fk" FOREIGN KEY ("uid") REFERENCES "public"."users"("firebase_uid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_endings" ADD CONSTRAINT "character_endings_uid_users_firebase_uid_fk" FOREIGN KEY ("uid") REFERENCES "public"."users"("firebase_uid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_endings" ADD CONSTRAINT "character_endings_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_grants" ADD CONSTRAINT "credit_grants_uid_users_firebase_uid_fk" FOREIGN KEY ("uid") REFERENCES "public"."users"("firebase_uid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_spends" ADD CONSTRAINT "credit_spends_uid_users_firebase_uid_fk" FOREIGN KEY ("uid") REFERENCES "public"."users"("firebase_uid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_spends" ADD CONSTRAINT "credit_spends_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_spends" ADD CONSTRAINT "credit_spends_grant_id_credit_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."credit_grants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_purchases" ADD CONSTRAINT "route_purchases_uid_users_firebase_uid_fk" FOREIGN KEY ("uid") REFERENCES "public"."users"("firebase_uid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_checkouts_uid_product_idx" ON "billing_checkouts" USING btree ("uid","product");--> statement-breakpoint
CREATE INDEX "billing_subscriptions_uid_idx" ON "billing_subscriptions" USING btree ("uid");--> statement-breakpoint
CREATE INDEX "credit_grants_uid_idx" ON "credit_grants" USING btree ("uid");--> statement-breakpoint
CREATE INDEX "credit_spends_uid_idx" ON "credit_spends" USING btree ("uid");--> statement-breakpoint
CREATE INDEX "route_purchases_uid_character_idx" ON "route_purchases" USING btree ("uid","character_id");