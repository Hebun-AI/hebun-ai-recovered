CREATE TABLE "scheduled_research_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"standing_authorization_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"status" text NOT NULL,
	"failure_reason" text,
	"artifact_id" uuid,
	"correlation_id" text,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "scheduled_research_runs_status_chk" CHECK ("scheduled_research_runs"."status" in ('claimed', 'filed', 'failed')),
	CONSTRAINT "scheduled_research_runs_outcome_chk" CHECK (("scheduled_research_runs"."status" = 'claimed' and "scheduled_research_runs"."finished_at" is null and "scheduled_research_runs"."artifact_id" is null and "scheduled_research_runs"."failure_reason" is null)
        or ("scheduled_research_runs"."status" = 'filed' and "scheduled_research_runs"."finished_at" is not null and "scheduled_research_runs"."artifact_id" is not null and "scheduled_research_runs"."failure_reason" is null)
        or ("scheduled_research_runs"."status" = 'failed' and "scheduled_research_runs"."finished_at" is not null and "scheduled_research_runs"."artifact_id" is null and char_length("scheduled_research_runs"."failure_reason") between 1 and 120))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "standing_research_authorizations_tenant_id_uq" ON "standing_research_authorizations" USING btree ("tenant_id","id");--> statement-breakpoint
ALTER TABLE "scheduled_research_runs" ADD CONSTRAINT "scheduled_research_runs_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_research_runs" ADD CONSTRAINT "scheduled_research_runs_tenant_authorization_fk" FOREIGN KEY ("tenant_id","standing_authorization_id") REFERENCES "public"."standing_research_authorizations"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_research_runs" ADD CONSTRAINT "scheduled_research_runs_tenant_artifact_fk" FOREIGN KEY ("tenant_id","artifact_id") REFERENCES "public"."work_artifacts"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "scheduled_research_runs_day_uq" ON "scheduled_research_runs" USING btree ("tenant_id","standing_authorization_id","local_date");--> statement-breakpoint
CREATE INDEX "scheduled_research_runs_tenant_date_idx" ON "scheduled_research_runs" USING btree ("tenant_id","local_date");