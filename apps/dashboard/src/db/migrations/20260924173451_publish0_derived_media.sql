ALTER TABLE "media_assets" ALTER COLUMN "invocation_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "derived_from_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "derivation" text;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_tenant_derived_from_fk" FOREIGN KEY ("tenant_id","derived_from_asset_id") REFERENCES "public"."media_assets"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_derivation_uq" ON "media_assets" USING btree ("derived_from_asset_id","derivation");--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_origin_chk" CHECK (("media_assets"."invocation_id" is not null and "media_assets"."derived_from_asset_id" is null and "media_assets"."derivation" is null)
        or ("media_assets"."invocation_id" is null and "media_assets"."derived_from_asset_id" is not null and "media_assets"."derivation" is not null));--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_derivation_chk" CHECK ("media_assets"."derivation" is null or "media_assets"."derivation" in ('jpeg-publish-v1'));--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_derivation_jpeg_chk" CHECK ("media_assets"."derivation" is distinct from 'jpeg-publish-v1' or "media_assets"."mime_type" = 'image/jpeg');--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_derivation_not_self_chk" CHECK ("media_assets"."derived_from_asset_id" is null or "media_assets"."derived_from_asset_id" <> "media_assets"."id");