/*
 * social-intelligence/platform-presence.ts — is this social platform actually connected for this
 * organization?
 *
 * ── THE FIELD THIS FILE MUST NOT READ, AND CANNOT ───────────────────────────
 *
 * The `integrations` table carries a `status` column which, in production today, reads `pending` on
 * EVERY row — including the Instagram and YouTube connections that are genuinely live and have been
 * observed through repeatedly. A surface that derived "connected" from `status` would report this
 * organization as having no social platforms at all while Hebun was successfully reading them.
 *
 * `IntegrationView` — the released read model — does not expose `status`. That is not an accident to
 * work around; it is the authority stating which fields mean what. This file consumes the view and
 * therefore CANNOT reach the misleading column.
 *
 * ── LIVE IS A CONJUNCTION, NOT A STATE ──────────────────────────────────────
 *
 * `connectionState === "connected"` says the grant exists. `health === "healthy"` says the provider
 * is answering. Neither alone is "this card may show numbers as current standing": a degraded
 * connection has an intact grant and a silent provider, which is a real and different situation and
 * gets its own answer. The released `isHealthUsable` predicate decides the second clause, so the
 * definition of usable health lives in one place for the whole product.
 *
 * ── WHY THIS ONE MODULE SERVES BOTH PLATFORMS ───────────────────────────────
 *
 * The measurement derivations refuse to share code, because Instagram and YouTube do not share
 * metric semantics. Connection state is the opposite case: there is ONE table, ONE state machine and
 * ONE health vocabulary, defined provider-agnostically by the integration authority itself. Copying
 * this logic per platform would create two places for the `status`-column trap to reappear, and no
 * honesty would be bought with it.
 *
 * A PURE DERIVATION. No database, no tenant resolution, no provider, no clock — it is handed the
 * result the released connection read already produced.
 */
import {
  isHealthUsable,
  type ConnectionHealth,
  type ConnectionListing,
  type ConnectionRefusal,
  type ConnectionState,
} from "@/features/integration-authority/contracts";

/**
 * What is known about one platform's connection.
 *
 * `not-live` deliberately covers both "no connection was ever made" and "a connection exists but is
 * draft/expired/revoked", carrying the state so the surface can say which. `unknown` is its own
 * answer and never collapses into `not-live`: **Hebun failing to read its own records is not
 * evidence that this organization connected nothing.**
 */
export type SocialPlatformPresence =
  | {
      readonly status: "live";
      readonly accountLabel: string | null;
      readonly lastVerifiedAt: string | null;
    }
  | {
      readonly status: "impaired";
      readonly accountLabel: string | null;
      readonly health: ConnectionHealth;
      readonly failureReason: string | null;
    }
  | {
      readonly status: "not-live";
      /** `null` when this organization has no connection row for the platform at all. */
      readonly connectionState: ConnectionState | null;
    }
  | { readonly status: "unknown"; readonly reason: ConnectionRefusal };

/**
 * Resolve one platform's presence from the released connection listing.
 *
 * ── THE NEWEST ROW DECIDES ──────────────────────────────────────────────────
 *
 * Production holds MORE THAN ONE row per provider — a re-authorization inserts rather than updates,
 * so Instagram and YouTube each have two. Scanning for "any connected row" would let a superseded
 * grant keep a card alive after the current one was revoked; taking the first row in table order
 * would make the answer depend on the database's scan. The most recently created row is the one this
 * organization last established, and it is the only one consulted — exactly as the released
 * Instagram connection model already decides the same question.
 */
export function resolveSocialPlatformPresence(
  listing: ConnectionListing,
  providerKey: string,
): SocialPlatformPresence {
  if (listing.status === "unavailable") {
    return Object.freeze({ status: "unknown" as const, reason: listing.reason });
  }

  const current = listing.connections
    .filter((connection) => connection.providerKey === providerKey)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  if (!current) return Object.freeze({ status: "not-live" as const, connectionState: null });

  if (current.connectionState !== "connected") {
    return Object.freeze({ status: "not-live" as const, connectionState: current.connectionState });
  }

  if (!isHealthUsable(current.health)) {
    return Object.freeze({
      status: "impaired" as const,
      accountLabel: current.externalAccountLabel,
      health: current.health,
      failureReason: current.failureReason,
    });
  }

  return Object.freeze({
    status: "live" as const,
    accountLabel: current.externalAccountLabel,
    lastVerifiedAt: current.lastVerifiedAt,
  });
}

/**
 * A platform earns a card when Hebun has a grant for it — live or impaired.
 *
 * An impaired platform is still a platform this organization connected, and hiding it would report
 * a silent provider as an absent one. A `not-live` or `unknown` platform earns no card, because a
 * card is a claim about an organization's reach.
 */
export function hasStanding(presence: SocialPlatformPresence): boolean {
  return presence.status === "live" || presence.status === "impaired";
}

/** What each presence means, in the words a human should read. No verdicts, no advice. */
export const SOCIAL_PRESENCE_SENTENCES: Readonly<Record<SocialPlatformPresence["status"], string>> =
  Object.freeze({
    live: "The grant is intact and the provider is answering.",
    impaired:
      "The grant is intact but the provider is not answering right now. Nothing was revoked and no " +
      "reconnection is needed.",
    "not-live": "No usable connection is bound to this organization.",
    unknown:
      "Hebun could not read its own connection records just now, so whether this platform is " +
      "connected is unknown. This is not a statement that it is not.",
  });
