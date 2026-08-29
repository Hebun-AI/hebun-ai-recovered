CREATE TABLE "agent_improvement_hypotheses" (
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
	"improvement_target" text NOT NULL,
	"evidence_finding_key" text NOT NULL,
	"evidence_source" text NOT NULL,
	"evidence_observed_value" integer NOT NULL,
	"evidence_observed_total" integer NOT NULL,
	"evidence_observed_at" timestamp with time zone NOT NULL,
	"candidate_change" text NOT NULL,
	"expected_effect" text NOT NULL,
	"limitations" text NOT NULL,
	"proposed_by_actor_type" "actor_type" NOT NULL,
	"proposed_by_actor_id" uuid NOT NULL,
	"supersedes_hypothesis_id" uuid,
	CONSTRAINT "agent_improvement_hypotheses_target_chk" CHECK ("agent_improvement_hypotheses"."improvement_target" in ('selection-behaviour')),
	CONSTRAINT "agent_improvement_hypotheses_finding_chk" CHECK ("agent_improvement_hypotheses"."evidence_finding_key" in (
        'selection-invalid',
        'no-action',
        'dispatch-failed',
        'not-dispatched',
        'outcome-unrecorded',
        'filing-refused',
        'filing-failed',
        'provenance-coverage'
      )),
	CONSTRAINT "agent_improvement_hypotheses_observation_chk" CHECK ("agent_improvement_hypotheses"."evidence_observed_value" >= 0
          and "agent_improvement_hypotheses"."evidence_observed_total" >= 0
          and "agent_improvement_hypotheses"."evidence_observed_value" <= "agent_improvement_hypotheses"."evidence_observed_total"),
	CONSTRAINT "agent_improvement_hypotheses_human_author_chk" CHECK ("agent_improvement_hypotheses"."proposed_by_actor_type" = 'human'),
	CONSTRAINT "agent_improvement_hypotheses_supersedes_not_self_chk" CHECK ("agent_improvement_hypotheses"."supersedes_hypothesis_id" is null or "agent_improvement_hypotheses"."supersedes_hypothesis_id" <> "agent_improvement_hypotheses"."id")
);
--> statement-breakpoint
ALTER TABLE "agent_improvement_hypotheses" ADD CONSTRAINT "agent_improvement_hypotheses_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_improvement_hypotheses" ADD CONSTRAINT "agent_improvement_hypotheses_supersedes_hypothesis_id_agent_improvement_hypotheses_id_fk" FOREIGN KEY ("supersedes_hypothesis_id") REFERENCES "public"."agent_improvement_hypotheses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_improvement_hypotheses" ADD CONSTRAINT "agent_improvement_hypotheses_tenant_agent_fk" FOREIGN KEY ("tenant_id","agent_id") REFERENCES "public"."agents"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_improvement_hypotheses_tenant_agent_idx" ON "agent_improvement_hypotheses" USING btree ("tenant_id","agent_id");--> statement-breakpoint
CREATE INDEX "agent_improvement_hypotheses_tenant_time_idx" ON "agent_improvement_hypotheses" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_improvement_hypotheses_supersedes_idx" ON "agent_improvement_hypotheses" USING btree ("supersedes_hypothesis_id");