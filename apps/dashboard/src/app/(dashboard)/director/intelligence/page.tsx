import { redirect } from "next/navigation";

/*
 * Legacy /director/intelligence ("Intelligence Center" landing) — RETIRED (Hebun UI Phase 20D).
 *
 * The authoritative Intelligence Overview is /intelligence (Phase 8, honesty-compliant). This
 * mock-backed legacy landing is superseded; the index deep link redirects to the canonical Overview.
 * The authoritative child routes (/director/intelligence/insights and /director/intelligence/
 * recommendations, rebuilt in Phase 20C) are unaffected. No mock is rendered.
 */

export default function IntelligenceCenterRedirect() {
  redirect("/intelligence");
}
