ALTER TABLE "messages" ADD COLUMN "origin" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "provider" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "transport" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "correlation_id" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "provider_request_id" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "input_tokens" integer;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "output_tokens" integer;