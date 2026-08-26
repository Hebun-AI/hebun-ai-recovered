CREATE TABLE "knowledge_external_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"knowledge_fact_id" uuid NOT NULL,
	"provider_key" text NOT NULL,
	"capability" text NOT NULL,
	"record_type" text NOT NULL,
	"record_id" text NOT NULL,
	"declared_at" timestamp with time zone DEFAULT now() NOT NULL,
	"declared_by" uuid NOT NULL,
	"declared_by_type" "actor_type" NOT NULL,
	"withdrawn_at" timestamp with time zone,
	"withdrawn_by" uuid,
	"withdrawn_by_type" "actor_type",
	CONSTRAINT "knowledge_external_references_human_declarer_chk" CHECK ("knowledge_external_references"."declared_by_type" = 'human'),
	CONSTRAINT "knowledge_external_references_human_withdrawer_chk" CHECK ("knowledge_external_references"."withdrawn_by_type" is null or "knowledge_external_references"."withdrawn_by_type" = 'human'),
	CONSTRAINT "knowledge_external_references_withdrawal_pair_chk" CHECK (("knowledge_external_references"."withdrawn_at" is null) = ("knowledge_external_references"."withdrawn_by" is null)
          and ("knowledge_external_references"."withdrawn_by" is null) = ("knowledge_external_references"."withdrawn_by_type" is null)),
	CONSTRAINT "knowledge_external_references_bounded_identity_chk" CHECK (length("knowledge_external_references"."provider_key") between 1 and 64
          and length("knowledge_external_references"."capability") between 1 and 128
          and length("knowledge_external_references"."record_type") between 1 and 64
          and length("knowledge_external_references"."record_id") between 1 and 128
          and "knowledge_external_references"."provider_key" !~ '\s'
          and "knowledge_external_references"."capability" !~ '\s'
          and "knowledge_external_references"."record_type" !~ '\s'
          and "knowledge_external_references"."record_id" !~ '\s')
);
--> statement-breakpoint
ALTER TABLE "knowledge_external_references" ADD CONSTRAINT "knowledge_external_references_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_facts_id_tenant_uidx" ON "knowledge_facts" USING btree ("id","tenant_id");
--> statement-breakpoint
ALTER TABLE "knowledge_external_references" ADD CONSTRAINT "knowledge_external_references_tenant_fact_fk" FOREIGN KEY ("knowledge_fact_id","tenant_id") REFERENCES "public"."knowledge_facts"("id","tenant_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_external_references_live_uidx" ON "knowledge_external_references" USING btree ("tenant_id","knowledge_fact_id","provider_key","capability","record_type","record_id") WHERE "knowledge_external_references"."withdrawn_at" is null;
--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_external_references_record_fact_uidx" ON "knowledge_external_references" USING btree ("tenant_id","provider_key","capability","record_type","record_id","knowledge_fact_id") WHERE "knowledge_external_references"."withdrawn_at" is null;
