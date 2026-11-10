CREATE TABLE "auth_mfa_credentials" (
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
	"method" varchar(16) DEFAULT 'totp' NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"seal_algorithm" varchar(32) NOT NULL,
	"seal_key_id" varchar(32) NOT NULL,
	"seal_ciphertext" text NOT NULL,
	"seal_iv" text NOT NULL,
	"seal_auth_tag" text NOT NULL,
	"last_accepted_step" integer DEFAULT 0 NOT NULL,
	"failed_attempt_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"activated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revocation_reason" varchar(128),
	CONSTRAINT "auth_mfa_credentials_method_chk" CHECK ("auth_mfa_credentials"."method" in ('totp')),
	CONSTRAINT "auth_mfa_credentials_status_chk" CHECK ("auth_mfa_credentials"."status" in ('pending', 'active', 'revoked')),
	CONSTRAINT "auth_mfa_credentials_seal_algorithm_chk" CHECK ("auth_mfa_credentials"."seal_algorithm" in ('aes-256-gcm')),
	CONSTRAINT "auth_mfa_credentials_step_chk" CHECK ("auth_mfa_credentials"."last_accepted_step" >= 0),
	CONSTRAINT "auth_mfa_credentials_failed_attempt_chk" CHECK ("auth_mfa_credentials"."failed_attempt_count" >= 0),
	CONSTRAINT "auth_mfa_credentials_active_chk" CHECK ("auth_mfa_credentials"."status" <> 'active' or ("auth_mfa_credentials"."activated_at" is not null and "auth_mfa_credentials"."revoked_at" is null)),
	CONSTRAINT "auth_mfa_credentials_revoked_chk" CHECK (("auth_mfa_credentials"."status" = 'revoked') = ("auth_mfa_credentials"."revoked_at" is not null) and ("auth_mfa_credentials"."revoked_at" is null) = ("auth_mfa_credentials"."revocation_reason" is null))
);
--> statement-breakpoint
CREATE TABLE "platform_operator_grants" (
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
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"granted_at" timestamp with time zone NOT NULL,
	"granted_by_user_id" uuid NOT NULL,
	"grant_reason" text NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" uuid,
	"revocation_reason" text,
	CONSTRAINT "platform_operator_grants_status_chk" CHECK ("platform_operator_grants"."status" in ('active', 'revoked')),
	CONSTRAINT "platform_operator_grants_reason_chk" CHECK (length(trim("platform_operator_grants"."grant_reason")) > 0),
	CONSTRAINT "platform_operator_grants_revoked_chk" CHECK (("platform_operator_grants"."status" = 'revoked') = ("platform_operator_grants"."revoked_at" is not null) and ("platform_operator_grants"."revoked_at" is null) = ("platform_operator_grants"."revoked_by_user_id" is null) and ("platform_operator_grants"."revoked_at" is null) = ("platform_operator_grants"."revocation_reason" is null))
);
--> statement-breakpoint
ALTER TABLE "user_session_contexts" ADD COLUMN "mfa_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_session_contexts" ADD COLUMN "mfa_credential_id" uuid;--> statement-breakpoint
ALTER TABLE "auth_mfa_credentials" ADD CONSTRAINT "auth_mfa_credentials_auth_identity_id_auth_identities_id_fk" FOREIGN KEY ("auth_identity_id") REFERENCES "public"."auth_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_operator_grants" ADD CONSTRAINT "platform_operator_grants_auth_identity_id_auth_identities_id_fk" FOREIGN KEY ("auth_identity_id") REFERENCES "public"."auth_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_operator_grants" ADD CONSTRAINT "platform_operator_grants_granted_by_user_id_users_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_operator_grants" ADD CONSTRAINT "platform_operator_grants_revoked_by_user_id_users_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_mfa_credentials_one_active_uq" ON "auth_mfa_credentials" USING btree ("auth_identity_id") WHERE "auth_mfa_credentials"."status" = 'active';--> statement-breakpoint
CREATE INDEX "auth_mfa_credentials_identity_idx" ON "auth_mfa_credentials" USING btree ("auth_identity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_operator_grants_one_active_uq" ON "platform_operator_grants" USING btree ("auth_identity_id") WHERE "platform_operator_grants"."status" = 'active';--> statement-breakpoint
CREATE INDEX "platform_operator_grants_identity_idx" ON "platform_operator_grants" USING btree ("auth_identity_id");--> statement-breakpoint
ALTER TABLE "user_session_contexts" ADD CONSTRAINT "user_session_contexts_mfa_credential_id_auth_mfa_credentials_id_fk" FOREIGN KEY ("mfa_credential_id") REFERENCES "public"."auth_mfa_credentials"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_session_contexts" ADD CONSTRAINT "user_session_contexts_mfa_binding_chk" CHECK ("user_session_contexts"."mfa_verified" = ("user_session_contexts"."mfa_verified_at" is not null) and ("user_session_contexts"."mfa_verified_at" is null) = ("user_session_contexts"."mfa_credential_id" is null));