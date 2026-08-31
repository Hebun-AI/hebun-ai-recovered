ALTER TYPE "public"."governance_domain" ADD VALUE 'agent-mandate';--> statement-breakpoint
CREATE TABLE "agent_mandates" (
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
	"agent_id" uuid NOT NULL,
	"mandate_revision" integer NOT NULL,
	"purpose" text NOT NULL,
	"proposal_scope" text[] NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"governance_decision_id" uuid NOT NULL,
	"governance_session_id" uuid NOT NULL,
	"established_by_actor_type" "actor_type" NOT NULL,
	"established_by_actor_id" uuid NOT NULL,
	"supersedes_mandate_id" uuid,
	CONSTRAINT "agent_mandates_scope_subset_chk" CHECK ("agent_mandates"."proposal_scope" <@ array['send']::text[]
          and cardinality("agent_mandates"."proposal_scope") <= cardinality(array['send']::text[])),
	CONSTRAINT "agent_mandates_human_establisher_chk" CHECK ("agent_mandates"."established_by_actor_type" = 'human'),
	CONSTRAINT "agent_mandates_revision_chk" CHECK ("agent_mandates"."mandate_revision" >= 1),
	CONSTRAINT "agent_mandates_lineage_chk" CHECK (("agent_mandates"."mandate_revision" = 1) = ("agent_mandates"."supersedes_mandate_id" is null)),
	CONSTRAINT "agent_mandates_supersedes_not_self_chk" CHECK ("agent_mandates"."supersedes_mandate_id" is null or "agent_mandates"."supersedes_mandate_id" <> "agent_mandates"."id"),
	CONSTRAINT "agent_mandates_purpose_chk" CHECK (char_length(btrim("agent_mandates"."purpose")) > 0)
);
--> statement-breakpoint
ALTER TABLE "agent_mandates" ADD CONSTRAINT "agent_mandates_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_mandates" ADD CONSTRAINT "agent_mandates_governance_decision_id_decision_records_id_fk" FOREIGN KEY ("governance_decision_id") REFERENCES "public"."decision_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_mandates" ADD CONSTRAINT "agent_mandates_governance_session_id_governance_sessions_id_fk" FOREIGN KEY ("governance_session_id") REFERENCES "public"."governance_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_mandates" ADD CONSTRAINT "agent_mandates_supersedes_mandate_id_agent_mandates_id_fk" FOREIGN KEY ("supersedes_mandate_id") REFERENCES "public"."agent_mandates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_mandates" ADD CONSTRAINT "agent_mandates_tenant_agent_fk" FOREIGN KEY ("tenant_id","agent_id") REFERENCES "public"."agents"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_mandates_tenant_agent_idx" ON "agent_mandates" USING btree ("tenant_id","agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_mandates_tenant_agent_revision_uq" ON "agent_mandates" USING btree ("tenant_id","agent_id","mandate_revision");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_mandates_decision_uq" ON "agent_mandates" USING btree ("governance_decision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_mandates_supersedes_uq" ON "agent_mandates" USING btree ("supersedes_mandate_id") WHERE "agent_mandates"."supersedes_mandate_id" is not null;