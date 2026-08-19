CREATE TABLE "heby_answer_source_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"source_class" text NOT NULL,
	"record_ref" text NOT NULL,
	"label" text NOT NULL,
	"detail" text NOT NULL,
	"authoritative" boolean NOT NULL,
	"ordinal" integer NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "heby_answer_source_evidence_not_knowledge_chk" CHECK ("heby_answer_source_evidence"."source_class" <> 'knowledge')
);
--> statement-breakpoint
ALTER TABLE "heby_answer_source_evidence" ADD CONSTRAINT "heby_answer_source_evidence_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heby_answer_source_evidence" ADD CONSTRAINT "heby_answer_source_evidence_tenant_message_fk" FOREIGN KEY ("message_id","tenant_id") REFERENCES "public"."messages"("id","tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "heby_answer_source_evidence_message_record_uidx" ON "heby_answer_source_evidence" USING btree ("message_id","source_class","record_ref");