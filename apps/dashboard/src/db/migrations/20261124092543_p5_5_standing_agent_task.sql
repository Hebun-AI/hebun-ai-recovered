ALTER TYPE "public"."governance_domain" ADD VALUE 'standing-agent-task';--> statement-breakpoint
CREATE TABLE "scheduled_agent_task_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"template" text NOT NULL,
	"standing_authorization_id" uuid NOT NULL,
	"period_key" text NOT NULL,
	"status" text NOT NULL,
	"failure_reason" text,
	"artifact_id" uuid,
	"correlation_id" text,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "scheduled_agent_task_runs_template_chk" CHECK ("scheduled_agent_task_runs"."template" in ('weekly-content-plan', 'weekly-operations-summary')),
	CONSTRAINT "scheduled_agent_task_runs_period_chk" CHECK ("scheduled_agent_task_runs"."period_key" ~ '^[0-9]{4}-W[0-9]{2}$'),
	CONSTRAINT "scheduled_agent_task_runs_status_chk" CHECK ("scheduled_agent_task_runs"."status" in ('claimed', 'filed', 'failed')),
	CONSTRAINT "scheduled_agent_task_runs_outcome_chk" CHECK (("scheduled_agent_task_runs"."status" = 'claimed' and "scheduled_agent_task_runs"."finished_at" is null and "scheduled_agent_task_runs"."artifact_id" is null and "scheduled_agent_task_runs"."failure_reason" is null)
        or ("scheduled_agent_task_runs"."status" = 'filed' and "scheduled_agent_task_runs"."finished_at" is not null and "scheduled_agent_task_runs"."artifact_id" is not null and "scheduled_agent_task_runs"."failure_reason" is null)
        or ("scheduled_agent_task_runs"."status" = 'failed' and "scheduled_agent_task_runs"."finished_at" is not null and "scheduled_agent_task_runs"."artifact_id" is null and char_length("scheduled_agent_task_runs"."failure_reason") between 1 and 120))
);
--> statement-breakpoint
CREATE TABLE "standing_agent_task_authorizations" (
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
	"template" text NOT NULL,
	"authorization_revision" integer NOT NULL,
	"state" text NOT NULL,
	"work_item_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"title" text NOT NULL,
	"brief" text NOT NULL,
	"governance_decision_id" uuid NOT NULL,
	"governance_session_id" uuid NOT NULL,
	"authorized_by_actor_type" "actor_type" NOT NULL,
	"authorized_by_actor_id" uuid NOT NULL,
	"authorized_at" timestamp with time zone NOT NULL,
	"supersedes_authorization_id" uuid,
	CONSTRAINT "standing_agent_task_authorizations_template_chk" CHECK ("standing_agent_task_authorizations"."template" in ('weekly-content-plan', 'weekly-operations-summary')),
	CONSTRAINT "standing_agent_task_authorizations_state_chk" CHECK ("standing_agent_task_authorizations"."state" in ('active', 'withdrawn')),
	CONSTRAINT "standing_agent_task_authorizations_human_authorizer_chk" CHECK ("standing_agent_task_authorizations"."authorized_by_actor_type" = 'human'),
	CONSTRAINT "standing_agent_task_authorizations_revision_chk" CHECK ("standing_agent_task_authorizations"."authorization_revision" >= 1),
	CONSTRAINT "standing_agent_task_authorizations_lineage_chk" CHECK (("standing_agent_task_authorizations"."authorization_revision" = 1) = ("standing_agent_task_authorizations"."supersedes_authorization_id" is null)),
	CONSTRAINT "standing_agent_task_authorizations_supersedes_not_self_chk" CHECK ("standing_agent_task_authorizations"."supersedes_authorization_id" is null or "standing_agent_task_authorizations"."supersedes_authorization_id" <> "standing_agent_task_authorizations"."id"),
	CONSTRAINT "standing_agent_task_authorizations_first_revision_active_chk" CHECK ("standing_agent_task_authorizations"."authorization_revision" > 1 or "standing_agent_task_authorizations"."state" = 'active'),
	CONSTRAINT "standing_agent_task_authorizations_brief_chk" CHECK (char_length(btrim("standing_agent_task_authorizations"."title")) between 1 and 200 and char_length(btrim("standing_agent_task_authorizations"."brief")) between 1 and 4000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "standing_agent_task_authorizations_tenant_id_uq" ON "standing_agent_task_authorizations" USING btree ("tenant_id","id");--> statement-breakpoint
ALTER TABLE "scheduled_agent_task_runs" ADD CONSTRAINT "scheduled_agent_task_runs_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_agent_task_runs" ADD CONSTRAINT "scheduled_agent_task_runs_tenant_authorization_fk" FOREIGN KEY ("tenant_id","standing_authorization_id") REFERENCES "public"."standing_agent_task_authorizations"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_agent_task_runs" ADD CONSTRAINT "scheduled_agent_task_runs_tenant_artifact_fk" FOREIGN KEY ("tenant_id","artifact_id") REFERENCES "public"."work_artifacts"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standing_agent_task_authorizations" ADD CONSTRAINT "standing_agent_task_authorizations_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standing_agent_task_authorizations" ADD CONSTRAINT "standing_agent_task_authorizations_governance_decision_id_decision_records_id_fk" FOREIGN KEY ("governance_decision_id") REFERENCES "public"."decision_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standing_agent_task_authorizations" ADD CONSTRAINT "standing_agent_task_authorizations_governance_session_id_governance_sessions_id_fk" FOREIGN KEY ("governance_session_id") REFERENCES "public"."governance_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standing_agent_task_authorizations" ADD CONSTRAINT "standing_agent_task_authorizations_supersedes_authorization_id_standing_agent_task_authorizations_id_fk" FOREIGN KEY ("supersedes_authorization_id") REFERENCES "public"."standing_agent_task_authorizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standing_agent_task_authorizations" ADD CONSTRAINT "standing_agent_task_authorizations_tenant_work_item_fk" FOREIGN KEY ("tenant_id","work_item_id") REFERENCES "public"."work_items"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standing_agent_task_authorizations" ADD CONSTRAINT "standing_agent_task_authorizations_tenant_agent_fk" FOREIGN KEY ("tenant_id","agent_id") REFERENCES "public"."agents"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "scheduled_agent_task_runs_week_uq" ON "scheduled_agent_task_runs" USING btree ("tenant_id","template","period_key");--> statement-breakpoint
CREATE INDEX "scheduled_agent_task_runs_tenant_period_idx" ON "scheduled_agent_task_runs" USING btree ("tenant_id","period_key");--> statement-breakpoint
CREATE UNIQUE INDEX "standing_agent_task_authorizations_lineage_revision_uq" ON "standing_agent_task_authorizations" USING btree ("tenant_id","template","authorization_revision");--> statement-breakpoint
CREATE UNIQUE INDEX "standing_agent_task_authorizations_decision_uq" ON "standing_agent_task_authorizations" USING btree ("governance_decision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "standing_agent_task_authorizations_supersedes_uq" ON "standing_agent_task_authorizations" USING btree ("supersedes_authorization_id") WHERE "standing_agent_task_authorizations"."supersedes_authorization_id" is not null;--> statement-breakpoint
CREATE INDEX "standing_agent_task_authorizations_tenant_template_idx" ON "standing_agent_task_authorizations" USING btree ("tenant_id","template");