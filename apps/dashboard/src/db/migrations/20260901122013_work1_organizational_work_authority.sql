CREATE TYPE "public"."work_declared_state" AS ENUM('planned', 'active', 'blocked', 'complete');--> statement-breakpoint
CREATE TABLE "work_items" (
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
	"title" text NOT NULL,
	"declared_state" "work_declared_state" DEFAULT 'planned' NOT NULL,
	"department_id" uuid,
	"accountable_actor_type" "actor_type",
	"accountable_actor_id" uuid,
	CONSTRAINT "work_items_human_accountable_chk" CHECK ("work_items"."accountable_actor_type" is null or "work_items"."accountable_actor_type" = 'human'),
	CONSTRAINT "work_items_accountable_pair_chk" CHECK (("work_items"."accountable_actor_type" is null) = ("work_items"."accountable_actor_id" is null)),
	CONSTRAINT "work_items_title_chk" CHECK (char_length(btrim("work_items"."title")) > 0)
);
--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_tenant_department_fk" FOREIGN KEY ("tenant_id","department_id") REFERENCES "public"."departments"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "work_items_tenant_id_uq" ON "work_items" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "work_items_tenant_created_idx" ON "work_items" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "work_items_tenant_department_idx" ON "work_items" USING btree ("tenant_id","department_id");