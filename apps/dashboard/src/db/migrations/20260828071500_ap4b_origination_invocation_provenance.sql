CREATE TABLE "heby_origination_invocations" (
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
	"transport" text NOT NULL,
	"state" text NOT NULL,
	"failure_code" text,
	"provider" text,
	"model" text,
	"provider_request_id" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"filing_outcome" text DEFAULT 'not-attempted' NOT NULL,
	"filing_refusal" text,
	"finalized_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "heby_origination_invocations" ADD CONSTRAINT "heby_origination_invocations_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "heby_origination_invocations_tenant_time_idx" ON "heby_origination_invocations" USING btree ("tenant_id","created_at");--> statement-breakpoint
ALTER TABLE "heby_origination_invocations" ADD CONSTRAINT "heby_origination_invocations_state_chk" CHECK ("heby_origination_invocations"."state" in ('registered','not-dispatched','dispatch-failed','selection-invalid','no-action','selection-valid'));--> statement-breakpoint
ALTER TABLE "heby_origination_invocations" ADD CONSTRAINT "heby_origination_invocations_transport_chk" CHECK ("heby_origination_invocations"."transport" in ('fake','live'));--> statement-breakpoint
ALTER TABLE "heby_origination_invocations" ADD CONSTRAINT "heby_origination_invocations_filing_outcome_chk" CHECK ("heby_origination_invocations"."filing_outcome" in ('not-attempted','proposed','refused','failed'));--> statement-breakpoint
ALTER TABLE "heby_origination_invocations" ADD CONSTRAINT "heby_origination_invocations_filing_refusal_chk" CHECK (("heby_origination_invocations"."filing_refusal" is null) or ("heby_origination_invocations"."filing_outcome" = 'refused'));--> statement-breakpoint
ALTER TABLE "heby_action_requests" ADD COLUMN "origination_invocation_id" uuid;
