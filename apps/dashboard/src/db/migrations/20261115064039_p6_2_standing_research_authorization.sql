CREATE TYPE "public"."standing_research_state" AS ENUM('active', 'withdrawn');--> statement-breakpoint
ALTER TYPE "public"."governance_domain" ADD VALUE 'standing-research';--> statement-breakpoint
CREATE TABLE "standing_research_authorizations" (
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
	"state" "standing_research_state" NOT NULL,
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
	CONSTRAINT "standing_research_authorizations_human_authorizer_chk" CHECK ("standing_research_authorizations"."authorized_by_actor_type" = 'human'),
	CONSTRAINT "standing_research_authorizations_revision_chk" CHECK ("standing_research_authorizations"."authorization_revision" >= 1),
	CONSTRAINT "standing_research_authorizations_lineage_chk" CHECK (("standing_research_authorizations"."authorization_revision" = 1) = ("standing_research_authorizations"."supersedes_authorization_id" is null)),
	CONSTRAINT "standing_research_authorizations_supersedes_not_self_chk" CHECK ("standing_research_authorizations"."supersedes_authorization_id" is null or "standing_research_authorizations"."supersedes_authorization_id" <> "standing_research_authorizations"."id"),
	CONSTRAINT "standing_research_authorizations_first_revision_active_chk" CHECK ("standing_research_authorizations"."authorization_revision" > 1 or "standing_research_authorizations"."state" = 'active'),
	CONSTRAINT "standing_research_authorizations_brief_chk" CHECK (char_length(btrim("standing_research_authorizations"."title")) between 1 and 200 and char_length(btrim("standing_research_authorizations"."brief")) between 1 and 4000)
);
--> statement-breakpoint
ALTER TABLE "standing_research_authorizations" ADD CONSTRAINT "standing_research_authorizations_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standing_research_authorizations" ADD CONSTRAINT "standing_research_authorizations_governance_decision_id_decision_records_id_fk" FOREIGN KEY ("governance_decision_id") REFERENCES "public"."decision_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standing_research_authorizations" ADD CONSTRAINT "standing_research_authorizations_governance_session_id_governance_sessions_id_fk" FOREIGN KEY ("governance_session_id") REFERENCES "public"."governance_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standing_research_authorizations" ADD CONSTRAINT "standing_research_authorizations_supersedes_authorization_id_standing_research_authorizations_id_fk" FOREIGN KEY ("supersedes_authorization_id") REFERENCES "public"."standing_research_authorizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standing_research_authorizations" ADD CONSTRAINT "standing_research_authorizations_tenant_work_item_fk" FOREIGN KEY ("tenant_id","work_item_id") REFERENCES "public"."work_items"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standing_research_authorizations" ADD CONSTRAINT "standing_research_authorizations_tenant_agent_fk" FOREIGN KEY ("tenant_id","agent_id") REFERENCES "public"."agents"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "standing_research_authorizations_lineage_revision_uq" ON "standing_research_authorizations" USING btree ("tenant_id","authorization_revision");--> statement-breakpoint
CREATE UNIQUE INDEX "standing_research_authorizations_decision_uq" ON "standing_research_authorizations" USING btree ("governance_decision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "standing_research_authorizations_supersedes_uq" ON "standing_research_authorizations" USING btree ("supersedes_authorization_id") WHERE "standing_research_authorizations"."supersedes_authorization_id" is not null;--> statement-breakpoint
CREATE INDEX "standing_research_authorizations_tenant_state_idx" ON "standing_research_authorizations" USING btree ("tenant_id","state");