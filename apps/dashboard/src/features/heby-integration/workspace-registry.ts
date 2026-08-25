/*
 * heby-integration/workspace-registry.ts — the typed, deterministic producer of Heby
 * workspace context (UI Phase 15). This is the "adapter" layer: instead of eight near-
 * identical adapter classes, a single typed registry keyed by workspace identity supplies
 * each workspace's capability states, relevant source classes, authority mode, and the
 * honest, static copy for what Heby MAY explain there.
 *
 * Every value is honest for Phase 15: no live Heby runtime is connected, so every
 * capability family resolves to "contract-only" (a structural contract exists) or
 * "unavailable" (future tools/devices), every source is "exists but not connected", and
 * the authority mode bounds Heby to advising/preparing — never deciding, executing, or
 * mutating. Nothing here is fabricated, and nothing grants authority.
 */

import {
  type HebyAuthorityMode,
  type HebyCapabilityFamily,
  type HebyCapabilityState,
  type HebySourceClass,
  type HebySourceStatus,
  type HebyWorkspaceId,
  HEBY_WORKSPACE_IDS,
} from "./contracts";
import type { HebySelectedEntity, HebySurfaceRegion, HebyWorkspaceContext } from "./request-response";

/** A source that is defined in the architecture but not connected to any Heby data path. */
function definedButUnconnected(sourceClass: HebySourceClass): HebySourceStatus {
  return {
    sourceClass,
    exists: true,
    connected: false,
    populated: false,
    authoritative: false,
    unavailable: true,
  };
}

interface WorkspaceProfile {
  readonly label: string;
  readonly defaultRoute: string;
  /** Capability families relevant to this workspace, each with its honest state. */
  readonly capabilities: ReadonlyArray<{ family: HebyCapabilityFamily; state: HebyCapabilityState }>;
  /** Source classes this workspace reasons over. */
  readonly sourceClasses: readonly HebySourceClass[];
  readonly authority: HebyAuthorityMode;
  /** Honest, static product copy — what Heby MAY explain here. Never a live answer. */
  readonly mayExplain: readonly string[];
}

/*
 * The registry. `satisfies` binds it to the full set of workspace identities, so a new or
 * renamed identity that is not profiled here breaks the build.
 */
