import { IntelligenceWorkspace } from "@/components/intelligence-workspace/intelligence-workspace";
import { getIntelligenceWorkspaceModel } from "@/features/intelligence/workspace-model";
import { observeGovernanceActivity } from "@/features/governance-activity/observe.server";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";

export const metadata = { title: "Intelligence — Hebun AI" };

/*
 * Intelligence Workspace (Phase 8) — the primary Intelligence landing.
 *
 * Loads the REAL, frozen Organizational Intelligence Runtime vocabulary (candidate
 * kinds, lifecycle stages, confidence levels, dependencies, capabilities and
 * prohibitions). No populated candidate/evidence/briefing instance exists — the
 * Runtime is contract-only here — so every region that would show a candidate
 * renders an honest empty state. No mock data, no model call, no authority act.
 *
 * R7.1 added ONE region with real durable evidence: derived counts over `audit_log`,
 * scoped to the authorized tenant. The tenant is resolved here, on the server, and
 * passed to a read that uses it as a SQL predicate — the page never filters rows
 * after retrieval, and an unauthenticated request produces an honest unavailable
 * state rather than an empty count.
 */

export default async function IntelligencePage() {
  const model = getIntelligenceWorkspaceModel();
  const tenant = await resolveTenantContext();
  const governanceActivity = await observeGovernanceActivity(tenant);
  return <IntelligenceWorkspace model={model} governanceActivity={governanceActivity} />;
}
