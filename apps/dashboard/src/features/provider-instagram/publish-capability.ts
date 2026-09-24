/*
 * provider-instagram/publish-capability.ts — is Instagram publishing POSSIBLE for this connection?
 * (PUBLISH-0)
 *
 * ── THE LADDER THIS ANSWERS ONE RUNG OF ──────────────────────────────────────
 *
 *   definition ≠ connection ≠ credential ≠ capability ≠ available ≠ authorized ≠ executed ≠ successful
 *
 * This decides `available` and nothing above it. `available` means: a real, connected, healthy
 * connection whose Meta-stated grant covers publishing, whose publishing identity Meta confirmed
 * at `/me` for the connection's own bound account, and for which Hebun declares the capability.
 * It does NOT mean anyone may publish. Authorization is Governance's; execution is the execution
 * authority's; arming is the tenant external-send authority's. None of them reads this as a yes.
 *
 * Pure. No I/O. The server resolver gathers the facts; this decides.
 */
import {
  INSTAGRAM_BUSINESS_BASIC_SCOPE,
  INSTAGRAM_CONTENT_PUBLISH_SCOPE,
  type InstagramPublishingIdentity,
  type InstagramResult,
} from "./contracts";

/** Why publishing is not available. Ordered: the first that applies is the headline. */
export type InstagramPublishUnavailableReason =
  | "capability-not-declared"
  | "no-connection"
  | "ambiguous-connection"
  | "not-connected"
  | "unhealthy"
  | "account-unbound"
  | "publish-scope-not-granted"
  | "publishing-identity-unavailable";

export type InstagramPublishCapability =
  | {
      readonly status: "available";
      readonly integrationId: string;
      readonly publishingAccountId: string;
    }
  | { readonly status: "unavailable"; readonly reason: InstagramPublishUnavailableReason };

/** The connection facts, as `integrations` records them. Never a credential. */
export interface PublishConnectionFacts {
  readonly integrationId: string;
  readonly connectionState: string;
  readonly health: string;
  readonly externalAccountId: string | null;
  readonly scopes: readonly string[];
}

/** Every non-terminal Instagram connection for ONE tenant, plus whether Hebun declares publishing. */
export interface PublishCapabilityFacts {
  readonly declared: boolean;
  readonly connections: readonly PublishConnectionFacts[];
}

const unavailable = (reason: InstagramPublishUnavailableReason): InstagramPublishCapability => ({
  status: "unavailable",
  reason,
});

/**
 * The connection-side verdict. Answers everything that can be answered WITHOUT contacting Meta, so
 * a connection that cannot publish is refused before any credential is opened.
 */
export function evaluatePublishConnection(
  facts: PublishCapabilityFacts,
):
  | { readonly status: "eligible"; readonly connection: PublishConnectionFacts & { readonly externalAccountId: string } }
  | { readonly status: "unavailable"; readonly reason: InstagramPublishUnavailableReason } {
  if (!facts.declared) return { status: "unavailable", reason: "capability-not-declared" };
  const live = facts.connections.filter(
    (c) => c.connectionState !== "disconnected" && c.connectionState !== "revoked",
  );
  if (live.length === 0) return { status: "unavailable", reason: "no-connection" };
  /* Two accounts means Hebun would have to choose one. It does not choose; it refuses. */
  if (live.length > 1) return { status: "unavailable", reason: "ambiguous-connection" };
  const connection = live[0]!;
  if (connection.connectionState !== "connected") return { status: "unavailable", reason: "not-connected" };
  if (connection.health !== "healthy") return { status: "unavailable", reason: "unhealthy" };
  if (connection.externalAccountId === null) return { status: "unavailable", reason: "account-unbound" };
  if (
    !connection.scopes.includes(INSTAGRAM_BUSINESS_BASIC_SCOPE) ||
    !connection.scopes.includes(INSTAGRAM_CONTENT_PUBLISH_SCOPE)
  ) {
    return { status: "unavailable", reason: "publish-scope-not-granted" };
  }
  return {
    status: "eligible",
    connection: { ...connection, externalAccountId: connection.externalAccountId },
  };
}

/** The full verdict: the connection side, then Meta's own answer about the publishing identity. */
export function derivePublishCapability(
  facts: PublishCapabilityFacts,
  identity: InstagramResult<InstagramPublishingIdentity> | null,
): InstagramPublishCapability {
  const eligibility = evaluatePublishConnection(facts);
  if (eligibility.status === "unavailable") return unavailable(eligibility.reason);
  if (identity === null || !identity.ok) return unavailable("publishing-identity-unavailable");
  /* The identity must be the one this connection was verified as. The transport already refuses a
   * mismatch; re-checking here keeps the verdict true even for an injected identity. */
  if (identity.value.appScopedAccountId !== eligibility.connection.externalAccountId) {
    return unavailable("publishing-identity-unavailable");
  }
  return {
    status: "available",
    integrationId: eligibility.connection.integrationId,
    publishingAccountId: identity.value.publishingAccountId,
  };
}
