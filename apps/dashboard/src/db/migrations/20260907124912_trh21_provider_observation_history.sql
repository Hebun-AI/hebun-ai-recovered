CREATE TABLE "provider_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"integration_id" uuid NOT NULL,
	"provider_key" text NOT NULL,
	"capability_key" text NOT NULL,
	"subject_kind" text NOT NULL,
	"subject_ref" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"observed_by_actor_type" "actor_type" NOT NULL,
	"observed_by_actor_id" uuid NOT NULL,
	"facts" jsonb NOT NULL,
	"facts_digest" char(64) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "provider_observations" ADD CONSTRAINT "provider_observations_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_observations" ADD CONSTRAINT "provider_observations_tenant_integration_fk" FOREIGN KEY ("integration_id","tenant_id") REFERENCES "public"."integrations"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "provider_observations_subject_instant_uidx" ON "provider_observations" USING btree ("tenant_id","provider_key","subject_ref","observed_at");--> statement-breakpoint
CREATE INDEX "provider_observations_tenant_observed_at_idx" ON "provider_observations" USING btree ("tenant_id","observed_at");