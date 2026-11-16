CREATE TABLE "billing_accounts" (
	"tenant_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"base_plan" text NOT NULL,
	"stripe_subscription_id" text,
	"subscription_status" text,
	"synced_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_accounts_pk" PRIMARY KEY("tenant_id","mode"),
	CONSTRAINT "billing_accounts_mode_chk" CHECK ("billing_accounts"."mode" in ('test', 'live')),
	CONSTRAINT "billing_accounts_customer_chk" CHECK ("billing_accounts"."stripe_customer_id" like 'cus\_%'),
	CONSTRAINT "billing_accounts_base_plan_chk" CHECK ("billing_accounts"."base_plan" in ('free', 'founding'))
);
--> statement-breakpoint
CREATE TABLE "billing_webhook_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"mode" text NOT NULL,
	"event_type" text NOT NULL,
	"tenant_id" uuid,
	"outcome" text NOT NULL,
	"plan_before" text,
	"plan_after" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_webhook_events_id_chk" CHECK ("billing_webhook_events"."event_id" like 'evt\_%'),
	CONSTRAINT "billing_webhook_events_mode_chk" CHECK ("billing_webhook_events"."mode" in ('test', 'live')),
	CONSTRAINT "billing_webhook_events_outcome_chk" CHECK ("billing_webhook_events"."outcome" in ('applied', 'unchanged', 'ignored'))
);
--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "plan" SET DEFAULT 'founding';--> statement-breakpoint
-- COMMERCIAL-ACTIVATION-1: every tenant that exists when billing arrives keeps its pre-billing rights.
-- Before this migration `plan` was a label nothing read, written only by its default 'free'.
UPDATE "companies" SET "plan" = 'founding' WHERE "plan" = 'free';--> statement-breakpoint
ALTER TABLE "billing_accounts" ADD CONSTRAINT "billing_accounts_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_accounts" ADD CONSTRAINT "billing_accounts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_webhook_events" ADD CONSTRAINT "billing_webhook_events_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_accounts_customer_uq" ON "billing_accounts" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "billing_webhook_events_tenant_idx" ON "billing_webhook_events" USING btree ("tenant_id","received_at");--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_plan_chk" CHECK ("companies"."plan" in ('free', 'pro', 'founding'));