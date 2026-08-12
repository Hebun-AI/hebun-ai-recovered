CREATE TYPE "public"."membership_authorization_status" AS ENUM('authorized', 'consumed', 'revoked');--> statement-breakpoint
ALTER TYPE "public"."governance_domain" ADD VALUE 'membership-authorization';--> statement-breakpoint
CREATE TABLE "membership_authorizations" (
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
	"normalized_email" varchar(320) NOT NULL,
	"intended_role_id" uuid NOT NULL,
	"governance_decision_id" uuid NOT NULL,
	"governance_session_id" uuid NOT NULL,
	"authorized_by_actor_type" "actor_type" NOT NULL,
	"authorized_by_actor_id" uuid NOT NULL,
	"status" "membership_authorization_status" DEFAULT 'authorized' NOT NULL,
	"authorized_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consumed_at" timestamp with time zone,
	"consumed_by_invitation_id" uuid,
	"revoked_at" timestamp with time zone,
	"revocation_reason" varchar(128),
	CONSTRAINT "membership_authorizations_normalized_email_chk" CHECK ("membership_authorizations"."normalized_email" = lower(btrim("membership_authorizations"."normalized_email")) and char_length("membership_authorizations"."normalized_email") > 0),
	CONSTRAINT "membership_authorizations_human_authorizer_chk" CHECK ("membership_authorizations"."authorized_by_actor_type" = 'human'),
	CONSTRAINT "membership_authorizations_consumed_chk" CHECK (("membership_authorizations"."consumed_at" is null) = ("membership_authorizations"."consumed_by_invitation_id" is null)),
	CONSTRAINT "membership_authorizations_consumed_status_chk" CHECK (("membership_authorizations"."status" = 'consumed') = ("membership_authorizations"."consumed_at" is not null)),
	CONSTRAINT "membership_authorizations_revoked_chk" CHECK ("membership_authorizations"."status" <> 'revoked' or ("membership_authorizations"."revoked_at" is not null and "membership_authorizations"."revocation_reason" is not null and char_length(btrim("membership_authorizations"."revocation_reason")) > 0))
);
--> statement-breakpoint
ALTER TABLE "membership_authorizations" ADD CONSTRAINT "membership_authorizations_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_authorizations" ADD CONSTRAINT "membership_authorizations_governance_decision_id_decision_records_id_fk" FOREIGN KEY ("governance_decision_id") REFERENCES "public"."decision_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_authorizations" ADD CONSTRAINT "membership_authorizations_governance_session_id_governance_sessions_id_fk" FOREIGN KEY ("governance_session_id") REFERENCES "public"."governance_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_authorizations" ADD CONSTRAINT "membership_authorizations_consumed_by_invitation_id_invitations_id_fk" FOREIGN KEY ("consumed_by_invitation_id") REFERENCES "public"."invitations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_authorizations" ADD CONSTRAINT "membership_authorizations_tenant_role_fk" FOREIGN KEY ("tenant_id","intended_role_id") REFERENCES "public"."roles"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "membership_authorizations_one_active_per_email_uq" ON "membership_authorizations" USING btree ("tenant_id","normalized_email") WHERE "membership_authorizations"."status" = 'authorized';--> statement-breakpoint
CREATE UNIQUE INDEX "membership_authorizations_decision_uq" ON "membership_authorizations" USING btree ("governance_decision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "membership_authorizations_consumed_invitation_uq" ON "membership_authorizations" USING btree ("consumed_by_invitation_id") WHERE "membership_authorizations"."consumed_by_invitation_id" is not null;--> statement-breakpoint
CREATE INDEX "membership_authorizations_tenant_status_idx" ON "membership_authorizations" USING btree ("tenant_id","status");