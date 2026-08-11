CREATE TYPE "public"."genesis_nomination_status" AS ENUM('pending', 'accepted', 'revoked');--> statement-breakpoint
CREATE TABLE "genesis_nominations" (
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
	"nominated_auth_identity_id" uuid NOT NULL,
	"nominated_user_id" uuid NOT NULL,
	"status" "genesis_nomination_status" DEFAULT 'pending' NOT NULL,
	"nomination_source" varchar(64) NOT NULL,
	"nominated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_session_context_id" uuid,
	"accepted_assurance_level" varchar(8),
	"revoked_at" timestamp with time zone,
	"revocation_reason" varchar(128),
	CONSTRAINT "genesis_nominations_accepted_chk" CHECK (("genesis_nominations"."status" = 'accepted') = ("genesis_nominations"."accepted_at" is not null and "genesis_nominations"."accepted_session_context_id" is not null and "genesis_nominations"."accepted_assurance_level" is not null)),
	CONSTRAINT "genesis_nominations_revoked_chk" CHECK ("genesis_nominations"."status" <> 'revoked' or ("genesis_nominations"."revoked_at" is not null and "genesis_nominations"."revocation_reason" is not null and char_length(btrim("genesis_nominations"."revocation_reason")) > 0)),
	CONSTRAINT "genesis_nominations_assurance_chk" CHECK ("genesis_nominations"."accepted_assurance_level" is null or "genesis_nominations"."accepted_assurance_level" in ('aal1', 'aal2', 'aal3')),
	CONSTRAINT "genesis_nominations_source_chk" CHECK ("genesis_nominations"."nomination_source" = 'local-operator-ceremony')
);
--> statement-breakpoint
ALTER TABLE "genesis_nominations" ADD CONSTRAINT "genesis_nominations_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "genesis_nominations" ADD CONSTRAINT "genesis_nominations_nominated_auth_identity_id_auth_identities_id_fk" FOREIGN KEY ("nominated_auth_identity_id") REFERENCES "public"."auth_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "genesis_nominations" ADD CONSTRAINT "genesis_nominations_nominated_user_id_users_id_fk" FOREIGN KEY ("nominated_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "genesis_nominations" ADD CONSTRAINT "genesis_nominations_tenant_member_fk" FOREIGN KEY ("tenant_id","nominated_user_id") REFERENCES "public"."memberships"("tenant_id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "genesis_nominations_one_active_per_tenant_uq" ON "genesis_nominations" USING btree ("tenant_id") WHERE "genesis_nominations"."status" <> 'revoked';--> statement-breakpoint
CREATE INDEX "genesis_nominations_identity_idx" ON "genesis_nominations" USING btree ("nominated_auth_identity_id");