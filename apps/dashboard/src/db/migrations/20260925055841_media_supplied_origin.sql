ALTER TABLE "media_assets" DROP CONSTRAINT "media_assets_origin_chk";--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "supplied_by_actor_type" "actor_type";--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "supplied_by_actor_id" uuid;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "supplied_source" text;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "supplied_source_file_id" text;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "supplied_source_capability" text;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "supplied_artifact_id" uuid;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "supplied_revision_no" integer;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_supplied_revision_fk" FOREIGN KEY ("tenant_id","supplied_artifact_id","supplied_revision_no") REFERENCES "public"."work_artifact_revisions"("tenant_id","artifact_id","revision_no") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_assets_supplied_source_idx" ON "media_assets" USING btree ("tenant_id","supplied_artifact_id","supplied_revision_no");--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_supplied_uq" ON "media_assets" USING btree ("tenant_id","supplied_artifact_id","supplied_revision_no","supplied_source","supplied_source_file_id","byte_digest");--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_supplied_human_chk" CHECK ("media_assets"."supplied_by_actor_type" is null or "media_assets"."supplied_by_actor_type" = 'human');--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_supplied_source_chk" CHECK ("media_assets"."supplied_source" is null or "media_assets"."supplied_source" in ('google-drive'));--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_supplied_file_id_chk" CHECK ("media_assets"."supplied_source_file_id" is null or ("media_assets"."supplied_source_file_id" ~ '^[A-Za-z0-9_-]+$' and char_length("media_assets"."supplied_source_file_id") between 1 and 256));--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_supplied_capability_chk" CHECK ("media_assets"."supplied_source_capability" is null or "media_assets"."supplied_source_capability" in ('google.drive.content.read','google.drive.file.content.read'));--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_supplied_revision_no_chk" CHECK ("media_assets"."supplied_revision_no" is null or "media_assets"."supplied_revision_no" >= 1);--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_origin_chk" CHECK (("media_assets"."invocation_id" is not null and "media_assets"."derived_from_asset_id" is null and "media_assets"."derivation" is null
          and "media_assets"."supplied_by_actor_type" is null and "media_assets"."supplied_by_actor_id" is null and "media_assets"."supplied_source" is null
          and "media_assets"."supplied_source_file_id" is null and "media_assets"."supplied_source_capability" is null
          and "media_assets"."supplied_artifact_id" is null and "media_assets"."supplied_revision_no" is null)
        or ("media_assets"."invocation_id" is null and "media_assets"."derived_from_asset_id" is not null and "media_assets"."derivation" is not null
          and "media_assets"."supplied_by_actor_type" is null and "media_assets"."supplied_by_actor_id" is null and "media_assets"."supplied_source" is null
          and "media_assets"."supplied_source_file_id" is null and "media_assets"."supplied_source_capability" is null
          and "media_assets"."supplied_artifact_id" is null and "media_assets"."supplied_revision_no" is null)
        or ("media_assets"."invocation_id" is null and "media_assets"."derived_from_asset_id" is null and "media_assets"."derivation" is null
          and "media_assets"."supplied_by_actor_type" is not null and "media_assets"."supplied_by_actor_id" is not null and "media_assets"."supplied_source" is not null
          and "media_assets"."supplied_source_file_id" is not null and "media_assets"."supplied_source_capability" is not null
          and "media_assets"."supplied_artifact_id" is not null and "media_assets"."supplied_revision_no" is not null));