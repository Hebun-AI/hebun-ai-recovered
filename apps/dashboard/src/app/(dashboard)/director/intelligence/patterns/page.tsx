import { redirect } from "next/navigation";

/*
 * Legacy /director/intelligence/patterns ("Pattern Discovery") — RETIRED (Hebun UI Phase 20D).
 *
 * Patterns was explicitly removed from the authoritative Intelligence IA (Phase 20A decision D3):
 * there is NO `pattern` candidate kind in the Organizational Intelligence Runtime taxonomy, and no
 * pattern contract is created. This mock-backed page is retired. The deep link redirects to the
 * neutral Intelligence Overview — deliberately NOT to Insights, since a pattern is not a validated
 * insight. No mock is rendered.
 */

export default function PatternsRedirect() {
  redirect("/intelligence");
}
