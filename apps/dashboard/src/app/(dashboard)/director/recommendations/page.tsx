import { redirect } from "next/navigation";

/*
 * Legacy /director/recommendations ("AI Recommendations") — RETIRED (Hebun UI Phase 20D).
 *
 * Superseded by the authoritative Intelligence Recommendations surface (advisory, distinct from a
 * decision, Phase 20C). This mock-backed page is retired; the deep link redirects to the canonical
 * Recommendations route. No mock is rendered.
 */

export default function RecommendationsRedirect() {
  redirect("/director/intelligence/recommendations");
}
