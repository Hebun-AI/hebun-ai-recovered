CREATE TABLE "work_domains" (
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
	"name" text NOT NULL,
	"slug" text NOT NULL,
	CONSTRAINT "work_domains_name_chk" CHECK (char_length(btrim("work_domains"."name")) between 1 and 80),
	CONSTRAINT "work_domains_slug_chk" CHECK ("work_domains"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length("work_domains"."slug") <= 48),
	CONSTRAINT "work_domains_lifecycle_chk" CHECK ("work_domains"."lifecycle_status" in ('active', 'archived')),
	CONSTRAINT "work_domains_retirement_chk" CHECK (("work_domains"."lifecycle_status" = 'archived') = ("work_domains"."deleted_at" is not null))
);--> statement-breakpoint
CREATE TABLE "agent_mandate_responsibilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"mandate_id" uuid NOT NULL,
	"responsibility_kind" text NOT NULL,
	"work_domain_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	CONSTRAINT "agent_mandate_responsibilities_kind_chk" CHECK (("agent_mandate_responsibilities"."responsibility_kind" = 'domain' and "agent_mandate_responsibilities"."work_domain_id" is not null)
          or ("agent_mandate_responsibilities"."responsibility_kind" = 'organization' and "agent_mandate_responsibilities"."work_domain_id" is null))
);--> statement-breakpoint
ALTER TABLE "work_items" ADD COLUMN "work_scope_kind" text;--> statement-breakpoint
ALTER TABLE "work_items" ADD COLUMN "work_domain_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "work_domains_tenant_id_uq" ON "work_domains" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_domains_tenant_slug_uq" ON "work_domains" USING btree ("tenant_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_mandates_tenant_id_uq" ON "agent_mandates" USING btree ("tenant_id","id");--> statement-breakpoint
ALTER TABLE "work_domains" ADD CONSTRAINT "work_domains_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_mandate_responsibilities" ADD CONSTRAINT "agent_mandate_responsibilities_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_mandate_responsibilities" ADD CONSTRAINT "agent_mandate_responsibilities_tenant_mandate_fk" FOREIGN KEY ("tenant_id","mandate_id") REFERENCES "public"."agent_mandates"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_mandate_responsibilities" ADD CONSTRAINT "agent_mandate_responsibilities_tenant_domain_fk" FOREIGN KEY ("tenant_id","work_domain_id") REFERENCES "public"."work_domains"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_mandate_responsibilities_tenant_mandate_idx" ON "agent_mandate_responsibilities" USING btree ("tenant_id","mandate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_mandate_responsibilities_mandate_domain_uq" ON "agent_mandate_responsibilities" USING btree ("mandate_id","work_domain_id") WHERE "agent_mandate_responsibilities"."work_domain_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_mandate_responsibilities_mandate_organization_uq" ON "agent_mandate_responsibilities" USING btree ("mandate_id") WHERE "agent_mandate_responsibilities"."responsibility_kind" = 'organization';--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_tenant_work_domain_fk" FOREIGN KEY ("tenant_id","work_domain_id") REFERENCES "public"."work_domains"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_items_tenant_work_domain_idx" ON "work_items" USING btree ("tenant_id","work_domain_id");--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_work_scope_chk" CHECK (("work_items"."work_scope_kind" is null and "work_items"."work_domain_id" is null)
          or ("work_items"."work_scope_kind" is not null
              and (("work_items"."work_scope_kind" = 'organization' and "work_items"."work_domain_id" is null)
                or ("work_items"."work_scope_kind" = 'domain' and "work_items"."work_domain_id" is not null))));