const WORKSPACE_PROFILES = {
  command: {
    label: "Command",
    defaultRoute: "/command",
    capabilities: [
      { family: "intelligence-analysis", state: "contract-only" },
      { family: "operational-inspection", state: "contract-only" },
      { family: "decision-preparation", state: "contract-only" },
      { family: "evidence-tracing", state: "contract-only" },
    ],
    sourceClasses: ["intelligence", "operations", "decision-records"],
    authority: "advisory-only",
    mayExplain: [
      "Why is this critical?",
      "What requires my attention?",
      "What evidence supports this?",
    ],
  },
  intelligence: {
    label: "Intelligence",
    defaultRoute: "/intelligence",
    capabilities: [
      { family: "intelligence-analysis", state: "contract-only" },
      { family: "evidence-tracing", state: "contract-only" },
    ],
    sourceClasses: ["intelligence", "knowledge", "memory"],
    authority: "advisory-only",
    mayExplain: [
      "Explain this candidate or assessment.",
      "Compare these hypotheses.",
      "Trace the evidence and summarize the uncertainty.",
    ],
  },
  knowledge: {
    label: "Knowledge",
    defaultRoute: "/knowledge",
    capabilities: [
      { family: "knowledge-retrieval", state: "contract-only" },
      { family: "evidence-tracing", state: "contract-only" },
    ],
    sourceClasses: ["knowledge", "memory"],
    authority: "advisory-only",
    mayExplain: [
      "Where did we learn this?",
      "What superseded this?",
      "What evidence supports this?",
    ],
  },
  operations: {
    label: "Operations",
    defaultRoute: "/operations",
    capabilities: [
      { family: "operational-inspection", state: "contract-only" },
      { family: "evidence-tracing", state: "contract-only" },
    ],
    /*
     * R3W adds `work-artifacts` here and only here. Both action tools that name a `record-ref`
     * an artifact could satisfy — `heby.operations.prepare-plan` and
     * `heby.operations.send-communication` — declare `ownerWorkspace: "operations"`, so this is
     * the one workspace where an artifact is a legitimate referent. No other profile gains it,
     * and no eighth workspace is created.
     */
    sourceClasses: ["operations", "governance", "work-artifacts"],
    authority: "advisory-only",
    mayExplain: [
      "Explain this operational state.",
      "What failed, and where is the human gate?",
      "Heby explains operational state; it does not execute.",
    ],
  },
  workforce: {
    label: "Workforce",
    defaultRoute: "/workforce",
    capabilities: [{ family: "workforce-inspection", state: "contract-only" }],
    sourceClasses: ["workforce"],
    authority: "advisory-only",
    mayExplain: [
      "Explain this identity, role, or responsibility.",
      "What is this assignment and its authority?",
      "Organizational workforce identity — not a runtime agent.",
    ],
  },
  governance: {
    label: "Governance",
    defaultRoute: "/governance",
    capabilities: [
      { family: "governance-inspection", state: "contract-only" },
      { family: "evidence-tracing", state: "contract-only" },
    ],
    sourceClasses: ["governance"],
    authority: "restricted",
    mayExplain: [
      "Why is this blocked?",
      "Which policy applies, and what authority does it require?",
      "Heby explains policy; it never modifies it or grants authority.",
    ],
  },
  platform: {
    label: "Platform",
    defaultRoute: "/platform",
    capabilities: [{ family: "platform-inspection", state: "contract-only" }],
    /*
     * INT-5A adds `integrations` here and ONLY here. This profile's own `mayExplain` has asked
     * "Is this integration or dependency available? What capability does this provider offer?"
     * since Phase 15, and until now nothing could answer it — `platform` reads Executive Overview
     * sections, which carry no connection lifecycle and no capability state. This is the workspace
     * where a connection is a legitimate referent; no other profile gains the class.
     */
    sourceClasses: ["platform", "integrations"],
    authority: "restricted",
    mayExplain: [
      "Is this integration or dependency available?",
      "What capability does this provider offer?",
      "Secrets, keys, and connection strings are never exposed.",
    ],
  },
  decisions: {
    label: "Decisions",
    defaultRoute: "/approvals",
    capabilities: [
      { family: "decision-preparation", state: "contract-only" },
      { family: "evidence-tracing", state: "contract-only" },
      { family: "governance-inspection", state: "contract-only" },
    ],
    sourceClasses: ["decision-records", "governance", "knowledge", "intelligence"],
    authority: "human-review-required",
    mayExplain: [
      "Summarize the evidence and consequences.",
      "Explain the recommendation and what remains uncertain.",
      "Heby prepares; it never approves, rejects, or authorizes.",
    ],
  },
} satisfies Record<HebyWorkspaceId, WorkspaceProfile>;

/** Read a workspace profile. */
export function getHebyWorkspaceProfile(workspace: HebyWorkspaceId): WorkspaceProfile {
  return WORKSPACE_PROFILES[workspace];
}

/**
 * Resolve the typed Heby context for a workspace. Deterministic: it composes ONLY the
 * explicitly supplied inputs (workspace, route, optional region, optional selected entity)
 * with the static registry — never inferring meaning from page text or the DOM.
 */
export function resolveHebyWorkspaceContext(input: {
  workspace: HebyWorkspaceId;
  route?: string;
  region?: HebySurfaceRegion;
  selectedEntity?: HebySelectedEntity;
}): HebyWorkspaceContext {
  const profile = WORKSPACE_PROFILES[input.workspace];
  return {
    workspace: input.workspace,
    workspaceLabel: profile.label,
    route: input.route ?? profile.defaultRoute,
    region: input.region,
    selectedEntity: input.selectedEntity,
    capabilities: profile.capabilities.map((c) => ({ family: c.family, state: c.state })),
    sources: profile.sourceClasses
      .map((sourceClass) => definedButUnconnected(sourceClass))
      .map((status) => ({ sourceClass: status.sourceClass, unavailable: status.unavailable })),
    authority: profile.authority,
    mayExplain: profile.mayExplain,
  };
}

/** Every profiled workspace identity, for tests and exhaustiveness checks. */
export const HEBY_PROFILED_WORKSPACES: readonly HebyWorkspaceId[] = HEBY_WORKSPACE_IDS;
