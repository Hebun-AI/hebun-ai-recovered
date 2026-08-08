import type { ExecutiveOverview } from "@/features/director-dashboard-executive-overview";
import type { PlatformWorkspaceModel } from "@/features/platform/workspace-model";
import { PlatformHeader } from "./platform-header";
import { PlatformStateStrip } from "./platform-state-strip";
import { PlatformConnections } from "./platform-connections";
import { PlatformInspector } from "./platform-inspector";
import { ProvidersModels } from "./providers-models";
import { PlatformDependencies } from "./platform-dependencies";
import { PlatformAccess } from "./platform-access";
import { PlatformBoundary } from "./platform-boundary";

/*
 * Platform Workspace — Hebun's technical capability surface (UI Phase 13). It makes
 * connections, providers, dependencies, models, and authentication inspectable and
 * manageable without exposing internal implementation plumbing, secrets, or
 * bypassing governance — technical, structured, and dependency-aware, distinct from
 * its neighbours.
 *
 * Composition:
 *   Header (slim)
 *   State strip                        — real platform health + counts + freshness
 *   Connections & Integrations (primary) | Platform Inspector
 *   Providers & Models                 — real capability + execution-mode vocabulary
 *   System Dependencies | Authentication & Access
 *   Boundary & Ownership               — Operations / Governance / Knowledge
 *
 * System Dependencies reads the REAL, non-authoritative Executive Overview
 * technical sections as dependency availability; connections, providers, and access
 * are honestly empty because no Director-safe record is surfaced. No mock/seed data,
 * no secret, no model call, no mutation, no authority act. Ambient Heby is provided
 * by the shell.
 */

export function PlatformWorkspace({
  overview,
  model,
}: {
  overview: ExecutiveOverview;
  model: PlatformWorkspaceModel;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
      <PlatformHeader />
      <PlatformStateStrip overview={overview} />

      {/* Connections + contextual inspector */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <PlatformConnections />
        </div>
        <div className="min-w-0">
          <PlatformInspector model={model} />
        </div>
      </div>

      <ProvidersModels model={model} />

      {/* Dependencies + access, grouped */}
      <div className="grid min-w-0 gap-x-6 gap-y-4 rounded-xl border border-border bg-surface p-4 lg:grid-cols-2">
        <div className="min-w-0">
          <PlatformDependencies overview={overview} />
        </div>
        <div className="min-w-0 lg:border-l lg:border-border lg:pl-6">
          <PlatformAccess />
        </div>
      </div>

      <PlatformBoundary />
    </div>
  );
}
