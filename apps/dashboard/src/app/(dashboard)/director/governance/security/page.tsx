import { SecurityCenter } from "@/components/security-center/security-center";
import { getSecurityCenterModel } from "@/features/security-center";
import { readSecurityRecordedActObservation } from "@/features/governance-activity/security-observation-source.server";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";

export const metadata = { title: "Security Center — Hebun AI" };

/*
 * Security Center (Phase 19 · E2-2) — Governance Level-2 security surface.
 *
 * Loads the real/structural Security Intelligence model — the security source map, the signal-kind
 * / finding-status / risk-class vocabularies, the structural response options, the inspector lenses
 * and the real disconnected Phase 18 device-security summary — plus, since E2-2, ONE piece of real
 * connected evidence: this tenant's recorded governed acts. Findings, signals, incidents and
 * timeline remain empty because no authority for any of them exists; none is surfaced or
 * fabricated. No incident, attacker, CVE, score, secret or threat. Security Center detects,
 * explains, investigates and prepares; it never decides or executes.
 *
 * ── WHY THE COMPOSITION HAPPENS HERE ─────────────────────────────────────────
 *
 * The route reads; the Security Center feature does not. That is the whole architecture of E2-2 and
 * it is load-bearing in two released guards: the Security Center's own token firewall forbids a
 * `features/governance` import inside its feature directory, and SEC-4 forbids it from holding a
 * database handle. Composing here satisfies both without weakening either — the projection lives
 * inside `governance-activity`, beside the facts it re-shapes, and this page joins it to the model.
 *
 *   ROUTE -> GOVERNANCE-ACTIVITY PROJECTION -> RELEASED READER -> audit_log
 *
 * ── THE TENANT COMES FROM THE SESSION ────────────────────────────────────────
 *
 * `resolveTenantContext()` returns the authorized tenant or `null`, and it is passed through
 * verbatim. There is no tenant query parameter, no slug, no client-supplied id and no second
 * resolver — a cross-tenant read is not refused downstream, it is unrepresentable. An
 * unauthenticated request produces an honest `unavailable` observation, never an empty ledger.
 *
 *   TENANT CONTEXT != CLIENT TENANT PARAMETER
 *   KNOWN EMPTY    != UNAVAILABLE
 */

export default async function SecurityCenterPage() {
  const tenant = await resolveTenantContext();
  const recordedActs = await readSecurityRecordedActObservation(tenant);
  /*
   * The tenant id still reaches the model, because `listSecuritySignals` / `listSecurityFindings`
   * are tenant-scoped lookups. Both remain empty — no authority produces either — so this is the
   * released shape, no longer fed an empty-string placeholder now that a real context exists.
   */
  const model = getSecurityCenterModel(tenant?.tenantId ?? "", recordedActs);
  return <SecurityCenter model={model} />;
}
