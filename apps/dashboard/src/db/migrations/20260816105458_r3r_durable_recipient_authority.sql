CREATE TYPE "public"."external_recipient_endpoint_kind" AS ENUM('email');--> statement-breakpoint
CREATE TYPE "public"."external_recipient_status" AS ENUM('active', 'retired');--> statement-breakpoint
CREATE TABLE "external_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"created_by_type" "actor_type",
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"updated_by_type" "actor_type",
	"version" integer DEFAULT 1 NOT NULL,
	"lifecycle_status" "lifecycle_status" DEFAULT 'active' NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"deleted_by_type" "actor_type",
	"tenant_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"endpoint_kind" "external_recipient_endpoint_kind" NOT NULL,
	"endpoint_value" text NOT NULL,
	"endpoint_digest" char(64) NOT NULL,
	"status" "external_recipient_status" DEFAULT 'active' NOT NULL,
	CONSTRAINT "external_recipients_display_name_chk" CHECK (char_length(btrim("external_recipients"."display_name")) > 0),
	CONSTRAINT "external_recipients_endpoint_value_chk" CHECK (char_length(btrim("external_recipients"."endpoint_value")) > 0),
	CONSTRAINT "external_recipients_endpoint_digest_chk" CHECK ("external_recipients"."endpoint_digest" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "external_recipients" ADD CONSTRAINT "external_recipients_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "external_recipients_tenant_id_uq" ON "external_recipients" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_recipients_tenant_active_endpoint_uq" ON "external_recipients" USING btree ("tenant_id","endpoint_value") WHERE "external_recipients"."status" = 'active';--> statement-breakpoint
CREATE INDEX "external_recipients_tenant_status_idx" ON "external_recipients" USING btree ("tenant_id","status");