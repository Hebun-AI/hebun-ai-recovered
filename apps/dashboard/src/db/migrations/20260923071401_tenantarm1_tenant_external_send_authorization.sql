CREATE TYPE "public"."tenant_external_send_state" AS ENUM('active', 'withdrawn');--> statement-breakpoint
ALTER TYPE "public"."governance_domain" ADD VALUE 'external-send';--> statement-breakpoint
CREATE TABLE "tenant_external_send_authorizations" (
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
	"state" "tenant_external_send_state" NOT NULL,
	"governance_decision_id" uuid NOT NULL,
	"governance_session_id" uuid NOT NULL,
	"authorized_by_actor_type" "actor_type" NOT NULL,
	"authorized_by_actor_id" uuid NOT NULL,
	"authorized_at" timestamp with time zone NOT NULL,
	"supersedes_authorization_id" uuid,
	CONSTRAINT "tenant_external_send_authorizations_human_authorizer_chk" CHECK ("tenant_external_send_authorizations"."authorized_by_actor_type" = 'human'),
	CONSTRAINT "tenant_external_send_authorizations_revision_chk" CHECK ("tenant_external_send_authorizations"."authorization_revision" >= 1),
	CONSTRAINT "tenant_external_send_authorizations_lineage_chk" CHECK (("tenant_external_send_authorizations"."authorization_revision" = 1) = ("tenant_external_send_authorizations"."supersedes_authorization_id" is null)),
	CONSTRAINT "tenant_external_send_authorizations_supersedes_not_self_chk" CHECK ("tenant_external_send_authorizations"."supersedes_authorization_id" is null or "tenant_external_send_authorizations"."supersedes_authorization_id" <> "tenant_external_send_authorizations"."id"),
	CONSTRAINT "tenant_external_send_authorizations_first_revision_active_chk" CHECK ("tenant_external_send_authorizations"."authorization_revision" > 1 or "tenant_external_send_authorizations"."state" = 'active')
);
--> statement-breakpoint
ALTER TABLE "tenant_external_send_authorizations" ADD CONSTRAINT "tenant_external_send_authorizations_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_external_send_authorizations" ADD CONSTRAINT "tenant_external_send_authorizations_governance_decision_id_decision_records_id_fk" FOREIGN KEY ("governance_decision_id") REFERENCES "public"."decision_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_external_send_authorizations" ADD CONSTRAINT "tenant_external_send_authorizations_governance_session_id_governance_sessions_id_fk" FOREIGN KEY ("governance_session_id") REFERENCES "public"."governance_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_external_send_authorizations" ADD CONSTRAINT "tenant_external_send_authorizations_supersedes_authorization_id_tenant_external_send_authorizations_id_fk" FOREIGN KEY ("supersedes_authorization_id") REFERENCES "public"."tenant_external_send_authorizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_external_send_authorizations_lineage_revision_uq" ON "tenant_external_send_authorizations" USING btree ("tenant_id","authorization_revision");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_external_send_authorizations_decision_uq" ON "tenant_external_send_authorizations" USING btree ("governance_decision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_external_send_authorizations_supersedes_uq" ON "tenant_external_send_authorizations" USING btree ("supersedes_authorization_id") WHERE "tenant_external_send_authorizations"."supersedes_authorization_id" is not null;--> statement-breakpoint
CREATE INDEX "tenant_external_send_authorizations_tenant_state_idx" ON "tenant_external_send_authorizations" USING btree ("tenant_id","state");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_external_send_authorizations_id_tenant_uq" ON "tenant_external_send_authorizations" USING btree ("id","tenant_id");