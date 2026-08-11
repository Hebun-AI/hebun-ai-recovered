/*
 * heby-surface/surface-state.ts — THE Heby presentation-state model (HW3).
 *
 * Heby is ONE system with TWO presentation surfaces. This module owns which surface is showing and
 * nothing else. It is deliberately the narrowest possible boundary:
 *
 *   PRESENTATION STATE ONLY. It resolves no tenant, holds no conversation, selects no provider,
 *   reads no evidence, and touches no runtime. Nothing here can widen what Heby may read or do —
 *   the conversation authority (askHebyAction → server-resolved TenantContext → R2E kill-switch →
 *   bounded history → durable conversation) is completely untouched by which surface is open.
 *
 * MUTUAL EXCLUSIVITY IS STRUCTURAL, NOT DEFENSIVE. The surface is a single discriminated value
 * derived by one pure function, and the Full Workspace is a ROUTE. There is no pair of booleans
 * that could both be true, so "quick panel behind the full workspace" is not a bug that has to be
 * prevented — it is unrepresentable.
 *
 * Pure. No React, no router, no I/O, no authority.
 */

import { isHebyWorkspaceId, getHebyWorkspaceProfile, resolveHebyWorkspace } from "@/features/heby-integration";

/** The Full Workspace route. The one Heby surface that is a navigation destination. */
export const HEBY_WORKSPACE_ROUTE = "/heby";

/**
 * The canonical safe return target when Heby has no validated workspace to go back to. Repository
 * reality already owns this default: `/` redirects to `/command`, and Command is the organization-
 * wide landing surface. It is a fixed constant — never a value derived from a caller.
 */
export const HEBY_FALLBACK_ROUTE = "/command";

/** The three — and only three — Heby presentation states. */
export type HebySurfaceState = "closed" | "quick-panel" | "full-workspace";

/** Which Heby control was operated. Each control owns exactly one surface. */
export type HebySurfaceControl = "topbar" | "rail";

/**
 * What the caller must do to satisfy a transition. Returned as DATA so every transition is decided
 * in one provable place and executed by a thin adapter — never as scattered ad-hoc click handlers.
 */
export type HebySurfaceCommand =
  /** Show the Quick Panel over the current workspace. No navigation. */
  | { readonly kind: "open-quick" }
  /** Hide the Quick Panel. The current workspace is untouched. */
  | { readonly kind: "close-quick" }
  /** Leave for the Full Workspace. Any open Quick Panel is closed by the same command. */
  | { readonly kind: "enter-workspace"; readonly href: string }
  /** Leave the Full Workspace for `href`, optionally opening the Quick Panel on arrival. */
  | { readonly kind: "leave-workspace"; readonly href: string; readonly openQuick: boolean };

export function isHebyWorkspaceRoute(pathname: string): boolean {
  return pathname === HEBY_WORKSPACE_ROUTE || pathname.startsWith(`${HEBY_WORKSPACE_ROUTE}/`);
}

/**
 * Resolve the single active surface. The route WINS: while the operator is on `/heby` the state is
 * `full-workspace` regardless of any lingering quick-panel request, so the two surfaces can never
 * be active — or mounted — at the same time.
 */
export function resolveHebySurfaceState(input: {
  readonly pathname: string;
  readonly quickPanelRequested: boolean;
}): HebySurfaceState {
  if (isHebyWorkspaceRoute(input.pathname)) return "full-workspace";
  return input.quickPanelRequested ? "quick-panel" : "closed";
}

/**
 * The Full Workspace href for the surface the operator is currently on. The current workspace
 * travels as a HINT only: it is a closed identity from the workspace registry, never free text
 * scraped from the page, and the server re-resolves it and falls back to the general context if it
 * does not recognize it. From inside Heby itself this is the plain route — Heby never hints at
 * itself.
 */
export function hebyWorkspaceHref(pathname: string): string {
  if (isHebyWorkspaceRoute(pathname)) return HEBY_WORKSPACE_ROUTE;
  return `${HEBY_WORKSPACE_ROUTE}?from=${resolveHebyWorkspace(pathname)}`;
}

/**
 * Resolve where closing the Full Workspace returns to, from an UNTRUSTED `from` hint.
 *
 * SECURITY: this is a closed allow-list, not a sanitizer. The hint must be EXACTLY one of the eight
 * known Heby workspace identities; the returned route is then read from the registry's own hardcoded
 * profile, so the caller's string is never echoed into a URL. Everything else — an absolute URL, a
 * protocol-relative URL, a `javascript:` URI, traversal, markup, or any arbitrary path — is not an
 * identity, resolves to the canonical fallback, and therefore cannot produce an open redirect.
 *
 * `from` is navigation data. It is NEVER tenant authority and grants access to nothing.
 */
export function resolveHebyReturnRoute(from: string | null | undefined): string {
  if (typeof from === "string" && isHebyWorkspaceId(from)) {
    return getHebyWorkspaceProfile(from).defaultRoute;
  }
  return HEBY_FALLBACK_ROUTE;
}

/** The human-readable name of the return target, for the Full Workspace's close control. */
export function resolveHebyReturnLabel(from: string | null | undefined): string {
  if (typeof from === "string" && isHebyWorkspaceId(from)) {
    return getHebyWorkspaceProfile(from).label;
  }
  return getHebyWorkspaceProfile("command").label;
}

/**
 * THE transition table. Every Heby surface change in the product resolves here.
 *
 *   topbar = "ask without leaving my work"     → owns the Quick Panel
 *   rail   = "enter Heby's dedicated workspace" → owns the Full Workspace
 *
 * Both controls are true toggles, and each one closes the other surface rather than stacking on it.
 */
export function planHebyTransition(input: {
  readonly state: HebySurfaceState;
  readonly control: HebySurfaceControl;
  /** The route the operator is on — used to build the workspace hint. */
  readonly pathname: string;
  /** Where leaving the Full Workspace returns to. Already resolved through the allow-list. */
  readonly returnRoute: string;
}): HebySurfaceCommand {
  const { state, control, pathname, returnRoute } = input;

  if (control === "topbar") {
    if (state === "full-workspace") {
      // Leave Heby's workspace, restore the previous surface, and continue the conversation there.
      return { kind: "leave-workspace", href: returnRoute, openQuick: true };
    }
    return state === "quick-panel" ? { kind: "close-quick" } : { kind: "open-quick" };
  }

  // rail
  if (state === "full-workspace") {
    return { kind: "leave-workspace", href: returnRoute, openQuick: false };
  }
  // From CLOSED or from QUICK_PANEL: entering the workspace closes the panel by construction.
  return { kind: "enter-workspace", href: hebyWorkspaceHref(pathname) };
}
