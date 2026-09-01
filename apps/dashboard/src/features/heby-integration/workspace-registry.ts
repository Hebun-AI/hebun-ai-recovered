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
    /*
     * E2-1 adds `organization` here and ONLY here. Command is the workspace that already owns the
     * organization-wide surfaces by route — `/heby`, `/live-map` and `/director/organization` all
     * resolve to it — so this is the one workspace where the organization is a legitimate referent.
     * No other profile gains the class: an answer about Knowledge, Governance or Decisions is not
     * an answer about which organization is asking.
     *
     * Until now nothing here could answer "which organization am I in?": `intelligence` and
     * `decision-records` have no connected reader, and `operations` reads Executive Overview
     * sections that the mock-surface gate withholds from a real tenant. The organization was the
     * one authoritative fact Hebun held and Heby could not reach.
     */
    /*
     * E2-5 adds `agents` here and ONLY here, on E2-1's precedent and for its reason. Command is the
     * workspace that already owns the organization-wide surfaces by route — `/heby`, `/live-map`
     * and `/director/organization` all resolve to it — and `/live-map` is where a Director already
     * sees the durable agents rendered. It is the one workspace where "what are my agents doing?"
     * is a legitimate question. No other profile gains the class, and `workforce` in particular
     * does NOT: its own `mayExplain` says "not a runtime agent", and that boundary is kept.
     *
     * Until now nothing here could answer it. Heby held counts and durations after E2-4 and could
     * not name a single agent — including itself.
     */
    /*
     * E2-6 adds `recorded-acts` here and ONLY here, on the same precedent. Command is where a
     * Director asks what requires attention and what changed; `governance` deliberately does not
     * gain it, because that workspace's class carries the CONSTITUTION and this one carries a
     * bounded HISTORY, and one profile asserting both would blur which of the two an answer rests
     * on. Until now Heby held a COUNT of recorded acts (E2-4) and could not name a single one.
     */
    sourceClasses: [
      "intelligence",
      "operations",
      "decision-records",
      "organization",
      "agents",
      /*
       * AMA-3 adds `agent-mandate` here and ONLY here, on the same precedent as its four
       * predecessors. Command is where a Director asks what an agent is for and what it may
       * propose — and it is where `/heby` resolves, which is how the question reaches Heby at all.
       *
       * `workforce` deliberately does not gain it, for the reason E2-5 already recorded about
       * `agents`: that class is chartered for the humans an organization is made of, and routing a
       * runtime agent's ceiling through it would make an agent's proposal surface
       * indistinguishable from an employee's remit. `governance` does not gain it either — a
       * mandate DECISION is a Governance record and lives there already, while the mandate itself
       * is owned by its own authority, and one profile asserting both would blur which of the two
       * an answer rests on.
       */
      "agent-mandate",
      "recorded-acts",
      /*
       * E2-7 adds `recorded-act-windows` here and ONLY here, on the same precedent as its three
       * predecessors. Command is where a Director asks what changed; `governance` still does not
       * gain a history class, and no other profile gains a period count.
       */
      "recorded-act-windows",
      /*
       * WORK-2 adds `work` here and ONLY here, on the same precedent as its five predecessors.
       * Command is where a Director asks what the organization is doing and who is accountable for
       * it, and it is where `/heby` resolves, which is how the question reaches Heby at all.
       *
       * `workforce` deliberately does NOT gain it, for the reason E2-5 recorded about `agents`:
       * that class is chartered for the humans an organization is made of, and a work item naming
       * an accountable human is not a statement about that person's remit — routing work through
       * it would make "this work is attributed to you" indistinguishable from "this is your job".
       *
       * `operations` does not gain it either: that class reads Executive Overview sections the
       * mock-surface gate withholds from a real tenant, so durable rows filed behind it would be
       * invisible to the only tenants that have any. And `intelligence` has no connected reader.
       *
       * Until now nothing here could answer "what are we working on?" — Hebun held the fact and
       * Heby could not reach it.
       */
      "work",
    ],
    authority: "advisory-only",
    mayExplain: [
      "Why is this critical?",
      "What requires my attention?",
      "What evidence supports this?",
      /*
       * E2-1. Truthful in BOTH halves, and the second half is the point: Hebun knows which
       * organization this is and does not know how it is arranged, and Heby must say both.
       */
      "Which organization am I in, and what does Hebun know about it?",
      /*
       * E2-5. Truthful in BOTH halves, like E2-1's line above. Hebun knows what each agent
       * proposed and what became of it, and does not know what any agent is FOR — and Heby must
       * say both.
       */
      "What durable agents does this organization have, and what became of what they proposed?",
      /*
       * E2-6. Truthful in BOTH halves, like the two lines above: Hebun knows what it recorded and
       * does not know everything that happened, and Heby must say both.
       */
      "What has this organization recently done that Hebun recorded?",
      /*
       * E2-7. The period is NAMED in the question, deliberately. Hebun owns no definition of
       * "recent", so the honest form of the question carries its own boundary.
       */
      "How many acts did Hebun record in the last 7 days, and how many in the 7 days before?",
      /*
       * WORK-2. Truthful in BOTH halves, like the four lines above: Hebun knows what this
       * organization RECORDED it is doing and did not watch any of it happen, and Heby must say
       * both. The question carries the word `declared` for the same reason E2-7's carries its
       * period — the honest form of the question states its own boundary.
       */
      "What work has this organization recorded, and what state has it declared each to be in?",
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
    /*
     * E2-8 adds `knowledge-coverage` here and ONLY here.
     *
     * The three Heby milestones before it each went to Command, because Command is where a Director
     * asks what requires attention and what changed. This one does not: "what do we know, and where
     * do we hold nothing" is the question this workspace's own route already exists to answer, and
     * its surface already shows the operator the very card these counts come from. Command gains no
     * knowledge inventory, and this workspace gains no attention, activity, agent or act class.
     */
    sourceClasses: ["knowledge", "memory", "knowledge-coverage"],
    authority: "advisory-only",
    mayExplain: [
      "Where did we learn this?",
      "What superseded this?",
      "What evidence supports this?",
      /*
       * E2-8. Truthful in BOTH halves, like E2-1's and E2-5's lines: Hebun knows which declared
       * areas it holds evidence in, and does not know whether that evidence is right — and Heby
       * must say both.
       */
      "Which declared areas do we hold knowledge in, and which hold nothing?",
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
