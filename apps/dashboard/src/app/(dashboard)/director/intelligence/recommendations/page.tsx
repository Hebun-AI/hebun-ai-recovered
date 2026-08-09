import { Recommendations } from "@/components/intelligence-recommendations/recommendations";
import { getRecommendationsModel } from "@/features/intelligence-surfaces/workspace-model";

export const metadata = { title: "Recommendations — Hebun AI" };

/*
 * Intelligence · Recommendations (Phase 20C rebuild) — a strictly advisory surface, distinct from a
 * decision, approval, prepared action, authorized action, or execution. It retires the mock-backed
 * recommendations and no longer imports `@/features/director/mock`. Contract-only runtime: no
 * recommendation instance is surfaced, so the queue renders an honest empty state.
 */

export default function RecommendationsPage() {
  return <Recommendations model={getRecommendationsModel()} />;
}
