import { redirect } from "next/navigation";

/*
 * Legacy /director/insights ("Executive Insights") — RETIRED (Hebun UI Phase 20D).
 *
 * Superseded by the authoritative Intelligence Insights surface (validated intelligence, Phase 20C).
 * This mock-backed page is retired; the deep link redirects to the canonical Insights route. No mock
 * is rendered.
 */

export default function InsightsRedirect() {
  redirect("/director/intelligence/insights");
}
