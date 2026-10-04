CREATE TYPE "public"."processor_attestation_state" AS ENUM('active', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."tenant_external_ai_data_use_state" AS ENUM('active', 'withdrawn');--> statement-breakpoint
ALTER TYPE "public"."governance_domain" ADD VALUE 'external-ai-data-use';--> statement-breakpoint
CREATE TABLE "processor_attestations" (
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
	"service_scope" text NOT NULL,
	"account_ref" text NOT NULL,
	"attestation_revision" integer NOT NULL,
	"state" "processor_attestation_state" NOT NULL,
	"identity_status" text NOT NULL,
	"contract_surface" text NOT NULL,
	"training" text NOT NULL,
	"retention_class" text NOT NULL,
	"zdr" text NOT NULL,
	"model_treatment_class" text NOT NULL,
	"model_ids" text[] NOT NULL,
	"region" text,
	"evidence_refs" text[] NOT NULL,
	"reviewed_record_ref" text NOT NULL,
	"attested_at" timestamp with time zone NOT NULL,
	"control_source" text NOT NULL,
	"supersedes_attestation_id" uuid,
	CONSTRAINT "processor_attestations_revision_chk" CHECK ("processor_attestations"."attestation_revision" >= 1),
	CONSTRAINT "processor_attestations_lineage_chk" CHECK (("processor_attestations"."attestation_revision" = 1) = ("processor_attestations"."supersedes_attestation_id" is null)),
	CONSTRAINT "processor_attestations_supersedes_not_self_chk" CHECK ("processor_attestations"."supersedes_attestation_id" is null or "processor_attestations"."supersedes_attestation_id" <> "processor_attestations"."id"),
	CONSTRAINT "processor_attestations_first_revision_active_chk" CHECK ("processor_attestations"."attestation_revision" > 1 or "processor_attestations"."state" = 'active'),
	CONSTRAINT "processor_attestations_service_scope_chk" CHECK ("processor_attestations"."service_scope" in ('anthropic/messages', 'openai/images.generations', 'openai/images.edits', 'higgsfield/pixverse-v6/text-to-video', 'higgsfield/pixverse-v6/image-to-video')),
	CONSTRAINT "processor_attestations_account_ref_chk" CHECK (char_length(btrim("processor_attestations"."account_ref")) between 1 and 200),
	CONSTRAINT "processor_attestations_identity_chk" CHECK ("processor_attestations"."identity_status" in ('verified', 'attested')),
	CONSTRAINT "processor_attestations_contract_chk" CHECK ("processor_attestations"."contract_surface" in ('anthropic-commercial-terms', 'openai-services-agreement', 'higgsfield-terms-of-use', 'higgsfield-enterprise-agreement')),
	CONSTRAINT "processor_attestations_training_chk" CHECK ("processor_attestations"."training" in ('none', 'customer-opt-in', 'provider-default')),
	CONSTRAINT "processor_attestations_retention_chk" CHECK ("processor_attestations"."retention_class" in ('zero-data-retention', 'bounded-30-days', 'extended')),
	CONSTRAINT "processor_attestations_zdr_chk" CHECK ("processor_attestations"."zdr" in ('enabled', 'not-enabled')),
	CONSTRAINT "processor_attestations_model_chk" CHECK (char_length(btrim("processor_attestations"."model_treatment_class")) > 0 and cardinality("processor_attestations"."model_ids") >= 1),
	CONSTRAINT "processor_attestations_evidence_chk" CHECK (cardinality("processor_attestations"."evidence_refs") >= 1 and char_length(btrim("processor_attestations"."reviewed_record_ref")) > 0),
	CONSTRAINT "processor_attestations_control_source_chk" CHECK ("processor_attestations"."control_source" in ('local-operator-ceremony', 'production-operator-ceremony'))
);
--> statement-breakpoint
CREATE TABLE "tenant_ai_data_use_scopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"authorization_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"data_class" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_ai_data_use_scopes_purpose_chk" CHECK ("tenant_ai_data_use_scopes"."purpose" in ('assistance', 'relevance-selection', 'agent-origination', 'media-generation')),
	CONSTRAINT "tenant_ai_data_use_scopes_data_class_chk" CHECK ("tenant_ai_data_use_scopes"."data_class" in ('conversation', 'knowledge', 'work-artifact', 'organization', 'governance-record', 'operational-record', 'provider-observation', 'external-recipient', 'media-generated', 'media-supplied'))
);
--> statement-breakpoint
CREATE TABLE "tenant_ai_data_use_authorizations" (
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
	"state" "tenant_external_ai_data_use_state" NOT NULL,
	"service_scope" text NOT NULL,
	"account_ref" text NOT NULL,
	"bound_processor_attestation_id" uuid,
	"governance_decision_id" uuid NOT NULL,
	"governance_session_id" uuid NOT NULL,
	"authorized_by_actor_type" "actor_type" NOT NULL,
	"authorized_by_actor_id" uuid NOT NULL,
	"authorized_at" timestamp with time zone NOT NULL,
	"supersedes_authorization_id" uuid,
	CONSTRAINT "tenant_ai_data_use_authorizations_bound_attestation_chk" CHECK (("tenant_ai_data_use_authorizations"."state" = 'active') = ("tenant_ai_data_use_authorizations"."bound_processor_attestation_id" is not null)),
	CONSTRAINT "tenant_ai_data_use_authorizations_human_authorizer_chk" CHECK ("tenant_ai_data_use_authorizations"."authorized_by_actor_type" = 'human'),
	CONSTRAINT "tenant_ai_data_use_authorizations_revision_chk" CHECK ("tenant_ai_data_use_authorizations"."authorization_revision" >= 1),
	CONSTRAINT "tenant_ai_data_use_authorizations_lineage_chk" CHECK (("tenant_ai_data_use_authorizations"."authorization_revision" = 1) = ("tenant_ai_data_use_authorizations"."supersedes_authorization_id" is null)),
	CONSTRAINT "tenant_ai_data_use_authorizations_supersedes_not_self_chk" CHECK ("tenant_ai_data_use_authorizations"."supersedes_authorization_id" is null or "tenant_ai_data_use_authorizations"."supersedes_authorization_id" <> "tenant_ai_data_use_authorizations"."id"),
	CONSTRAINT "tenant_ai_data_use_authorizations_first_revision_active_chk" CHECK ("tenant_ai_data_use_authorizations"."authorization_revision" > 1 or "tenant_ai_data_use_authorizations"."state" = 'active'),
	CONSTRAINT "tenant_ai_data_use_authorizations_service_scope_chk" CHECK ("tenant_ai_data_use_authorizations"."service_scope" in ('anthropic/messages', 'openai/images.generations', 'openai/images.edits', 'higgsfield/pixverse-v6/text-to-video', 'higgsfield/pixverse-v6/image-to-video')),
	CONSTRAINT "tenant_ai_data_use_authorizations_account_ref_chk" CHECK (char_length(btrim("tenant_ai_data_use_authorizations"."account_ref")) between 1 and 200)
);
--> statement-breakpoint
ALTER TABLE "processor_attestations" ADD CONSTRAINT "processor_attestations_supersedes_attestation_id_processor_attestations_id_fk" FOREIGN KEY ("supersedes_attestation_id") REFERENCES "public"."processor_attestations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_ai_data_use_authorizations" ADD CONSTRAINT "tenant_ai_data_use_authorizations_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_ai_data_use_authorizations" ADD CONSTRAINT "tenant_ai_data_use_authorizations_governance_decision_id_decision_records_id_fk" FOREIGN KEY ("governance_decision_id") REFERENCES "public"."decision_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_ai_data_use_authorizations" ADD CONSTRAINT "tenant_ai_data_use_authorizations_governance_session_id_governance_sessions_id_fk" FOREIGN KEY ("governance_session_id") REFERENCES "public"."governance_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_ai_data_use_authorizations" ADD CONSTRAINT "tenant_ai_data_use_authorizations_supersedes_authorization_id_tenant_ai_data_use_authorizations_id_fk" FOREIGN KEY ("supersedes_authorization_id") REFERENCES "public"."tenant_ai_data_use_authorizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "processor_attestations_lineage_revision_uq" ON "processor_attestations" USING btree ("service_scope","account_ref","attestation_revision");--> statement-breakpoint
CREATE UNIQUE INDEX "processor_attestations_supersedes_uq" ON "processor_attestations" USING btree ("supersedes_attestation_id") WHERE "processor_attestations"."supersedes_attestation_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "processor_attestations_id_lineage_uq" ON "processor_attestations" USING btree ("id","service_scope","account_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_ai_data_use_scopes_pair_uq" ON "tenant_ai_data_use_scopes" USING btree ("authorization_id","purpose","data_class");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_ai_data_use_authorizations_lineage_revision_uq" ON "tenant_ai_data_use_authorizations" USING btree ("tenant_id","service_scope","account_ref","authorization_revision");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_ai_data_use_authorizations_decision_uq" ON "tenant_ai_data_use_authorizations" USING btree ("governance_decision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_ai_data_use_authorizations_supersedes_uq" ON "tenant_ai_data_use_authorizations" USING btree ("supersedes_authorization_id") WHERE "tenant_ai_data_use_authorizations"."supersedes_authorization_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_ai_data_use_authorizations_id_tenant_uq" ON "tenant_ai_data_use_authorizations" USING btree ("id","tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_ai_data_use_authorizations_tenant_state_idx" ON "tenant_ai_data_use_authorizations" USING btree ("tenant_id","state");--> statement-breakpoint
ALTER TABLE "tenant_ai_data_use_scopes" ADD CONSTRAINT "tenant_ai_data_use_scopes_authorization_fk" FOREIGN KEY ("authorization_id","tenant_id") REFERENCES "public"."tenant_ai_data_use_authorizations"("id","tenant_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_ai_data_use_authorizations" ADD CONSTRAINT "tenant_ai_data_use_authorizations_bound_attestation_fk" FOREIGN KEY ("bound_processor_attestation_id","service_scope","account_ref") REFERENCES "public"."processor_attestations"("id","service_scope","account_ref") ON DELETE restrict ON UPDATE no action;