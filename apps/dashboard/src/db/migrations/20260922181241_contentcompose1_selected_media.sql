CREATE TABLE "content_selected_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"artifact_id" uuid NOT NULL,
	"revision_no" integer NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"selected_by_actor_id" uuid NOT NULL,
	"selected_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_selected_media_revision_asset_uq" UNIQUE("tenant_id","artifact_id","revision_no","media_asset_id"),
	CONSTRAINT "content_selected_media_revision_no_chk" CHECK ("content_selected_media"."revision_no" >= 1)
);
--> statement-breakpoint
ALTER TABLE "content_selected_media" ADD CONSTRAINT "content_selected_media_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_selected_media" ADD CONSTRAINT "content_selected_media_revision_fk" FOREIGN KEY ("tenant_id","artifact_id","revision_no") REFERENCES "public"."work_artifact_revisions"("tenant_id","artifact_id","revision_no") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_selected_media" ADD CONSTRAINT "content_selected_media_asset_fk" FOREIGN KEY ("tenant_id","media_asset_id") REFERENCES "public"."media_assets"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_selected_media_revision_idx" ON "content_selected_media" USING btree ("tenant_id","artifact_id","revision_no");