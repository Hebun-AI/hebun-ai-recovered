CREATE TYPE "public"."standing_mutation_state" AS ENUM('active', 'withdrawn');--> statement-breakpoint
ALTER TYPE "public"."governance_domain" ADD VALUE 'standing-mutation';--> statement-breakpoint
CREATE TABLE "standing_mutation_authorizations" (
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
	"state" "standing_mutation_state" NOT NULL,
	"agent_id" uuid NOT NULL,
	"action_kind" text NOT NULL,
	"not_before" timestamp with time zone NOT NULL,
	"not_after" timestamp with time zone NOT NULL,
	"max_acts" integer NOT NULL,
	"min_interval_minutes" integer NOT NULL,
	"governance_decision_id" uuid NOT NULL,
	"governance_session_id" uuid NOT NULL,
	"authorized_by_actor_type" "actor_type" NOT NULL,
	"authorized_by_actor_id" uuid NOT NULL,
	"authorized_at" timestamp with time zone NOT NULL,
	"supersedes_authorization_id" uuid,
	CONSTRAINT "standing_mutation_authorizations_human_authorizer_chk" CHECK ("standing_mutation_authorizations"."authorized_by_actor_type" = 'human'),
	CONSTRAINT "standing_mutation_authorizations_revision_chk" CHECK ("standing_mutation_authorizations"."authorization_revision" >= 1),
	CONSTRAINT "standing_mutation_authorizations_lineage_chk" CHECK (("standing_mutation_authorizations"."authorization_revision" = 1) = ("standing_mutation_authorizations"."supersedes_authorization_id" is null)),
	CONSTRAINT "standing_mutation_authorizations_supersedes_not_self_chk" CHECK ("standing_mutation_authorizations"."supersedes_authorization_id" is null or "standing_mutation_authorizations"."supersedes_authorization_id" <> "standing_mutation_authorizations"."id"),
	CONSTRAINT "standing_mutation_authorizations_first_revision_active_chk" CHECK ("standing_mutation_authorizations"."authorization_revision" > 1 or "standing_mutation_authorizations"."state" = 'active'),
	CONSTRAINT "standing_mutation_authorizations_window_chk" CHECK ("standing_mutation_authorizations"."not_after" > "standing_mutation_authorizations"."not_before"),
	CONSTRAINT "standing_mutation_authorizations_max_acts_chk" CHECK ("standing_mutation_authorizations"."max_acts" >= 1 and "standing_mutation_authorizations"."max_acts" <= 50),
	CONSTRAINT "standing_mutation_authorizations_cadence_chk" CHECK ("standing_mutation_authorizations"."min_interval_minutes" >= 1 and "standing_mutation_authorizations"."min_interval_minutes" <= 10080),
	CONSTRAINT "standing_mutation_authorizations_action_kind_chk" CHECK ("standing_mutation_authorizations"."action_kind" = 'record-work')
);
--> statement-breakpoint
DROP INDEX "action_permits_decision_uq";--> statement-breakpoint
DROP INDEX "heby_action_requests_approval_decision_uq";--> statement-breakpoint
ALTER TABLE "action_permits" ADD COLUMN "standing_authorization_id" uuid;--> statement-breakpoint
ALTER TABLE "heby_action_requests" ADD COLUMN "standing_authorization_id" uuid;--> statement-breakpoint
ALTER TABLE "standing_mutation_authorizations" ADD CONSTRAINT "standing_mutation_authorizations_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standing_mutation_authorizations" ADD CONSTRAINT "standing_mutation_authorizations_governance_decision_id_decision_records_id_fk" FOREIGN KEY ("governance_decision_id") REFERENCES "public"."decision_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standing_mutation_authorizations" ADD CONSTRAINT "standing_mutation_authorizations_governance_session_id_governance_sessions_id_fk" FOREIGN KEY ("governance_session_id") REFERENCES "public"."governance_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standing_mutation_authorizations" ADD CONSTRAINT "standing_mutation_authorizations_supersedes_authorization_id_standing_mutation_authorizations_id_fk" FOREIGN KEY ("supersedes_authorization_id") REFERENCES "public"."standing_mutation_authorizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standing_mutation_authorizations" ADD CONSTRAINT "standing_mutation_authorizations_tenant_agent_fk" FOREIGN KEY ("tenant_id","agent_id") REFERENCES "public"."agents"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "standing_mutation_authorizations_lineage_revision_uq" ON "standing_mutation_authorizations" USING btree ("tenant_id","agent_id","authorization_revision");--> statement-breakpoint
CREATE UNIQUE INDEX "standing_mutation_authorizations_decision_uq" ON "standing_mutation_authorizations" USING btree ("governance_decision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "standing_mutation_authorizations_supersedes_uq" ON "standing_mutation_authorizations" USING btree ("supersedes_authorization_id") WHERE "standing_mutation_authorizations"."supersedes_authorization_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "standing_mutation_authorizations_id_tenant_uq" ON "standing_mutation_authorizations" USING btree ("id","tenant_id");--> statement-breakpoint
CREATE INDEX "standing_mutation_authorizations_tenant_state_idx" ON "standing_mutation_authorizations" USING btree ("tenant_id","state");--> statement-breakpoint
ALTER TABLE "action_permits" ADD CONSTRAINT "action_permits_tenant_standing_authorization_fk" FOREIGN KEY ("tenant_id","standing_authorization_id") REFERENCES "public"."standing_mutation_authorizations"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heby_action_requests" ADD CONSTRAINT "heby_action_requests_tenant_standing_authorization_fk" FOREIGN KEY ("tenant_id","standing_authorization_id") REFERENCES "public"."standing_mutation_authorizations"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_permits_standing_authorization_idx" ON "action_permits" USING btree ("standing_authorization_id","issued_at") WHERE "action_permits"."standing_authorization_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "action_permits_decision_uq" ON "action_permits" USING btree ("governance_decision_id") WHERE "action_permits"."standing_authorization_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "heby_action_requests_approval_decision_uq" ON "heby_action_requests" USING btree ("approval_decision_id") WHERE "heby_action_requests"."approval_decision_id" is not null and "heby_action_requests"."standing_authorization_id" is null;