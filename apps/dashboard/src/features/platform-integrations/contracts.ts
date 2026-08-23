/*
 * platform-integrations/contracts.ts — read-only view-model contracts for the authoritative
 * Integrations surface.
 *
 * ── WHAT CHANGED IN INT-3.1, AND WHY ────────────────────────────────────────
 *
 * Through Phase 24C this file encoded a fact that was TRUE when it was written: no real integration
 * existed, so `connected` was typed `readonly never[]` — not merely empty, but UNINHABITABLE. That
 * type was the honest statement of a deployment with no connection authority at all.
 *
 * INT-1, INT-2 and INT-3 built one, and a tenant has now completed a real Google authorization. The
 * `never[]` therefore became a false claim expressed as a type: a surface that CANNOT represent a
 * connection will report "none connected" forever, however many exist.
 *
 * ── THIS SURFACE READS TRUTH; IT NEVER OWNS IT ──────────────────────────────
 *
 *   integration-authority     owns whether a tenant has a connection and what state it is in.
 *   integration-credentials   owns secrets. NOTHING HERE CAN SEE ONE.
 *   provider-catalog          owns which providers are connectable, and their labels.
 *   provider-matrix           owns offline simulation descriptors. NOT connection truth.
 *
 * This module derives a rendering from the first three and can contradict none of them. There is no
 * field on which a Platform surface could record its own opinion of "connected".
 *
 * ── THE SECRET BOUNDARY IS STRUCTURAL, NOT EDITORIAL ────────────────────────
 *
 * `ConnectedIntegrationView` has NO field for a credential, a token, a ciphertext, an iv, an auth
 * tag, a key id, an algorithm, an expiry or even the BOOLEAN "a credential exists". A surface that
 * learned a secret existed would eventually say so, and "a credential is stored" is one careless
 * sentence away from "this connection works" — which only a real provider response may establish.
 *
 * It also omits `externalAccountId` — Google's `sub`. The account LABEL is what a human needs to
 * recognise their own connection; the subject id is a stable cross-service identifier with no
 * reason to be on a screen.
 *
 * Pure types. No React, no I/O, no database, no clock.
 */

import type { ConnectionHealth, ConnectionState } from "@/features/integration-authority/contracts";

/* ── Offline descriptors (unchanged in meaning) ─────────────────────────────── */

export type IntegrationState = "descriptor-only" | "adapter-available" | "not-connected" | "auth-not-configured";

/** A provider-matrix simulation descriptor. It is NOT a connection and can never become one here. */
export interface IntegrationView {
  readonly id: string;
  readonly name: string;
  readonly providerType: string;
  readonly state: IntegrationState;
  readonly connectionState: string;
  readonly credentialStatus: string;
  readonly note: string;
}

/* ── Real connections ───────────────────────────────────────────────────────── */

/**
 * A connection the tenant actually holds, as a human may see it.
 *
 * `connectionState` is pinned to the literal `"connected"` on purpose. This type cannot be used to
 * render an unverified, expired or disconnected row as though it belonged in a Connected list —
 * the compiler refuses it, so requirement 6 is enforced by the type rather than by a filter that a
 * later edit could widen.
 */
export interface ConnectedIntegrationView {
  /** Hebun's own row id. Used as a render key; it names no external account. */
  readonly integrationId: string;
  /** From the provider-catalog definition — the PROVIDER's name, never a claim about the account. */
  readonly providerLabel: string;
  readonly providerKey: string;
  readonly connectionState: Extract<ConnectionState, "connected">;
  readonly health: ConnectionHealth;
  /** `true` only for `healthy`. `unknown` is NOT usable — see integration-authority. */
  readonly healthUsable: boolean;
  /** One honest sentence about lifecycle AND health together. */
  readonly stateStatement: string;
  /** The verified account label as the provider stated it. Never derived from anything else. */
  readonly accountLabel: string | null;
  /**
   * A verified hosted-domain observation, or `null`.
   *
   * IT IS ALWAYS `null` TODAY, and that is a measured fact, not a placeholder: Google's `hd` claim
   * is observed by the transport and PERSISTED NOWHERE. Nothing this surface can read has ever
   * recorded a domain, so nothing here may claim one. It is NEVER inferred from the email address —
   * an address domain is not an admin-verified domain, and treating it as one is precisely the
   * false Workspace claim requirement 7 forbids.
   */
  readonly verifiedDomain: string | null;
  /** What kind of account this is, stated from what was actually recorded. */
  readonly accountKindStatement: string;
  readonly lastVerifiedAt: string | null;
  /** Exactly what the provider said it granted. Never what Hebun requested. */
  readonly scopes: readonly string[];
  readonly scopeCount: number;
  /** What this connection can actually be used for, derived from the catalog definition. */
  readonly capabilityStatement: string;
}

/**
 * An authority row that exists and is NOT connected.
 *
 * It exists so a non-connected record can never be silently dropped. A surface that rendered only
 * connected rows would answer "nothing here" for a tenant holding an expired grant that needs their
 * attention — an omission that reads exactly like an absence.
 *
 * It deliberately carries NO account label, NO scopes and NO timestamps: it is a count-and-state
 * statement, not a second connection card.
 */
export interface RecordedNotConnectedView {
  readonly integrationId: string;
  readonly providerLabel: string;
  readonly connectionState: Exclude<ConnectionState, "connected">;
}

/* ── The banner ─────────────────────────────────────────────────────────────── */

/**
 * WHERE THIS SURFACE'S CONNECTION TRUTH CAME FROM.
 *
 * Before INT-3.1 this field held `"not-connected"` — a STATE, hard-coded, which is why it could not
 * stop being true. It now names the SOURCE, which is a fact about the architecture rather than
 * about today's data, and the state is carried by `connectedCount` where it can move.
 */
export type IntegrationsProvenance = "integration-authority";

export interface IntegrationsStateBanner {
  readonly provenance: IntegrationsProvenance;
  /** Derived from the authority listing. The headline is written from this, never independently. */
  readonly connectedCount: number;
  readonly headline: string;
  readonly note: string;
}

/** Why the connection truth could not be read at all — distinct from "read, and it was empty". */
export type IntegrationsReadiness = "authority-read" | "no-tenant-context" | "persistence-unavailable";

export interface IntegrationsModel {
  readonly readiness: IntegrationsReadiness;
  readonly state: IntegrationsStateBanner;
  /** Real connections, from integration-authority. */
  readonly connected: readonly ConnectedIntegrationView[];
  /** Real authority rows that are not connected. Surfaced so none is hidden. */
  readonly recordedNotConnected: readonly RecordedNotConnectedView[];
  /** provider-matrix simulation descriptors. Never connection truth. */
  readonly candidates: readonly IntegrationView[];
  readonly distinctions: readonly string[];
}
