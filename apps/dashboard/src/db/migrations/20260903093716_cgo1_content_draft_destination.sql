CREATE TYPE "public"."content_destination" AS ENUM('instagram', 'tiktok', 'youtube');--> statement-breakpoint
ALTER TYPE "public"."work_artifact_type" ADD VALUE 'content-draft';--> statement-breakpoint
ALTER TABLE "work_artifacts" ADD COLUMN "intended_destination" "content_destination";--> statement-breakpoint
ALTER TABLE "work_artifacts" ADD CONSTRAINT "work_artifacts_content_draft_destination_chk" CHECK ("work_artifacts"."artifact_type"::text <> 'content-draft' OR "work_artifacts"."intended_destination" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "work_artifacts" ADD CONSTRAINT "work_artifacts_non_content_destination_chk" CHECK ("work_artifacts"."artifact_type"::text = 'content-draft' OR "work_artifacts"."intended_destination" IS NULL);