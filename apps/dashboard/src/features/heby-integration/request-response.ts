/*
 * heby-integration/request-response.ts — the typed envelopes that carry a workspace's
 * context into Heby and (would) carry Heby's provenance-first answer back (UI Phase 15).
 *
 * Contract + boundary ONLY. No request is persisted; `requestId` is a contract-only,
 * in-memory correlation id, never a persisted record id. No response is generated: the
 * response envelope always reports connectionState "not-connected" in this phase. No
 * model, provider, tool, device, mutation, or fabricated content.
 */

import type {
  HebyAuthorityMode,
  HebyCapabilityFamily,
  HebyConnectionState,
  HebyEvidenceReference,
  HebyProductIntent,
  HebyProvenanceFacet,
  HebyUncertaintyState,
  HebyWorkspaceId,
} from "./contracts";
import { HEBY_REQUIRED_PROVENANCE_FACETS } from "./contracts";

/* ---------------------------------------------------------------------------
 * Selected entity — an explicit, typed handle on what "this" means. Never scraped
 * from the DOM; always supplied by the workspace that raised the request.
 * ------------------------------------------------------------------------- */

export interface HebySelectedEntity {
  /** The source class the entity belongs to (e.g. "operations", "decision-records"). */
  readonly sourceClass: HebyWorkspaceId | "record";
  /** A short, human-readable kind ("agent", "policy", "decision", "source record"). */
  readonly kind: string;
  /** A stable reference id when one is safely available. Optional; never fabricated. */
  readonly ref?: string;
  /** A display label for the panel. Optional. */
  readonly label?: string;
}

/* ---------------------------------------------------------------------------
 * Region — the visible surface within a workspace that raised the request, so a
 * "Why?" trigger carries the context of what it is about.
 * ------------------------------------------------------------------------- */

export interface HebySurfaceRegion {
  /** A stable region key, e.g. "state-strip", "inspector", "pending-decisions". */
  readonly key: string;
  /** A short human label for the panel. */
  readonly label: string;
}

/* ---------------------------------------------------------------------------
 * Workspace context — the deterministic, typed context Heby resolves a request in.
 * Assembled by the workspace registry (see workspace-registry.ts); never inferred
 * from arbitrary page text.
 * ------------------------------------------------------------------------- */

export interface HebyWorkspaceContext {
  readonly workspace: HebyWorkspaceId;
  readonly workspaceLabel: string;
  /** The current route, supplied explicitly (not parsed for meaning). */
  readonly route: string;
  readonly region?: HebySurfaceRegion;
  readonly selectedEntity?: HebySelectedEntity;
  /** Capability families and their honest states in this workspace. */
  readonly capabilities: ReadonlyArray<{ readonly family: HebyCapabilityFamily; readonly state: string }>;
  /** Source classes relevant to this workspace and their multi-dimensional status. */
  readonly sources: ReadonlyArray<{ readonly sourceClass: string; readonly unavailable: boolean }>;
  /** The authority mode that bounds anything Heby could do here. */
  readonly authority: HebyAuthorityMode;
  /** What Heby MAY explain here — static, honest product copy (never a live answer). */
  readonly mayExplain: readonly string[];
}

/* ---------------------------------------------------------------------------
 * Request envelope.
 * ------------------------------------------------------------------------- */

export interface HebyRequest {
  /** Contract-only, in-memory correlation id. NOT a persisted request record. */
  readonly requestId: string;
  readonly intent: HebyProductIntent;
  /** The person's own words, carried unchanged. Empty when the request is a bare "Why?". */
  readonly userPrompt: string;
  readonly workspaceContext: HebyWorkspaceContext;
  readonly selectedEntity?: HebySelectedEntity;
  readonly requestedCapability?: HebyCapabilityFamily;
  readonly authorityContext: HebyAuthorityMode;
  readonly provenanceRequirements: readonly HebyProvenanceFacet[];
}

let requestCounter = 0;

/**
 * Build a Heby request envelope. Pure aside from a monotonic in-memory counter used only
 * for correlation within a session — it is never persisted and never a record id.
 */
export function buildHebyRequest(input: {
  intent: HebyProductIntent;
  userPrompt?: string;
  workspaceContext: HebyWorkspaceContext;
  selectedEntity?: HebySelectedEntity;
  requestedCapability?: HebyCapabilityFamily;
}): HebyRequest {
  requestCounter += 1;
  return {
    requestId: `heby-req-${requestCounter}`,
    intent: input.intent,
    userPrompt: input.userPrompt ?? "",
    workspaceContext: input.workspaceContext,
    selectedEntity: input.selectedEntity ?? input.workspaceContext.selectedEntity,
    requestedCapability: input.requestedCapability,
    authorityContext: input.workspaceContext.authority,
    provenanceRequirements: HEBY_REQUIRED_PROVENANCE_FACETS,
  };
}

/* ---------------------------------------------------------------------------
 * Response envelope.
 *
 * Reasoning is represented ONLY as explanation / rationale / evidence relationship /
 * decision-relevant summary — NEVER as hidden internal chain-of-thought. In Phase 15 the
 * envelope is always the not-connected form: no answer, no evidence, no fabricated prose.
 * ------------------------------------------------------------------------- */

export interface HebyResponse {
  readonly connectionState: HebyConnectionState;
  /** Present only when connected. A decision-relevant summary, never a reasoning trace. */
  readonly summary?: string;
  readonly evidence: readonly HebyEvidenceReference[];
  readonly provenanceCovered: readonly HebyProvenanceFacet[];
  readonly uncertainty: HebyUncertaintyState;
  /** Honest statements of what Heby cannot do or does not know here. */
  readonly limitations: readonly string[];
  /** Advisory recommendations — never a decision. Empty unless connected. */
  readonly recommendations: readonly string[];
  /** Whether this response prepared material for a human process (never resolved one). */
  readonly prepared: boolean;
  readonly authorityBoundary: HebyAuthorityMode;
  /** Why a requested capability was not served, when applicable. */
  readonly unavailableExplanations: readonly string[];
}

/**
 * The honest not-connected response for a request. No Heby response runtime is connected
 * in Phase 15, so this is the only response the architecture produces: uncertainty is
 * "unavailable", no evidence or summary is fabricated, and the authority boundary is
 * carried through from the request. This is the seam a future authorized runtime replaces.
 */
export function notConnectedResponse(request: HebyRequest): HebyResponse {
  return {
    connectionState: "not-connected",
    evidence: [],
    provenanceCovered: [],
    uncertainty: "unavailable",
    limitations: [
      "No Heby response runtime is connected. No answer is generated and none is fabricated.",
    ],
    recommendations: [],
    prepared: false,
    authorityBoundary: request.authorityContext,
    unavailableExplanations: request.requestedCapability
      ? [`The "${request.requestedCapability}" capability is not connected on this surface.`]
      : [],
  };
}
