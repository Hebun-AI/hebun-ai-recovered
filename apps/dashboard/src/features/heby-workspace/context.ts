/*
 * heby-workspace/context.ts — the truthful context model for the Heby Workspace (HW1).
 *
 * `/heby` is reachable directly and from a workspace, so it cannot assume where the user came
 * from. A workspace hint may be carried in the URL (`/heby?from=operations`), but the hint is NOT
 * authority: it is resolved here against the CLOSED set of known Heby workspace identities, on the
 * server, before anything is rendered or sent. An unknown, misspelled, or hostile value resolves to
 * the general context rather than being echoed back to the user or forwarded to the runtime.
 *
 * The resolved `route` is the only thing that crosses to the conversation authority, and the server
 * re-resolves it there anyway (`resolveHebyWorkspace`), so the hint can widen nothing: it selects
 * which already-visible read models scope the answer, never who the caller is or what they may see.
 *
 * Pure. No React, no I/O, no tenant, no secret.
 */

import {
  getHebyWorkspaceProfile,
  isHebyWorkspaceId,
  type HebyWorkspaceId,
} from "@/features/heby-integration";

/** The canonical route of the general (non-workspace) Heby context. */
export const HEBY_GENERAL_ROUTE = "/heby";

export interface HebyWorkspaceContextView {
  /** "workspace" when a valid hint resolved; "general" otherwise. */
  readonly scope: "general" | "workspace";
  /** Present only for the workspace scope. */
  readonly workspace?: HebyWorkspaceId;
  /** What the user is told Heby is looking at. Never a claim about connectivity. */
  readonly label: string;
  /**
   * The route handed to the conversation authority. For a workspace scope this is that
   * workspace's canonical route, so evidence is scoped exactly as it would be on that surface.
   */
  readonly route: string;
  /** Honest, complete `/context` body: what Heby has, and what it does not have. */
  readonly detail: readonly string[];
}

/**
 * Resolve the Heby Workspace context from an untrusted `from` hint. Fail-safe: anything that is not
 * a known workspace identity resolves to the general context.
 */
export function resolveHebyWorkspaceEntry(
  from: string | null | undefined,
): HebyWorkspaceContextView {
  if (typeof from === "string" && isHebyWorkspaceId(from)) {
    const profile = getHebyWorkspaceProfile(from);
    return {
      scope: "workspace",
      workspace: from,
      label: profile.label,
      route: profile.defaultRoute,
      detail: [
        `Current context: ${profile.label}.`,
        `Heby answers from the ${profile.label} read models for this route (${profile.defaultRoute}) and from the recent messages in this conversation.`,
        "It has no access to any other workspace's records from here, and it cannot act, execute, or approve anything.",
      ],
    };
  }

  return {
    scope: "general",
    label: "General Hebun workspace",
    route: HEBY_GENERAL_ROUTE,
    detail: [
      "Current context: General Hebun workspace.",
      "Heby answers from the organization-wide Command read models and from the recent messages in this conversation.",
      "It is not connected to every company system, and it cannot act, execute, or approve anything.",
    ],
  };
}
