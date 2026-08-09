import { redirect } from "next/navigation";

/*
 * Legacy /director/intelligence/organization-health ("Organization Intelligence") — RETIRED
 * (Hebun UI Phase 20D).
 *
 * Organizational operating-state is owned by Command (Organization Health), not Intelligence — the
 * legacy page itself deferred there. This duplicate, mock-backed surface is retired; the deep link
 * redirects to the canonical Command Organization Health operating-state surface. No mock is rendered,
 * and no second organization-health authority is maintained.
 */

export default function IntelligenceOrgHealthRedirect() {
  redirect("/director/organization-health");
}
