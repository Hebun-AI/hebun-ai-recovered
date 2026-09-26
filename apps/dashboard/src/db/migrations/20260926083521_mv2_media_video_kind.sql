ALTER TABLE "media_assets" DROP CONSTRAINT "media_assets_mime_type_chk";--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "media_kind" text DEFAULT 'image' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "video_container" text;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "video_duration_ms" integer;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "video_codec" text;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "audio_codec" text;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "video_frame_rate" text;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_media_kind_chk" CHECK ("media_assets"."media_kind" in ('image','video'));--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_media_kind_mime_chk" CHECK (("media_assets"."media_kind" = 'image' and "media_assets"."mime_type" in ('image/png','image/jpeg','image/webp'))
        or ("media_assets"."media_kind" = 'video' and "media_assets"."mime_type" in ('video/mp4')));--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_video_facts_chk" CHECK (("media_assets"."media_kind" = 'image' and "media_assets"."video_container" is null and "media_assets"."video_duration_ms" is null
          and "media_assets"."video_codec" is null and "media_assets"."audio_codec" is null and "media_assets"."video_frame_rate" is null)
        or ("media_assets"."media_kind" = 'video' and "media_assets"."video_container" is not null and "media_assets"."video_duration_ms" is not null
          and "media_assets"."video_codec" is not null and "media_assets"."video_frame_rate" is not null));--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_video_container_chk" CHECK ("media_assets"."video_container" is null or "media_assets"."video_container" ~ '^[a-z0-9_]+(,[a-z0-9_]+)*$' and char_length("media_assets"."video_container") <= 64);--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_video_duration_chk" CHECK ("media_assets"."video_duration_ms" is null or "media_assets"."video_duration_ms" >= 1);--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_video_codec_chk" CHECK ("media_assets"."video_codec" is null or "media_assets"."video_codec" ~ '^[a-z0-9_]{1,32}$');--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_audio_codec_chk" CHECK ("media_assets"."audio_codec" is null or "media_assets"."audio_codec" ~ '^[a-z0-9_]{1,32}$');--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_video_frame_rate_chk" CHECK ("media_assets"."video_frame_rate" is null or "media_assets"."video_frame_rate" ~ '^[1-9][0-9]{0,8}/[1-9][0-9]{0,8}$');--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_mime_type_chk" CHECK ("media_assets"."mime_type" in ('image/png','image/jpeg','image/webp','video/mp4'));