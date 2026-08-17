ALTER TABLE "companies" ADD COLUMN "provisioning_source" varchar(64);--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_provisioning_source_chk" CHECK ("companies"."provisioning_source" is null or "companies"."provisioning_source" = 'local-operator-ceremony');
