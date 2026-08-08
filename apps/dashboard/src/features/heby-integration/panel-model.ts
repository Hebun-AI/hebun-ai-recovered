/*
 * heby-integration/panel-model.ts — the honest, UI-facing view model for the ambient Heby
 * panel (UI Phase 15). It turns a resolved workspace context (and optional request) into
 * what the panel shows: the CONTEXT Heby is aware of, and an explicit "not connected"
 * response. It never fabricates an answer, evidence, or provenance, and it exposes no
 * secret. Presentation only — authority and access remain server-side.
 */

import { resolveActiveWorkspace } from "@/config/workspace-nav";
import {
  HEBY_CAPABILITY_STATE_DESCRIPTORS,
  HEBY_AUTHORITY_DESCRIPTORS,
  type HebyCapabilityState,
  type HebyProductIntent,
  type HebyWorkspaceId,
} from "./contracts";
import {
  buildHebyRequest,
  notConnectedResponse,
  type HebySelectedEntity,
  type HebySurfaceRegion,
  type HebyResponse,
  type HebyWorkspaceContext,
} from "./request-response";
import { resolveHebyWorkspaceContext } from "./workspace-registry";

/**
 * Map the current route to a Heby workspace identity. The `/approvals` route is Command's
 * human-authority surface; Heby names it "decisions" so it can reason about the decision
 * context without adding an eighth navigation workspace. Every other route maps to its
 * navigable workspace. Deterministic; the route is used as a key, never parsed for meaning.
 */
export function resolveHebyWorkspace(pathname: string): HebyWorkspaceId {
  if (pathname === "/approvals" || pathname.startsWith("/approvals/")) return "decisions";
  return resolveActiveWorkspace(pathname);
}

export interface HebyPanelCapabilityRow {
  readonly family: string;
  readonly stateLabel: string;
  readonly usable: boolean;
}

export interface HebyPanelViewModel {
  readonly workspaceLabel: string;
  readonly route: string;
  readonly regionLabel?: string;
  readonly entityLabel?: string;
  readonly capabilities: readonly HebyPanelCapabilityRow[];
  readonly unavailableSources: readonly string[];
  readonly authorityLabel: string;
  readonly mayExplain: readonly string[];
  /** Always "not-connected" in Phase 15. */
  readonly connectionState: HebyResponse["connectionState"];
  readonly responseLimitations: readonly string[];
}

/**
 * Build the panel view model for a route and an optional trigger context. Pure. The intent
 * defaults to EXPLAIN (the "Why?" affordance); it drives the correlation request only —
 * no model is called and the response is always the honest not-connected form.
 */
export function buildHebyPanelModel(input: {
  pathname: string;
  region?: HebySurfaceRegion;
  selectedEntity?: HebySelectedEntity;
  intent?: HebyProductIntent;
}): HebyPanelViewModel {
  const workspace = resolveHebyWorkspace(input.pathname);
  const context: HebyWorkspaceContext = resolveHebyWorkspaceContext({
    workspace,
    route: input.pathname,
    region: input.region,
    selectedEntity: input.selectedEntity,
  });

  const request = buildHebyRequest({
    intent: input.intent ?? "EXPLAIN",
    workspaceContext: context,
    selectedEntity: input.selectedEntity,
  });
  const response = notConnectedResponse(request);

  return {
    workspaceLabel: context.workspaceLabel,
    route: context.route,
    regionLabel: input.region?.label,
    entityLabel: input.selectedEntity?.label,
    capabilities: context.capabilities.map((c) => {
      const descriptor = HEBY_CAPABILITY_STATE_DESCRIPTORS[c.state as HebyCapabilityState];
      return { family: c.family, stateLabel: descriptor.label, usable: descriptor.usable };
    }),
    unavailableSources: context.sources.filter((s) => s.unavailable).map((s) => s.sourceClass),
    authorityLabel: HEBY_AUTHORITY_DESCRIPTORS[context.authority].label,
    mayExplain: context.mayExplain,
    connectionState: response.connectionState,
    responseLimitations: response.limitations,
  };
}
