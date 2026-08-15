CREATE TABLE "heby_answer_evidence_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"evidence_set_id" uuid NOT NULL,
	"fact_id" uuid NOT NULL,
	"knowledge_node_id" uuid,
	"domain_key" text NOT NULL,
	"fact_key" text NOT NULL,
	"scope" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text,
	"excerpt_truncated" boolean DEFAULT false NOT NULL,
	"authority_class" text,
	"lifecycle_status" text,
	"ratified" boolean DEFAULT false NOT NULL,
	"ratified_at" timestamp with time zone,
	"freshness" text NOT NULL,
	"knowledge_version" integer NOT NULL,
	"fact_version" integer NOT NULL,
	"effective_from" timestamp with time zone,
	"effective_until" timestamp with time zone,
	"next_review_at" timestamp with time zone,
	"origin" text,
	"authored_through" text,
	"text_origin_unverified" boolean,
	"source_title" text,
	"source_type" text,
	"ingested_by_actor_type" text,
	"ingested_at" timestamp with time zone,
	"chunk_index" integer,
	"chunk_count" integer,
	"matched_terms" text[] DEFAULT '{}' NOT NULL,
	"ordinal" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "heby_answer_evidence_set" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"status" text NOT NULL,
	"truncated" boolean DEFAULT false NOT NULL,
	"diversity_pruned" integer DEFAULT 0 NOT NULL,
	"excluded_count" integer DEFAULT 0 NOT NULL,
	"degraded_reason" text,
	"multiple_relevant_sources" boolean DEFAULT false NOT NULL,
	"unavailable_reason" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "heby_answer_evidence_item" ADD CONSTRAINT "heby_answer_evidence_item_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heby_answer_evidence_item" ADD CONSTRAINT "heby_answer_evidence_item_evidence_set_id_heby_answer_evidence_set_id_fk" FOREIGN KEY ("evidence_set_id") REFERENCES "public"."heby_answer_evidence_set"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heby_answer_evidence_set" ADD CONSTRAINT "heby_answer_evidence_set_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
--
-- STATEMENT ORDER IS LOAD-BEARING, and drizzle-kit emitted it wrong.
--
-- The composite foreign key below names messages(id, tenant_id) as its target, and PostgreSQL will
-- only accept that against a unique constraint that ALREADY EXISTS on exactly those columns.
-- Generated order put the CREATE UNIQUE INDEX last, so the ALTER TABLE failed with
-- "there is no unique constraint matching given keys for referenced table". The index is therefore
-- hoisted above the constraint that depends on it. Nothing else about the generated file changed.
--
CREATE UNIQUE INDEX "messages_id_tenant_uidx" ON "messages" USING btree ("id","tenant_id");--> statement-breakpoint
ALTER TABLE "heby_answer_evidence_set" ADD CONSTRAINT "heby_answer_evidence_set_tenant_message_fk" FOREIGN KEY ("message_id","tenant_id") REFERENCES "public"."messages"("id","tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "heby_answer_evidence_item_set_record_uidx" ON "heby_answer_evidence_item" USING btree ("evidence_set_id","domain_key","fact_key");--> statement-breakpoint
CREATE INDEX "heby_answer_evidence_item_set_ordinal_idx" ON "heby_answer_evidence_item" USING btree ("evidence_set_id","ordinal");--> statement-breakpoint
CREATE UNIQUE INDEX "heby_answer_evidence_set_message_uidx" ON "heby_answer_evidence_set" USING btree ("message_id");