ALTER TYPE "public"."governance_domain" ADD VALUE 'media-asset-review';--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"invocation_id" uuid NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"byte_digest" char(64) NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"storage_backend" text NOT NULL,
	"storage_key" text NOT NULL,
	"admitted_at" timestamp with time zone NOT NULL,
	"asset_lifecycle_status" text DEFAULT 'admitted' NOT NULL,
	"retired_at" timestamp with time zone,
	"retired_by_actor_id" uuid,
	CONSTRAINT "media_assets_id_tenant_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "media_assets_mime_type_chk" CHECK ("media_assets"."mime_type" in ('image/png','image/jpeg','image/webp')),
	CONSTRAINT "media_assets_byte_size_chk" CHECK ("media_assets"."byte_size" between 1 and 20971520),
	CONSTRAINT "media_assets_byte_digest_chk" CHECK ("media_assets"."byte_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "media_assets_width_chk" CHECK ("media_assets"."width" between 1 and 8192),
	CONSTRAINT "media_assets_height_chk" CHECK ("media_assets"."height" between 1 and 8192),
	CONSTRAINT "media_assets_storage_backend_chk" CHECK ("media_assets"."storage_backend" ~ '^[a-z0-9-]{1,32}$'),
	CONSTRAINT "media_assets_storage_key_chk" CHECK ("media_assets"."storage_key" = 'tenants/' || "media_assets"."tenant_id"::text || '/media/' || "media_assets"."id"::text),
	CONSTRAINT "media_assets_lifecycle_chk" CHECK ("media_assets"."asset_lifecycle_status" in ('admitted','retired')),
	CONSTRAINT "media_assets_retirement_chk" CHECK (("media_assets"."asset_lifecycle_status" = 'retired') = ("media_assets"."retired_at" is not null and "media_assets"."retired_by_actor_id" is not null)
        and ("media_assets"."retired_at" is null) = ("media_assets"."retired_by_actor_id" is null))
);
--> statement-breakpoint
CREATE TABLE "media_generation_invocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"request_key" uuid NOT NULL,
	"requested_by_actor_type" "actor_type" NOT NULL,
	"requested_by_actor_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"source_artifact_id" uuid NOT NULL,
	"source_revision_no" integer NOT NULL,
	"prompt_text" text NOT NULL,
	"input_digest" char(64) NOT NULL,
	"transport" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"provider_job_id" text,
	"state" text NOT NULL,
	"admission_outcome" text DEFAULT 'not-attempted' NOT NULL,
	"admission_failure" text,
	"requested_at" timestamp with time zone NOT NULL,
	"finalized_at" timestamp with time zone,
	CONSTRAINT "media_generation_invocations_id_tenant_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "media_generation_invocations_human_requester_chk" CHECK ("media_generation_invocations"."requested_by_actor_type" = 'human'),
	CONSTRAINT "media_generation_invocations_revision_no_chk" CHECK ("media_generation_invocations"."source_revision_no" >= 1),
	CONSTRAINT "media_generation_invocations_prompt_chk" CHECK (char_length("media_generation_invocations"."prompt_text") between 1 and 4000),
	CONSTRAINT "media_generation_invocations_input_digest_chk" CHECK ("media_generation_invocations"."input_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "media_generation_invocations_transport_chk" CHECK ("media_generation_invocations"."transport" = 'fake'),
	CONSTRAINT "media_generation_invocations_state_chk" CHECK ("media_generation_invocations"."state" in ('registered','dispatch-failed','provider-failed','provider-succeeded')),
	CONSTRAINT "media_generation_invocations_admission_outcome_chk" CHECK ("media_generation_invocations"."admission_outcome" in ('not-attempted','admitted','refused','failed')),
	CONSTRAINT "media_generation_invocations_admission_requires_success_chk" CHECK ("media_generation_invocations"."admission_outcome" = 'not-attempted' or "media_generation_invocations"."state" = 'provider-succeeded'),
	CONSTRAINT "media_generation_invocations_admission_failure_chk" CHECK (("media_generation_invocations"."admission_failure" is not null) = ("media_generation_invocations"."admission_outcome" in ('refused','failed'))),
	CONSTRAINT "media_generation_invocations_finalized_chk" CHECK (("media_generation_invocations"."finalized_at" is null) = ("media_generation_invocations"."state" = 'registered'))
);
--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_tenant_invocation_fk" FOREIGN KEY ("tenant_id","invocation_id") REFERENCES "public"."media_generation_invocations"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_generation_invocations" ADD CONSTRAINT "media_generation_invocations_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_generation_invocations" ADD CONSTRAINT "media_generation_invocations_tenant_agent_fk" FOREIGN KEY ("tenant_id","agent_id") REFERENCES "public"."agents"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_generation_invocations" ADD CONSTRAINT "media_generation_invocations_source_revision_fk" FOREIGN KEY ("tenant_id","source_artifact_id","source_revision_no") REFERENCES "public"."work_artifact_revisions"("tenant_id","artifact_id","revision_no") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_invocation_uq" ON "media_assets" USING btree ("invocation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_storage_key_uq" ON "media_assets" USING btree ("storage_key");--> statement-breakpoint
CREATE UNIQUE INDEX "media_generation_invocations_request_key_uq" ON "media_generation_invocations" USING btree ("tenant_id","request_key");--> statement-breakpoint
CREATE INDEX "media_generation_invocations_source_idx" ON "media_generation_invocations" USING btree ("tenant_id","source_artifact_id","source_revision_no");