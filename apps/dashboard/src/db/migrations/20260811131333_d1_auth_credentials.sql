CREATE TYPE "public"."auth_credential_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."auth_credential_type" AS ENUM('password');--> statement-breakpoint
CREATE TABLE "auth_credentials" (
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
	"auth_identity_id" uuid NOT NULL,
	"credential_type" "auth_credential_type" DEFAULT 'password' NOT NULL,
	"algorithm" varchar(32) NOT NULL,
	"params" jsonb NOT NULL,
	"salt" char(64) NOT NULL,
	"secret_hash" char(128) NOT NULL,
	"status" "auth_credential_status" DEFAULT 'active' NOT NULL,
	"password_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_verified_at" timestamp with time zone,
	"failed_attempt_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by_type" "actor_type",
	"revoked_by_id" uuid,
	"revocation_reason" varchar(128),
	CONSTRAINT "auth_credentials_algorithm_chk" CHECK ("auth_credentials"."algorithm" ~ '^[a-z0-9][a-z0-9._-]{0,31}$'),
	CONSTRAINT "auth_credentials_salt_chk" CHECK ("auth_credentials"."salt" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "auth_credentials_secret_hash_chk" CHECK ("auth_credentials"."secret_hash" ~ '^[0-9a-f]{128}$'),
	CONSTRAINT "auth_credentials_failed_attempt_count_chk" CHECK ("auth_credentials"."failed_attempt_count" >= 0),
	CONSTRAINT "auth_credentials_revocation_actor_chk" CHECK (("auth_credentials"."revoked_by_type" is null) = ("auth_credentials"."revoked_by_id" is null)),
	CONSTRAINT "auth_credentials_revoked_chk" CHECK ("auth_credentials"."status" <> 'revoked' or ("auth_credentials"."revoked_at" is not null and "auth_credentials"."revocation_reason" is not null and char_length(btrim("auth_credentials"."revocation_reason")) > 0)),
	CONSTRAINT "auth_credentials_active_chk" CHECK ("auth_credentials"."status" <> 'active' or ("auth_credentials"."revoked_at" is null and "auth_credentials"."revocation_reason" is null))
);
--> statement-breakpoint
ALTER TABLE "auth_credentials" ADD CONSTRAINT "auth_credentials_auth_identity_id_auth_identities_id_fk" FOREIGN KEY ("auth_identity_id") REFERENCES "public"."auth_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_credentials_active_identity_type_uq" ON "auth_credentials" USING btree ("auth_identity_id","credential_type") WHERE "auth_credentials"."status" = 'active';--> statement-breakpoint
CREATE INDEX "auth_credentials_identity_idx" ON "auth_credentials" USING btree ("auth_identity_id");--> statement-breakpoint
CREATE INDEX "auth_credentials_locked_until_idx" ON "auth_credentials" USING btree ("locked_until");