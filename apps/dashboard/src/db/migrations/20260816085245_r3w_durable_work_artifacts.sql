CREATE TYPE "public"."work_artifact_lifecycle_status" AS ENUM('draft', 'retired');--> statement-breakpoint
CREATE TYPE "public"."work_artifact_type" AS ENUM('operational-plan', 'message-draft');--> statement-breakpoint
CREATE TABLE "work_artifact_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"artifact_id" uuid NOT NULL,
	"revision_no" integer NOT NULL,
	"content" text NOT NULL,
	"content_digest" char(64) NOT NULL,
	"authored_by_actor_type" "actor_type" NOT NULL,
	"authored_by_actor_id" uuid NOT NULL,
	"source_message_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_artifact_revisions_revision_no_chk" CHECK ("work_artifact_revisions"."revision_no" >= 1),
	CONSTRAINT "work_artifact_revisions_digest_chk" CHECK ("work_artifact_revisions"."content_digest" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "work_artifacts" (
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
	"artifact_type" "work_artifact_type" NOT NULL,
	"title" text NOT NULL,
	"artifact_lifecycle_status" "work_artifact_lifecycle_status" DEFAULT 'draft' NOT NULL,
	"owner_workspace" text NOT NULL,
	"current_revision" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "work_artifacts_current_revision_chk" CHECK ("work_artifacts"."current_revision" >= 1),
	CONSTRAINT "work_artifacts_title_chk" CHECK (char_length(btrim("work_artifacts"."title")) > 0)
);
--> statement-breakpoint
ALTER TABLE "work_artifact_revisions" ADD CONSTRAINT "work_artifact_revisions_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_artifacts" ADD CONSTRAINT "work_artifacts_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
--
-- STATEMENT ORDER IS LOAD-BEARING, and drizzle-kit emitted it wrong. AGAIN — this is the third
-- time (KR5, R3A, now R3W), and the shape of the defect is identical every time.
--
-- The composite foreign key below names work_artifacts(tenant_id, id) as its target, and
-- PostgreSQL will only accept that against a unique constraint that ALREADY EXISTS on exactly
-- those columns. Generated order put every CREATE UNIQUE INDEX after every ALTER TABLE, so the
-- constraint failed with
--
--   there is no unique constraint matching given keys for referenced table "work_artifacts"
--
-- proven on a disposable database, against all 26 prior migrations, before this file was touched.
-- The index is therefore hoisted above the constraint that depends on it. Nothing else about the
-- generated file changed: same statements, same names, same semantics, different order.
--
CREATE UNIQUE INDEX "work_artifacts_tenant_id_uq" ON "work_artifacts" USING btree ("tenant_id","id");--> statement-breakpoint
ALTER TABLE "work_artifact_revisions" ADD CONSTRAINT "work_artifact_revisions_tenant_artifact_fk" FOREIGN KEY ("tenant_id","artifact_id") REFERENCES "public"."work_artifacts"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_artifact_revisions" ADD CONSTRAINT "work_artifact_revisions_tenant_message_fk" FOREIGN KEY ("source_message_id","tenant_id") REFERENCES "public"."messages"("id","tenant_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "work_artifact_revisions_artifact_revision_uq" ON "work_artifact_revisions" USING btree ("tenant_id","artifact_id","revision_no");--> statement-breakpoint
CREATE INDEX "work_artifacts_tenant_lifecycle_idx" ON "work_artifacts" USING btree ("tenant_id","artifact_lifecycle_status");--> statement-breakpoint
CREATE INDEX "work_artifacts_tenant_type_idx" ON "work_artifacts" USING btree ("tenant_id","artifact_type");