CREATE TABLE "work_evidence_references" (
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
	"work_item_id" uuid NOT NULL,
	"knowledge_fact_id" uuid,
	"work_artifact_id" uuid,
	"declared_at" timestamp with time zone DEFAULT now() NOT NULL,
	"declared_by" uuid NOT NULL,
	"declared_by_type" "actor_type" NOT NULL,
	"withdrawn_at" timestamp with time zone,
	"withdrawn_by" uuid,
	"withdrawn_by_type" "actor_type",
	CONSTRAINT "work_evidence_references_one_referent_chk" CHECK ((case when "work_evidence_references"."knowledge_fact_id" is null then 0 else 1 end)
          + (case when "work_evidence_references"."work_artifact_id" is null then 0 else 1 end) = 1),
	CONSTRAINT "work_evidence_references_human_declarer_chk" CHECK ("work_evidence_references"."declared_by_type" = 'human'),
	CONSTRAINT "work_evidence_references_withdrawal_pair_chk" CHECK (("work_evidence_references"."withdrawn_at" is null) = ("work_evidence_references"."withdrawn_by" is null)
          and ("work_evidence_references"."withdrawn_at" is null) = ("work_evidence_references"."withdrawn_by_type" is null))
);
--> statement-breakpoint
ALTER TABLE "work_evidence_references" ADD CONSTRAINT "work_evidence_references_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_evidence_references" ADD CONSTRAINT "work_evidence_references_tenant_work_fk" FOREIGN KEY ("tenant_id","work_item_id") REFERENCES "public"."work_items"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_evidence_references" ADD CONSTRAINT "work_evidence_references_tenant_fact_fk" FOREIGN KEY ("knowledge_fact_id","tenant_id") REFERENCES "public"."knowledge_facts"("id","tenant_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_evidence_references" ADD CONSTRAINT "work_evidence_references_tenant_artifact_fk" FOREIGN KEY ("tenant_id","work_artifact_id") REFERENCES "public"."work_artifacts"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "work_evidence_references_current_fact_uidx" ON "work_evidence_references" USING btree ("tenant_id","work_item_id","knowledge_fact_id") WHERE "work_evidence_references"."withdrawn_at" is null and "work_evidence_references"."knowledge_fact_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "work_evidence_references_current_artifact_uidx" ON "work_evidence_references" USING btree ("tenant_id","work_item_id","work_artifact_id") WHERE "work_evidence_references"."withdrawn_at" is null and "work_evidence_references"."work_artifact_id" is not null;--> statement-breakpoint
CREATE INDEX "work_evidence_references_tenant_work_idx" ON "work_evidence_references" USING btree ("tenant_id","work_item_id");--> statement-breakpoint
CREATE INDEX "work_evidence_references_tenant_fact_idx" ON "work_evidence_references" USING btree ("tenant_id","knowledge_fact_id");--> statement-breakpoint
CREATE INDEX "work_evidence_references_tenant_artifact_idx" ON "work_evidence_references" USING btree ("tenant_id","work_artifact_id");