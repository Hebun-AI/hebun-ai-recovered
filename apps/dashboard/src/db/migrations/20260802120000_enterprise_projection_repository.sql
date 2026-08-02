CREATE TABLE "enterprise_projection_snapshots" (
	"projection_key" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"concurrency_token" text NOT NULL,
	CONSTRAINT "enterprise_projection_snapshots_version_chk" CHECK ("enterprise_projection_snapshots"."version" > 0)
);
