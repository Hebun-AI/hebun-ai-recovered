CREATE TYPE "public"."action_execution_attempt_status" AS ENUM('pending', 'accepted', 'refused', 'failed', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."action_execution_failure_class" AS ENUM('authorization-invalid', 'recipient-retired', 'artifact-retired', 'artifact-unresolvable', 'digest-mismatch', 'execution-disabled', 'credential-unavailable', 'adapter-unavailable', 'provider-rejected', 'provider-unreachable', 'internal-persistence-failure');--> statement-breakpoint
CREATE TYPE "public"."action_execution_provider_response_class" AS ENUM('accepted', 'rejected', 'unreachable', 'ambiguous');--> statement-breakpoint
CREATE TABLE "action_execution_attempts" (
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
	"permit_id" uuid NOT NULL,
	"handoff_id" uuid NOT NULL,
	"action_request_id" uuid NOT NULL,
	"action_kind" text NOT NULL,
	"adapter_id" text NOT NULL,
	"bound_payload_digest" char(64) NOT NULL,
	"recipient_endpoint_digest" char(64) NOT NULL,
	"draft_revision_digest" char(64) NOT NULL,
	"recipient_id" uuid NOT NULL,
	"status" "action_execution_attempt_status" DEFAULT 'pending' NOT NULL,
	"provider_response_class" "action_execution_provider_response_class",
	"provider_message_id" text,
	"failure_class" "action_execution_failure_class",
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "action_execution_attempts_payload_digest_chk" CHECK ("action_execution_attempts"."bound_payload_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "action_execution_attempts_endpoint_digest_chk" CHECK ("action_execution_attempts"."recipient_endpoint_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "action_execution_attempts_revision_digest_chk" CHECK ("action_execution_attempts"."draft_revision_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "action_execution_attempts_terminal_chk" CHECK (("action_execution_attempts"."status" = 'pending') = ("action_execution_attempts"."completed_at" is null)),
	CONSTRAINT "action_execution_attempts_accepted_chk" CHECK (("action_execution_attempts"."status" = 'accepted') = ("action_execution_attempts"."provider_message_id" is not null)),
	CONSTRAINT "action_execution_attempts_message_class_chk" CHECK ("action_execution_attempts"."provider_message_id" is null or "action_execution_attempts"."provider_response_class" = 'accepted'),
	CONSTRAINT "action_execution_attempts_unknown_chk" CHECK (("action_execution_attempts"."status" = 'unknown') = ("action_execution_attempts"."provider_response_class" is not distinct from 'ambiguous')),
	CONSTRAINT "action_execution_attempts_response_class_chk" CHECK (("action_execution_attempts"."provider_response_class" is not null) = ("action_execution_attempts"."status" in ('accepted', 'failed', 'unknown'))),
	CONSTRAINT "action_execution_attempts_failure_class_chk" CHECK (("action_execution_attempts"."failure_class" is not null) = ("action_execution_attempts"."status" in ('failed', 'refused'))),
	CONSTRAINT "action_execution_attempts_adapter_id_chk" CHECK (char_length(btrim("action_execution_attempts"."adapter_id")) > 0),
	CONSTRAINT "action_execution_attempts_action_kind_chk" CHECK (char_length(btrim("action_execution_attempts"."action_kind")) > 0)
);
--> statement-breakpoint
-- HAND-ORDERED: drizzle-kit emitted this index last, but the composite FK below REFERENCES it.
-- PostgreSQL requires the referenced unique key to exist first, so the whole migration (one
-- transaction, all-or-nothing) failed with "no unique constraint matching given keys". Moved up
-- rather than split into a second migration: it is one indivisible change.
CREATE UNIQUE INDEX "action_permits_tenant_id_uq" ON "action_permits" USING btree ("tenant_id","id");--> statement-breakpoint
ALTER TABLE "action_execution_attempts" ADD CONSTRAINT "action_execution_attempts_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_execution_attempts" ADD CONSTRAINT "action_execution_attempts_tenant_permit_fk" FOREIGN KEY ("tenant_id","permit_id") REFERENCES "public"."action_permits"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_execution_attempts" ADD CONSTRAINT "action_execution_attempts_tenant_request_fk" FOREIGN KEY ("tenant_id","action_request_id") REFERENCES "public"."heby_action_requests"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_execution_attempts" ADD CONSTRAINT "action_execution_attempts_tenant_recipient_fk" FOREIGN KEY ("tenant_id","recipient_id") REFERENCES "public"."external_recipients"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "action_execution_attempts_handoff_uq" ON "action_execution_attempts" USING btree ("handoff_id");--> statement-breakpoint
CREATE UNIQUE INDEX "action_execution_attempts_permit_uq" ON "action_execution_attempts" USING btree ("permit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "action_execution_attempts_tenant_id_uq" ON "action_execution_attempts" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "action_execution_attempts_tenant_status_idx" ON "action_execution_attempts" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "action_execution_attempts_tenant_started_idx" ON "action_execution_attempts" USING btree ("tenant_id","started_at");