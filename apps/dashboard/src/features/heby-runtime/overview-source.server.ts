/*
 * heby-runtime/overview-source.server.ts — the single, server-authoritative source of
 * the Executive Overview projection Heby reasons over (UI Runtime R2C).
 *
 * The overview is a REAL, derived, non-authoritative read model. It is read here on the
 * server so the client never becomes the authority for Heby's evidence: the app shell
 * hands a serializable copy to the ambient panel for its deterministic buttons, and the
 * R2C server boundary reads its OWN copy for a model request — it never trusts the copy
 * that round-tripped through the browser. Only derived health, counts, freshness, and
 * section state cross this boundary — never a secret, credential, or authoritative record.
 *
 * ── G2: WHERE THE COUNTS COME FROM, AND WHEN THEY DO NOT ─────────────────────
 *
 * "REAL" above means genuinely computed rather than hand-faked — it never meant that the
 * underlying organization was real. It is not: the adapter's organization, agent and workflow
 * projections are seeded from compiled-in mocks, so this overview once carried `active-agents: 36`
 * into Heby's grounding, where it would have been reasoned over as organizational fact.
 *
 * The adapter now withholds the whole snapshot wherever a real tenant can be authenticated, so
 * every section arrives `unavailable` with a record count of zero. Heby therefore has no
 * organizational state to inspect for a real tenant — which is the truth — and must say so rather
 * than treat the zeroes as a measured empty organization. The pre-auth demo shell is unchanged.
 *
 * Server-only: it imports the director-dashboard server adapter. Never import from client
 * code, and never re-export it from the client-importable feature index.
 */

import { getDirectorDashboardUiModel } from "@/features/director-dashboard-ui/adapter.server";
import type { ExecutiveOverviewLike } from "./contracts";

function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new Error("Heby overview source is server-only.");
  }
}

/**
 * Read the real Executive Overview server-side and project it to the minimal serializable
 * shape the Heby runtime consumes. Returns `undefined` when the overview cannot be built —
 * Heby then honestly has no system state to inspect (never a fabricated one).
 */
export function readServerHebyOverview(): ExecutiveOverviewLike | undefined {
  assertServerRuntime();
  const { overview } = getDirectorDashboardUiModel();
  if (!overview) return undefined;
  return {
    organizationHealth: overview.organizationHealth,
    criticalAlertCount: overview.criticalAlertCount,
    warningCount: overview.warningCount,
    unavailableCount: overview.unavailableCount,
    freshness: { state: overview.freshness.state, ageSeconds: overview.freshness.ageSeconds },
    sections: overview.sections.map((section) => ({
      sectionId: section.sectionId,
      label: section.label,
      health: section.health,
      sourceState: section.sourceState,
      recordCount: section.recordCount,
      reasonCode: section.reasonCode,
    })),
    authoritative: false,
  };
}
