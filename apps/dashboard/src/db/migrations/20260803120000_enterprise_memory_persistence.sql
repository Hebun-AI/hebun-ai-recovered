CREATE TABLE "enterprise_memory_records" (
	"memory_id" text NOT NULL,
	"namespace" text NOT NULL,
	"version" integer NOT NULL,
	"lifecycle_state" text NOT NULL,
	"content" jsonb NOT NULL,
	"classification" jsonb NOT NULL,
	"provenance" jsonb NOT NULL,
	"authority" jsonb NOT NULL,
	"confidence" jsonb NOT NULL,
	"source" jsonb NOT NULL,
	"relationships" jsonb NOT NULL,
	"admission_reference" jsonb NOT NULL,
	"superseded_by" jsonb,
	"is_current" boolean NOT NULL,
	"stored_at" text NOT NULL,
	"archived_at" text,
	"concurrency_token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enterprise_memory_records_pk" PRIMARY KEY ("memory_id","namespace","version"),
	CONSTRAINT "enterprise_memory_records_version_chk" CHECK ("version" > 0),
	CONSTRAINT "enterprise_memory_records_lifecycle_chk" CHECK ("lifecycle_state" in ('approved','archived'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "enterprise_memory_records_current_uq" ON "enterprise_memory_records" ("memory_id","namespace") WHERE "is_current";
