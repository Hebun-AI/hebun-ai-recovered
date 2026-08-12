CREATE TYPE "public"."identity_enrollment_status" AS ENUM('pending', 'approved', 'rejected', 'completed');--> statement-breakpoint
ALTER TYPE "public"."governance_domain" ADD VALUE 'identity-enrollment';--> statement-breakpoint
CREATE TABLE "identity_enrollment_requests" (
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
	"invitation_id" uuid NOT NULL,
	"continuation_hash" char(64) NOT NULL,
	"continuation_version" integer DEFAULT 1 NOT NULL,
	"status" "identity_enrollment_status" DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"approval_decision_id" uuid,
	"approved_by_actor_type" "actor_type",
	"approved_by_actor_id" uuid,
	"rejected_at" timestamp with time zone,
	"rejection_reason" varchar(128),
	"completed_at" timestamp with time zone,
	"enrolled_auth_identity_id" uuid,
	CONSTRAINT "identity_enrollment_requests_continuation_hash_chk" CHECK ("identity_enrollment_requests"."continuation_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "identity_enrollment_requests_continuation_version_chk" CHECK ("identity_enrollment_requests"."continuation_version" > 0),
	CONSTRAINT "identity_enrollment_requests_approved_chk" CHECK (("identity_enrollment_requests"."status" in ('approved', 'completed')) = ("identity_enrollment_requests"."approved_at" is not null and "identity_enrollment_requests"."approval_decision_id" is not null and "identity_enrollment_requests"."approved_by_actor_type" is not null and "identity_enrollment_requests"."approved_by_actor_id" is not null)),
	CONSTRAINT "identity_enrollment_requests_rejected_chk" CHECK (("identity_enrollment_requests"."status" = 'rejected') = ("identity_enrollment_requests"."rejected_at" is not null and "identity_enrollment_requests"."rejection_reason" is not null and char_length(btrim("identity_enrollment_requests"."rejection_reason")) > 0)),
	CONSTRAINT "identity_enrollment_requests_completed_chk" CHECK (("identity_enrollment_requests"."status" = 'completed') = ("identity_enrollment_requests"."completed_at" is not null and "identity_enrollment_requests"."enrolled_auth_identity_id" is not null)),
	CONSTRAINT "identity_enrollment_requests_human_approver_chk" CHECK ("identity_enrollment_requests"."approved_by_actor_type" is null or "identity_enrollment_requests"."approved_by_actor_type" = 'human')
);
--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_tenant_id_id_uq" UNIQUE("tenant_id","id");--> statement-breakpoint
ALTER TABLE "identity_enrollment_requests" ADD CONSTRAINT "identity_enrollment_requests_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_enrollment_requests" ADD CONSTRAINT "identity_enrollment_requests_tenant_invitation_fk" FOREIGN KEY ("tenant_id","invitation_id") REFERENCES "public"."invitations"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_enrollment_requests" ADD CONSTRAINT "identity_enrollment_requests_decision_fk" FOREIGN KEY ("approval_decision_id") REFERENCES "public"."decision_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_enrollment_requests" ADD CONSTRAINT "identity_enrollment_requests_identity_fk" FOREIGN KEY ("enrolled_auth_identity_id") REFERENCES "public"."auth_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "identity_enrollment_requests_one_live_per_invitation_uq" ON "identity_enrollment_requests" USING btree ("invitation_id") WHERE "identity_enrollment_requests"."status" <> 'rejected';--> statement-breakpoint
CREATE UNIQUE INDEX "identity_enrollment_requests_continuation_uq" ON "identity_enrollment_requests" USING btree ("continuation_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "identity_enrollment_requests_decision_uq" ON "identity_enrollment_requests" USING btree ("approval_decision_id") WHERE "identity_enrollment_requests"."approval_decision_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "identity_enrollment_requests_identity_uq" ON "identity_enrollment_requests" USING btree ("enrolled_auth_identity_id") WHERE "identity_enrollment_requests"."enrolled_auth_identity_id" is not null;--> statement-breakpoint
CREATE INDEX "identity_enrollment_requests_tenant_status_idx" ON "identity_enrollment_requests" USING btree ("tenant_id","status");