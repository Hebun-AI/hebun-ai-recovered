CREATE UNIQUE INDEX "departments_tenant_id_uq" ON "departments" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "departments_tenant_slug_active_uq" ON "departments" USING btree ("tenant_id","slug") WHERE "departments"."lifecycle_status" = 'active';--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_no_second_parent_chk" CHECK ("departments"."organization_id" is null);--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_human_owner_chk" CHECK ("departments"."owner_actor_type" is null or "departments"."owner_actor_type" = 'human');--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_owner_pair_chk" CHECK (("departments"."owner_actor_type" is null) = ("departments"."owner_actor_id" is null));--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_name_chk" CHECK (char_length(btrim("departments"."name")) > 0);--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_slug_chk" CHECK ("departments"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');--> statement-breakpoint
ALTER TABLE "agents" DROP CONSTRAINT "agents_department_id_departments_id_fk";--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_tenant_department_fk" FOREIGN KEY ("tenant_id","department_id") REFERENCES "public"."departments"("tenant_id","id") ON DELETE restrict ON UPDATE no action;
