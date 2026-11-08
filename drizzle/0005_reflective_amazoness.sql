CREATE TABLE "billing_payment_states" (
	"payment_intent_id" varchar(255) PRIMARY KEY NOT NULL,
	"uid" varchar(255) NOT NULL,
	"revoked_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_checkouts" ADD COLUMN "request_params" jsonb;--> statement-breakpoint
ALTER TABLE "billing_payment_states" ADD CONSTRAINT "billing_payment_states_uid_users_firebase_uid_fk" FOREIGN KEY ("uid") REFERENCES "public"."users"("firebase_uid") ON DELETE no action ON UPDATE no action;