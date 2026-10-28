ALTER TYPE "public"."work_artifact_type" ADD VALUE 'research-report';--> statement-breakpoint
ALTER TABLE "agent_mandates" DROP CONSTRAINT "agent_mandates_scope_subset_chk";--> statement-breakpoint
ALTER TABLE "agent_mandates" ADD CONSTRAINT "agent_mandates_scope_subset_chk" CHECK ("agent_mandates"."proposal_scope" <@ array['send','record-work','set-work-declared-state','prepare-research']::text[]
          and cardinality("agent_mandates"."proposal_scope") <= cardinality(array['send','record-work','set-work-declared-state','prepare-research']::text[]));