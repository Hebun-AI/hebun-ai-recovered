import { ReadinessPathways } from "@/components/intelligence-readiness/readiness-pathways";
import { getReadinessPathwaysModel } from "@/features/intelligence-surfaces/workspace-model";

export const metadata = { title: "Readiness & Pathways — Hebun AI" };

/*
 * Intelligence · Readiness & Pathways (Phase 20C) — evolution-readiness + evolution-pathway, from
 * the real runtime vocabulary. Contract-only: no instance is surfaced, so both render honest empty
 * states. No fabricated maturity, readiness, roadmap, or impact.
 */

export default function ReadinessPathwaysPage() {
  return <ReadinessPathways model={getReadinessPathwaysModel()} />;
}
