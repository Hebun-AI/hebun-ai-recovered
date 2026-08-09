import { Insights } from "@/components/intelligence-insights/insights";
import { getInsightsModel } from "@/features/intelligence-surfaces/workspace-model";

export const metadata = { title: "Insights — Hebun AI" };

/*
 * Intelligence · Insights (Phase 20C rebuild) — validated intelligence (learning + optimization
 * candidates past the runtime validation stage). It retires the mock-backed "Strategic Forecasts"
 * page and no longer imports `@/features/intelligence/mock`. Contract-only runtime: no validated
 * instance is surfaced, so the surface renders an honest empty state.
 */

export default function InsightsPage() {
  return <Insights model={getInsightsModel()} />;
}
