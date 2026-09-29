ALTER TABLE "media_assets" ADD COLUMN "supplied_source_integration_id" uuid;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_supplied_source_integration_fk" FOREIGN KEY ("supplied_source_integration_id","tenant_id") REFERENCES "public"."integrations"("id","tenant_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_supplied_source_integration_chk" CHECK ("media_assets"."supplied_source_integration_id" is null
        or ("media_assets"."supplied_source" is not distinct from 'google-drive'
          and "media_assets"."supplied_source_capability" is not distinct from 'google.drive.file.content.read'));