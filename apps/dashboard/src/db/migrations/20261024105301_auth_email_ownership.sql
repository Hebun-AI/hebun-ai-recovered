CREATE TYPE "public"."auth_email_challenge_purpose" AS ENUM('email-verification');--> statement-breakpoint
CREATE TABLE "auth_email_challenges" (
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
	"purpose" "auth_email_challenge_purpose" NOT NULL,
	"email_at_issue" text NOT NULL,
	"token_digest_version" integer NOT NULL,
	"token_hash" char(64) NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"consumed_session_context_id" uuid,
	"superseded_at" timestamp with time zone,
	"delivery_outcome" varchar(16),
	"delivery_attempted_at" timestamp with time zone,
	CONSTRAINT "auth_email_challenges_email_chk" CHECK ("auth_email_challenges"."email_at_issue" = lower(btrim("auth_email_challenges"."email_at_issue")) and char_length("auth_email_challenges"."email_at_issue") between 3 and 320),
	CONSTRAINT "auth_email_challenges_digest_version_chk" CHECK ("auth_email_challenges"."token_digest_version" > 0),
	CONSTRAINT "auth_email_challenges_token_hash_chk" CHECK ("auth_email_challenges"."token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "auth_email_challenges_expiry_chk" CHECK ("auth_email_challenges"."expires_at" > "auth_email_challenges"."issued_at" and "auth_email_challenges"."expires_at" <= "auth_email_challenges"."issued_at" + interval '24 hours'),
	CONSTRAINT "auth_email_challenges_terminal_chk" CHECK ("auth_email_challenges"."consumed_at" is null or "auth_email_challenges"."superseded_at" is null),
	CONSTRAINT "auth_email_challenges_consumed_session_chk" CHECK (("auth_email_challenges"."consumed_at" is null) = ("auth_email_challenges"."consumed_session_context_id" is null)),
	CONSTRAINT "auth_email_challenges_consumed_window_chk" CHECK ("auth_email_challenges"."consumed_at" is null or ("auth_email_challenges"."consumed_at" >= "auth_email_challenges"."issued_at" and "auth_email_challenges"."consumed_at" <= "auth_email_challenges"."expires_at")),
	CONSTRAINT "auth_email_challenges_superseded_time_chk" CHECK ("auth_email_challenges"."superseded_at" is null or "auth_email_challenges"."superseded_at" >= "auth_email_challenges"."issued_at"),
	CONSTRAINT "auth_email_challenges_delivery_outcome_chk" CHECK ("auth_email_challenges"."delivery_outcome" is null or "auth_email_challenges"."delivery_outcome" in ('accepted', 'rejected', 'unreachable', 'ambiguous')),
	CONSTRAINT "auth_email_challenges_delivery_pair_chk" CHECK (("auth_email_challenges"."delivery_outcome" is null) = ("auth_email_challenges"."delivery_attempted_at" is null))
);
--> statement-breakpoint
ALTER TABLE "auth_identities" ADD COLUMN "email_ownership_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auth_identities" ADD COLUMN "email_ownership_challenge_id" uuid;--> statement-breakpoint
ALTER TABLE "auth_email_challenges" ADD CONSTRAINT "auth_email_challenges_auth_identity_id_auth_identities_id_fk" FOREIGN KEY ("auth_identity_id") REFERENCES "public"."auth_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_email_challenges" ADD CONSTRAINT "auth_email_challenges_consumed_session_context_id_user_session_contexts_id_fk" FOREIGN KEY ("consumed_session_context_id") REFERENCES "public"."user_session_contexts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_email_challenges_digest_uq" ON "auth_email_challenges" USING btree ("token_digest_version","token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_email_challenges_open_uq" ON "auth_email_challenges" USING btree ("auth_identity_id","purpose") WHERE "auth_email_challenges"."consumed_at" is null and "auth_email_challenges"."superseded_at" is null;--> statement-breakpoint
CREATE INDEX "auth_email_challenges_rate_idx" ON "auth_email_challenges" USING btree ("auth_identity_id","purpose","issued_at");--> statement-breakpoint
CREATE INDEX "auth_email_challenges_issued_idx" ON "auth_email_challenges" USING btree ("issued_at");--> statement-breakpoint
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_email_ownership_challenge_id_auth_email_challenges_id_fk" FOREIGN KEY ("email_ownership_challenge_id") REFERENCES "public"."auth_email_challenges"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_email_ownership_pair_chk" CHECK (("auth_identities"."email_ownership_verified_at" is null) = ("auth_identities"."email_ownership_challenge_id" is null));