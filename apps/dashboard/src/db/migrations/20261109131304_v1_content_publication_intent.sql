CREATE TABLE "content_publication_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"artifact_id" uuid NOT NULL,
	"revision_no" integer NOT NULL,
	"destination" text NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"time_zone" varchar(64) NOT NULL,
	"youtube_options" jsonb,
	"state" text DEFAULT 'scheduled' NOT NULL,
	"request_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_publication_intents_revision_no_chk" CHECK ("content_publication_intents"."revision_no" >= 1),
	CONSTRAINT "content_publication_intents_destination_chk" CHECK ("content_publication_intents"."destination" in ('instagram', 'youtube')),
	CONSTRAINT "content_publication_intents_state_chk" CHECK ("content_publication_intents"."state" in ('scheduled', 'cancelled', 'requested')),
	CONSTRAINT "content_publication_intents_request_chk" CHECK (("content_publication_intents"."state" = 'requested') = ("content_publication_intents"."request_id" is not null)),
	CONSTRAINT "content_publication_intents_youtube_chk" CHECK (("content_publication_intents"."destination" = 'youtube') = ("content_publication_intents"."youtube_options" is not null)),
	CONSTRAINT "content_publication_intents_time_zone_chk" CHECK (char_length("content_publication_intents"."time_zone") between 1 and 64),
	CONSTRAINT "content_publication_intents_version_chk" CHECK ("content_publication_intents"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "content_publication_intents" ADD CONSTRAINT "content_publication_intents_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_publication_intents" ADD CONSTRAINT "content_publication_intents_revision_fk" FOREIGN KEY ("tenant_id","artifact_id","revision_no") REFERENCES "public"."work_artifact_revisions"("tenant_id","artifact_id","revision_no") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_publication_intents" ADD CONSTRAINT "content_publication_intents_request_fk" FOREIGN KEY ("tenant_id","request_id") REFERENCES "public"."heby_action_requests"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_publication_intents_one_open_uq" ON "content_publication_intents" USING btree ("tenant_id","artifact_id","revision_no") WHERE "content_publication_intents"."state" = 'scheduled';--> statement-breakpoint
CREATE INDEX "content_publication_intents_calendar_idx" ON "content_publication_intents" USING btree ("tenant_id","scheduled_for");