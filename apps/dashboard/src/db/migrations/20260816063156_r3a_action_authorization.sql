CREATE TYPE "public"."action_permit_status" AS ENUM('active', 'consumed', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."heby_action_request_status" AS ENUM('pending', 'approved', 'rejected', 'withdrawn');--> statement-breakpoint
ALTER TYPE "public"."governance_domain" ADD VALUE 'action-authorization';--> statement-breakpoint
CREATE TABLE "action_permits" (
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
	"action_request_id" uuid NOT NULL,
	"governance_decision_id" uuid NOT NULL,
	"governance_session_id" uuid NOT NULL,
	"authorized_by_actor_type" "actor_type" NOT NULL,
	"authorized_by_actor_id" uuid NOT NULL,
	"bound_payload_digest" char(64) NOT NULL,
	"status" "action_permit_status" DEFAULT 'active' NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ttl_seconds" integer NOT NULL,
	"consumed_at" timestamp with time zone,
	"handoff_id" uuid,
	"revoked_at" timestamp with time zone,
	"revocation_decision_id" uuid,
	"revocation_reason" varchar(256),
	CONSTRAINT "action_permits_human_authorizer_chk" CHECK ("action_permits"."authorized_by_actor_type" = 'human'),
	CONSTRAINT "action_permits_consumed_chk" CHECK (("action_permits"."consumed_at" is null) = ("action_permits"."handoff_id" is null)),
	CONSTRAINT "action_permits_consumed_status_chk" CHECK (("action_permits"."status" = 'consumed') = ("action_permits"."consumed_at" is not null)),
	CONSTRAINT "action_permits_revoked_chk" CHECK (("action_permits"."status" = 'revoked') = ("action_permits"."revoked_at" is not null and "action_permits"."revocation_decision_id" is not null and "action_permits"."revocation_reason" is not null and char_length(btrim("action_permits"."revocation_reason")) > 0)),
	CONSTRAINT "action_permits_terminal_exclusive_chk" CHECK ("action_permits"."consumed_at" is null or "action_permits"."revoked_at" is null),
	CONSTRAINT "action_permits_expiry_after_issue_chk" CHECK ("action_permits"."expires_at" > "action_permits"."issued_at"),
	CONSTRAINT "action_permits_ttl_bounds_chk" CHECK ("action_permits"."ttl_seconds" > 0 and "action_permits"."ttl_seconds" <= 86400),
	CONSTRAINT "action_permits_bound_digest_chk" CHECK ("action_permits"."bound_payload_digest" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "heby_action_requests" (
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
	"action_id" varchar(64) NOT NULL,
	"payload_digest" char(64) NOT NULL,
	"action_kind" text NOT NULL,
	"tool_id" text NOT NULL,
	"side_effect" text NOT NULL,
	"reversibility" text NOT NULL,
	"target_kind" text,
	"target_ref" text,
	"target_label" text,
	"owner_workspace" text NOT NULL,
	"requesting_workspace" text NOT NULL,
	"canonical_payload" jsonb NOT NULL,
	"expected_effect" text NOT NULL,
	"consequences" jsonb NOT NULL,
	"evidence" jsonb,
	"proposed_by_actor_type" "actor_type" NOT NULL,
	"proposed_by_actor_id" uuid NOT NULL,
	"status" "heby_action_request_status" DEFAULT 'pending' NOT NULL,
	"approval_decision_id" uuid,
	"approved_at" timestamp with time zone,
	"approved_by_actor_type" "actor_type",
	"approved_by_actor_id" uuid,
	"rejection_decision_id" uuid,
	"rejected_at" timestamp with time zone,
	"rejection_reason" varchar(256),
	CONSTRAINT "heby_action_requests_approved_chk" CHECK (("heby_action_requests"."status" = 'approved') = ("heby_action_requests"."approved_at" is not null and "heby_action_requests"."approval_decision_id" is not null and "heby_action_requests"."approved_by_actor_type" is not null and "heby_action_requests"."approved_by_actor_id" is not null)),
	CONSTRAINT "heby_action_requests_rejected_chk" CHECK (("heby_action_requests"."status" = 'rejected') = ("heby_action_requests"."rejected_at" is not null and "heby_action_requests"."rejection_decision_id" is not null and "heby_action_requests"."rejection_reason" is not null and char_length(btrim("heby_action_requests"."rejection_reason")) > 0)),
	CONSTRAINT "heby_action_requests_human_approver_chk" CHECK ("heby_action_requests"."approved_by_actor_type" is null or "heby_action_requests"."approved_by_actor_type" = 'human'),
	CONSTRAINT "heby_action_requests_payload_digest_chk" CHECK ("heby_action_requests"."payload_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "heby_action_requests_no_device_action_chk" CHECK ("heby_action_requests"."side_effect" <> 'DEVICE_ACTION'),
	CONSTRAINT "heby_action_requests_target_chk" CHECK (("heby_action_requests"."target_kind" is null) = ("heby_action_requests"."target_ref" is null))
);
--> statement-breakpoint
ALTER TABLE "action_permits" ADD CONSTRAINT "action_permits_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_permits" ADD CONSTRAINT "action_permits_governance_decision_id_decision_records_id_fk" FOREIGN KEY ("governance_decision_id") REFERENCES "public"."decision_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_permits" ADD CONSTRAINT "action_permits_governance_session_id_governance_sessions_id_fk" FOREIGN KEY ("governance_session_id") REFERENCES "public"."governance_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_permits" ADD CONSTRAINT "action_permits_revocation_decision_id_decision_records_id_fk" FOREIGN KEY ("revocation_decision_id") REFERENCES "public"."decision_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
--
-- STATEMENT ORDER IS LOAD-BEARING, and drizzle-kit emitted it wrong. AGAIN.
--
-- The composite foreign key below names heby_action_requests(tenant_id, id) as its target, and
-- PostgreSQL will only accept that against a unique constraint that ALREADY EXISTS on exactly
-- those columns. Generated order put the CREATE UNIQUE INDEX last, so the ALTER TABLE failed with
--
--   there is no unique constraint matching given keys for referenced table "heby_action_requests"
--
-- proven on a disposable database before this file was touched. The index is therefore hoisted
-- above the constraint that depends on it. This is the same defect KR5's migration carried and the
-- same repair; nothing else about the generated file changed.
--
CREATE UNIQUE INDEX "heby_action_requests_tenant_id_uq" ON "heby_action_requests" USING btree ("tenant_id","id");--> statement-breakpoint
ALTER TABLE "action_permits" ADD CONSTRAINT "action_permits_tenant_request_fk" FOREIGN KEY ("tenant_id","action_request_id") REFERENCES "public"."heby_action_requests"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heby_action_requests" ADD CONSTRAINT "heby_action_requests_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heby_action_requests" ADD CONSTRAINT "heby_action_requests_approval_decision_id_decision_records_id_fk" FOREIGN KEY ("approval_decision_id") REFERENCES "public"."decision_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heby_action_requests" ADD CONSTRAINT "heby_action_requests_rejection_decision_id_decision_records_id_fk" FOREIGN KEY ("rejection_decision_id") REFERENCES "public"."decision_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "action_permits_decision_uq" ON "action_permits" USING btree ("governance_decision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "action_permits_request_uq" ON "action_permits" USING btree ("action_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "action_permits_handoff_uq" ON "action_permits" USING btree ("handoff_id") WHERE "action_permits"."handoff_id" is not null;--> statement-breakpoint
CREATE INDEX "action_permits_tenant_status_idx" ON "action_permits" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "action_permits_expiry_idx" ON "action_permits" USING btree ("tenant_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "heby_action_requests_one_pending_per_digest_uq" ON "heby_action_requests" USING btree ("tenant_id","payload_digest") WHERE "heby_action_requests"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "heby_action_requests_approval_decision_uq" ON "heby_action_requests" USING btree ("approval_decision_id") WHERE "heby_action_requests"."approval_decision_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "heby_action_requests_rejection_decision_uq" ON "heby_action_requests" USING btree ("rejection_decision_id") WHERE "heby_action_requests"."rejection_decision_id" is not null;--> statement-breakpoint
CREATE INDEX "heby_action_requests_tenant_status_idx" ON "heby_action_requests" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "heby_action_requests_digest_idx" ON "heby_action_requests" USING btree ("tenant_id","payload_digest");