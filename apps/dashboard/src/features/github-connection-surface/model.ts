/*
 * github-connection-surface/model.ts — WHAT A HUMAN IS TOLD ABOUT THE GITHUB CONNECTION.
 *
 * ── IT MAPS, IT NEVER INVENTS ────────────────────────────────────────────────
 *
 * Every field here is derived from an `IntegrationView` the connection authority produced, or from
 * one boolean about deployment configuration. There is no default, no placeholder, no "—" standing
 * in for a value nobody has, and no repository count, sync time or pull-request number — because
 * GITHUB-2 reads no repository and no pull request, so any such figure would be invented.
 *
 * That is the released `platform-integrations` discipline applied to one provider: a surface model
 * maps lifecycle onto sentences and refuses to derive one fact from another.
 *
 * ── PURE ────────────────────────────────────────────────────────────────────
 *
 * No React, no I/O, no database, no clock, no `process.env`. The page resolves the tenant, reads
 * the authority and hands the result here, which is what lets this file be tested without a
 * request.
 */
import type { ConnectionState, IntegrationView } from "@/features/integration-authority/contracts";
import { GITHUB_PROVIDER_KEY, parseGitHubPermission } from "@/features/provider-github/contracts";

export interface GitHubConnectionModel {
  readonly state: ConnectionState | "none";
  /** The organization login GitHub confirmed, or `null`. Never a guess. */
  readonly organizationLabel: string | null;
  /** The installation id, as GitHub reported it. An identifier, never a secret. */
  readonly installationId: string | null;
  /** GitHub's own statement of what it granted, normalised. Never what Hebun requested. */
  readonly grantedPermissions: readonly string[];
  readonly lastVerifiedAt: string | null;
  readonly failureReason: string | null;
  /** `true` only when this deployment is configured AND no live connection already exists. */
  readonly connectable: boolean;
  /** `true` when configuration is absent — the surface says so instead of offering a broken act. */
  readonly unconfigured: boolean;
}

/**
 * One sentence per lifecycle state.
 *
 * `unverified` is the honest awkward one: an installation id has been recorded and GitHub has not
 * confirmed it. In practice a tenant never sees it, because the callback verifies inside the same
 * transaction that records it — but the state is reachable in principle and a surface that could
 * not describe it would render a blank where a fact belongs.
 */
export const GITHUB_STATE_SENTENCES: Readonly<Record<ConnectionState | "none", string>> =
  Object.freeze({
    none: "No GitHub organization is connected.",
    draft: "An installation was started and never finished. Nothing is connected.",
    unverified: "An installation was recorded and GitHub has not confirmed it yet.",
    connected: "GitHub confirmed this organization's installation.",
    expired: "GitHub no longer accepts this installation. Re-installing is required.",
    revoked: "The installation was ended at GitHub.",
    disconnected: "This connection was ended in Hebun.",
  });

/**
 * Turn a normalised `name:level` permission into a sentence a human can act on.
 *
 * DERIVED FROM THE GRANT, NEVER FROM STATIC COPY. `tests/google-access-truth` exists because a
 * hard-coded sentence about access outlives the grant it describes; the same rule applies here, so
 * an unrecognised permission is described generically rather than omitted or guessed at.
 */
export function describeGitHubGrantedAccess(granted: readonly string[]): readonly string[] {
  const lines: string[] = [];
  for (const permission of granted) {
    const parsed = parseGitHubPermission(permission);
    if (!parsed) continue;
    if (parsed.name === "metadata" && parsed.level === "read") {
      lines.push("Read repository names, visibility and default branches.");
    } else if (parsed.name === "pull_requests" && parsed.level === "read") {
      lines.push("Read pull-request metadata.");
    } else {
      /*
       * GitHub granted something this release does not use. It is REPORTED, not hidden and not
       * treated as capability — an organization is entitled to see the access it actually gave.
       */
      lines.push(`Granted by the organization and unused by Hebun: ${permission}.`);
    }
  }
  return Object.freeze(lines);
}

/**
 * Build the surface model from the authority's own connections.
 *
 * The NEWEST non-terminal GitHub connection wins. Terminal rows are history — reconnecting creates
 * a new row by design — and showing a `disconnected` row beside a live one would present two
 * answers to one question.
 */
export function buildGitHubConnectionModel(
  connections: readonly IntegrationView[],
  configured: boolean,
): GitHubConnectionModel {
  const live = connections
    .filter(
      (c) =>
        c.providerKey === GITHUB_PROVIDER_KEY &&
        c.connectionState !== "disconnected" &&
        c.connectionState !== "revoked",
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  const state: ConnectionState | "none" = live ? live.connectionState : "none";

  return Object.freeze({
    state,
    organizationLabel: live?.externalAccountLabel ?? null,
    installationId: live?.externalAccountId ?? null,
    grantedPermissions: Object.freeze([...(live?.scopes ?? [])]),
    lastVerifiedAt: live?.lastVerifiedAt ?? null,
    failureReason: live?.failureReason ?? null,
    /*
     * The act is offered when the deployment can perform it and the tenant is not already
     * connected. A `draft` or `unverified` row is an unfinished attempt, so the act stays offered —
     * that is the only way out of either state.
     */
    connectable: configured && state !== "connected",
    unconfigured: !configured,
  });
}
