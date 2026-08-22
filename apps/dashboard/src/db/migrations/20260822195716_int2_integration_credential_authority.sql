CREATE TYPE "public"."integration_credential_kind" AS ENUM('oauth_access', 'oauth_refresh', 'api_key');--> statement-breakpoint
CREATE TABLE "integration_credentials" (
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
	"integration_id" uuid NOT NULL,
	"kind" "integration_credential_kind" NOT NULL,
	"algorithm" varchar(32) NOT NULL,
	"key_id" varchar(32) NOT NULL,
	"ciphertext" text NOT NULL,
	"iv" text NOT NULL,
	"auth_tag" text NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid,
	"revoked_by_type" "actor_type",
	"destroyed_at" timestamp with time zone,
	CONSTRAINT "integration_credentials_revoked_actor_chk" CHECK (("integration_credentials"."revoked_by_type" is null) = ("integration_credentials"."revoked_by" is null)),
	CONSTRAINT "integration_credentials_destroyed_revoked_chk" CHECK ("integration_credentials"."destroyed_at" is null or "integration_credentials"."revoked_at" is not null),
	CONSTRAINT "integration_credentials_destroyed_empty_chk" CHECK (("integration_credentials"."destroyed_at" is not null) = ("integration_credentials"."ciphertext" = '' and "integration_credentials"."iv" = '' and "integration_credentials"."auth_tag" = '')),
	CONSTRAINT "integration_credentials_key_id_chk" CHECK ("integration_credentials"."key_id" ~ '^[a-z0-9][a-z0-9._-]{0,31}$'),
	CONSTRAINT "integration_credentials_algorithm_chk" CHECK ("integration_credentials"."algorithm" ~ '^[a-z0-9][a-z0-9._-]{0,31}$')
);
--> statement-breakpoint
ALTER TABLE "integration_credentials" ADD CONSTRAINT "integration_credentials_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_credentials" ADD CONSTRAINT "integration_credentials_tenant_integration_fk" FOREIGN KEY ("tenant_id","integration_id") REFERENCES "public"."integrations"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "integration_credentials_live_kind_uq" ON "integration_credentials" USING btree ("tenant_id","integration_id","kind") WHERE revoked_at is null and destroyed_at is null;--> statement-breakpoint
CREATE INDEX "integration_credentials_tenant_integration_idx" ON "integration_credentials" USING btree ("tenant_id","integration_id");--> statement-breakpoint
CREATE INDEX "integration_credentials_key_id_idx" ON "integration_credentials" USING btree ("key_id");