CREATE TYPE "public"."integration_connection_state" AS ENUM('draft', 'unverified', 'connected', 'expired', 'revoked', 'disconnected');--> statement-breakpoint
CREATE TYPE "public"."integration_health" AS ENUM('unknown', 'healthy', 'degraded', 'unreachable');--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN "provider_key" text;--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN "connection_state" "integration_connection_state" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN "health" "integration_health" DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN "last_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN "last_success_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN "last_error_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN "failure_reason" text;--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN "external_account_id" text;--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN "external_account_label" text;--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "integrations_id_tenant_uq" ON "integrations" USING btree ("id","tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integrations_tenant_provider_account_uq" ON "integrations" USING btree ("tenant_id","provider_key","external_account_id") WHERE "integrations"."connection_state" not in ('revoked', 'disconnected');