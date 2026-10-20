CREATE TABLE "heby_action_request_source_work_items" (
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
	"action_request_id" uuid NOT NULL,
	"work_item_id" uuid NOT NULL,
	"ordinal" smallint NOT NULL,
	CONSTRAINT "heby_action_request_source_work_items_ordinal_chk" CHECK ("heby_action_request_source_work_items"."ordinal" >= 0 and "heby_action_request_source_work_items"."ordinal" < 40)
);
--> statement-breakpoint
CREATE TABLE "work_item_follow_up_sources" (
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
	"source_work_item_id" uuid NOT NULL,
	"action_request_id" uuid NOT NULL,
	"ordinal" smallint NOT NULL,
	CONSTRAINT "work_item_follow_up_sources_not_self_chk" CHECK ("work_item_follow_up_sources"."work_item_id" <> "work_item_follow_up_sources"."source_work_item_id"),
	CONSTRAINT "work_item_follow_up_sources_ordinal_chk" CHECK ("work_item_follow_up_sources"."ordinal" >= 0 and "work_item_follow_up_sources"."ordinal" < 40)
);
--> statement-breakpoint
ALTER TABLE "heby_action_request_source_work_items" ADD CONSTRAINT "heby_action_request_source_work_items_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heby_action_request_source_work_items" ADD CONSTRAINT "heby_action_request_source_work_items_tenant_request_fk" FOREIGN KEY ("tenant_id","action_request_id") REFERENCES "public"."heby_action_requests"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heby_action_request_source_work_items" ADD CONSTRAINT "heby_action_request_source_work_items_tenant_work_fk" FOREIGN KEY ("tenant_id","work_item_id") REFERENCES "public"."work_items"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item_follow_up_sources" ADD CONSTRAINT "work_item_follow_up_sources_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item_follow_up_sources" ADD CONSTRAINT "work_item_follow_up_sources_tenant_work_fk" FOREIGN KEY ("tenant_id","work_item_id") REFERENCES "public"."work_items"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item_follow_up_sources" ADD CONSTRAINT "work_item_follow_up_sources_tenant_source_fk" FOREIGN KEY ("tenant_id","source_work_item_id") REFERENCES "public"."work_items"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item_follow_up_sources" ADD CONSTRAINT "work_item_follow_up_sources_tenant_request_fk" FOREIGN KEY ("tenant_id","action_request_id") REFERENCES "public"."heby_action_requests"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "heby_action_request_source_work_items_request_work_uq" ON "heby_action_request_source_work_items" USING btree ("action_request_id","work_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "heby_action_request_source_work_items_request_ordinal_uq" ON "heby_action_request_source_work_items" USING btree ("action_request_id","ordinal");--> statement-breakpoint
CREATE INDEX "heby_action_request_source_work_items_tenant_work_idx" ON "heby_action_request_source_work_items" USING btree ("tenant_id","work_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_item_follow_up_sources_work_source_uq" ON "work_item_follow_up_sources" USING btree ("work_item_id","source_work_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_item_follow_up_sources_work_ordinal_uq" ON "work_item_follow_up_sources" USING btree ("work_item_id","ordinal");--> statement-breakpoint
CREATE INDEX "work_item_follow_up_sources_tenant_source_idx" ON "work_item_follow_up_sources" USING btree ("tenant_id","source_work_item_id");--> statement-breakpoint
-- The pair FK targets heby_action_request_source_work_items_request_work_uq, so it is added after that index exists.
ALTER TABLE "work_item_follow_up_sources" ADD CONSTRAINT "work_item_follow_up_sources_request_source_fk" FOREIGN KEY ("action_request_id","source_work_item_id") REFERENCES "public"."heby_action_request_source_work_items"("action_request_id","work_item_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
-- PLAN-FOLLOW-UP-REFERENCE-V1 — provenance is INSERT-ONLY.
--
-- A recorded source relationship is evidence of what a human requested and what the work authority
-- recorded. No authority in the repository updates or removes one, so the database refuses every
-- UPDATE, DELETE and TRUNCATE on both tables. Rows are protected from installation forward; the
-- tables are new, so that is every row. The trigger decides nothing about who may create a row.
CREATE FUNCTION "public"."follow_up_source_work_refuse_change"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '%: follow-up provenance is insert-only (%)', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;--> statement-breakpoint
CREATE TRIGGER "heby_action_request_source_work_items_insert_only"
  BEFORE UPDATE OR DELETE ON "heby_action_request_source_work_items"
  FOR EACH ROW EXECUTE FUNCTION "public"."follow_up_source_work_refuse_change"();--> statement-breakpoint
CREATE TRIGGER "heby_action_request_source_work_items_no_truncate"
  BEFORE TRUNCATE ON "heby_action_request_source_work_items"
  FOR EACH STATEMENT EXECUTE FUNCTION "public"."follow_up_source_work_refuse_change"();--> statement-breakpoint
CREATE TRIGGER "work_item_follow_up_sources_insert_only"
  BEFORE UPDATE OR DELETE ON "work_item_follow_up_sources"
  FOR EACH ROW EXECUTE FUNCTION "public"."follow_up_source_work_refuse_change"();--> statement-breakpoint
CREATE TRIGGER "work_item_follow_up_sources_no_truncate"
  BEFORE TRUNCATE ON "work_item_follow_up_sources"
  FOR EACH STATEMENT EXECUTE FUNCTION "public"."follow_up_source_work_refuse_change"();
