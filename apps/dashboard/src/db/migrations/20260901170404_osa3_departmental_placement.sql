CREATE TABLE "department_placements" (
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
	"user_id" uuid NOT NULL,
	"department_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "department_placements" ADD CONSTRAINT "department_placements_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_placements" ADD CONSTRAINT "department_placements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_placements" ADD CONSTRAINT "department_placements_tenant_department_fk" FOREIGN KEY ("tenant_id","department_id") REFERENCES "public"."departments"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "department_placements_tenant_id_uq" ON "department_placements" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "department_placements_tenant_user_active_uq" ON "department_placements" USING btree ("tenant_id","user_id") WHERE "department_placements"."lifecycle_status" = 'active';--> statement-breakpoint
CREATE INDEX "department_placements_tenant_department_idx" ON "department_placements" USING btree ("tenant_id","department_id");