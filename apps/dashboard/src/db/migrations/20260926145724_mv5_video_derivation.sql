ALTER TABLE "media_assets" DROP CONSTRAINT "media_assets_derivation_chk";--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_derivation_mp4_chk" CHECK ("media_assets"."derivation" is distinct from 'mp4-normalize-v1'
        or ("media_assets"."media_kind" = 'video' and "media_assets"."mime_type" = 'video/mp4' and "media_assets"."video_codec" = 'h264'
          and ("media_assets"."audio_codec" is null or "media_assets"."audio_codec" = 'aac')));--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_derivation_chk" CHECK ("media_assets"."derivation" is null or "media_assets"."derivation" in ('jpeg-publish-v1','mp4-normalize-v1'));