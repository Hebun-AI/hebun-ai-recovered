CREATE TYPE "public"."standing_observation_state" AS ENUM('active', 'withdrawn');--> statement-breakpoint
ALTER TYPE "public"."governance_domain" ADD VALUE 'standing-observation';--> statement-breakpoint
CREATE TABLE "standing_observation_authorizations" (
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
	"authorization_revision" integer NOT NULL,
	"state" "standing_observation_state" NOT NULL,
	"provider_key" text NOT NULL,
	"capability_key" text NOT NULL,
	"subject_kind" text NOT NULL,
	"subject_ref" text NOT NULL,
	"integration_id" uuid NOT NULL,
	"interval_minutes" integer NOT NULL,
	"governance_decision_id" uuid NOT NULL,
	"governance_session_id" uuid NOT NULL,
	"authorized_by_actor_type" "actor_type" NOT NULL,
	"authorized_by_actor_id" uuid NOT NULL,
	"authorized_at" timestamp with time zone NOT NULL,
	"supersedes_authorization_id" uuid,
	CONSTRAINT "standing_observation_authorizations_human_authorizer_chk" CHECK ("standing_observation_authorizations"."authorized_by_actor_type" = 'human'),
	CONSTRAINT "standing_observation_authorizations_revision_chk" CHECK ("standing_observation_authorizations"."authorization_revision" >= 1),
	CONSTRAINT "standing_observation_authorizations_lineage_chk" CHECK (("standing_observation_authorizations"."authorization_revision" = 1) = ("standing_observation_authorizations"."supersedes_authorization_id" is null)),
	CONSTRAINT "standing_observation_authorizations_supersedes_not_self_chk" CHECK ("standing_observation_authorizations"."supersedes_authorization_id" is null or "standing_observation_authorizations"."supersedes_authorization_id" <> "standing_observation_authorizations"."id"),
	CONSTRAINT "standing_observation_authorizations_first_revision_active_chk" CHECK ("standing_observation_authorizations"."authorization_revision" > 1 or "standing_observation_authorizations"."state" = 'active'),
	CONSTRAINT "standing_observation_authorizations_interval_chk" CHECK ("standing_observation_authorizations"."interval_minutes" >= 60),
	CONSTRAINT "standing_observation_authorizations_scope_chk" CHECK (char_length(btrim("standing_observation_authorizations"."provider_key")) > 0
          and char_length(btrim("standing_observation_authorizations"."capability_key")) > 0
          and char_length(btrim("standing_observation_authorizations"."subject_kind")) > 0
          and char_length(btrim("standing_observation_authorizations"."subject_ref")) > 0)
);
--> statement-breakpoint
ALTER TABLE "standing_observation_authorizations" ADD CONSTRAINT "standing_observation_authorizations_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standing_observation_authorizations" ADD CONSTRAINT "standing_observation_authorizations_governance_decision_id_decision_records_id_fk" FOREIGN KEY ("governance_decision_id") REFERENCES "public"."decision_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standing_observation_authorizations" ADD CONSTRAINT "standing_observation_authorizations_governance_session_id_governance_sessions_id_fk" FOREIGN KEY ("governance_session_id") REFERENCES "public"."governance_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standing_observation_authorizations" ADD CONSTRAINT "standing_observation_authorizations_supersedes_authorization_id_standing_observation_authorizations_id_fk" FOREIGN KEY ("supersedes_authorization_id") REFERENCES "public"."standing_observation_authorizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standing_observation_authorizations" ADD CONSTRAINT "standing_observation_authorizations_tenant_integration_fk" FOREIGN KEY ("integration_id","tenant_id") REFERENCES "public"."integrations"("id","tenant_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "standing_observation_authorizations_lineage_revision_uq" ON "standing_observation_authorizations" USING btree ("tenant_id","provider_key","capability_key","subject_ref","authorization_revision");--> statement-breakpoint
CREATE UNIQUE INDEX "standing_observation_authorizations_decision_uq" ON "standing_observation_authorizations" USING btree ("governance_decision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "standing_observation_authorizations_supersedes_uq" ON "standing_observation_authorizations" USING btree ("supersedes_authorization_id") WHERE "standing_observation_authorizations"."supersedes_authorization_id" is not null;--> statement-breakpoint
CREATE INDEX "standing_observation_authorizations_tenant_state_idx" ON "standing_observation_authorizations" USING btree ("tenant_id","state");