import type { WorkforceWorkspaceModel } from "@/features/workforce/workspace-model";
import { WorkforceHeader } from "./workforce-header";
import { WorkforceStateStrip } from "./workforce-state-strip";
import { WorkforceDirectory } from "./workforce-directory";
import { WorkforceInspector } from "./workforce-inspector";
import { WorkforceConceptModel } from "./workforce-concept-model";
import { WorkforceCapabilities } from "./workforce-capabilities";
import { WorkforceAssignments } from "./workforce-assignments";
import { WorkforceBoundary } from "./workforce-boundary";

/*
 * Workforce Workspace — Hebun's organizational capability surface (UI Phase 11). It
 * answers: who can do work, what can they do, what do they own, what are they
 * assigned to, and where are the gaps? — organizational and capability-oriented,
 * distinct from Operations (live execution), Command (executive summary), and
 * Knowledge (reference).
 *
 * Composition:
 *   Header (slim)
 *   State strip                    — honest: identity model not connected
 *   Workforce Directory (primary)  | Workforce Inspector
 *   Roles, Responsibilities & Authority — the distinct concept layers
 *   Capabilities | Assignments & Availability
 *   Boundary                       — Operations / Governance / Agents
 *
 * No real workforce identity model is connected, so the directory and every
 * populated region is honestly empty. The seeded agent roster is not surfaced as
 * organizational workforce; nothing is fabricated; no model call; no authority act.
 * The architecture already carries both Human and AI Agent entity types so real
 * identities can populate it without a redesign. Ambient Heby is provided by the
 * shell (Phase 5).
 */

export function WorkforceWorkspace({ model }: { model: WorkforceWorkspaceModel }) {
  return (
    <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
      <WorkforceHeader />
      <WorkforceStateStrip />

      {/* Directory + contextual inspector */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <WorkforceDirectory model={model} />
        </div>
        <div className="min-w-0">
          <WorkforceInspector model={model} />
        </div>
      </div>

      <WorkforceConceptModel model={model} />

      {/* Capabilities + assignments, grouped */}
      <div className="grid min-w-0 gap-x-6 gap-y-4 rounded-xl border border-border bg-surface p-4 lg:grid-cols-2">
        <div className="min-w-0">
          <WorkforceCapabilities model={model} />
        </div>
        <div className="min-w-0 lg:border-l lg:border-border lg:pl-6">
          <WorkforceAssignments />
        </div>
      </div>

      <WorkforceBoundary />
    </div>
  );
}
