/*
 * platform-integrations/model.ts — the Integrations truth model.
 *
 * ── THE DEFECT THIS FILE USED TO BE ─────────────────────────────────────────
 *
 * It read `provider-matrix/provider-catalog` — the OFFLINE SIMULATION descriptor set — and derived
 * every connection claim from it, including a hard-coded `connected: []` and the headline
 * "No integration connected". That was true while no connection authority existed. It stopped being
 * true the moment a tenant completed a real Google authorization, and it could not notice, because
 * a simulation catalog is structurally incapable of knowing what a tenant connected.
 *
 * ── THE SEAM IT READS NOW ───────────────────────────────────────────────────
 *
 * `integration-authority`, and nothing else, decides what is connected. This module is handed an
 * already-resolved `ConnectionListing` — it performs NO I/O, holds NO database handle and resolves
 * NO tenant, so it cannot read a row this tenant does not own even by mistake. The caller does the
 * authorized read; this function only renders it.
 *
 * ── WHY THE LISTING IS A REQUIRED PARAMETER ─────────────────────────────────
 *
 * A default of `[]` would let any caller — a future page, a test, a careless refactor — render
 * "none connected" for a tenant who has one. The absent argument would be a compile error today and
 * a false product claim tomorrow, so there is no default. Forgetting to read the authority is
 * unrepresentable rather than merely discouraged.
 *
 * ── IT CANNOT SEE A SECRET ──────────────────────────────────────────────────
 *
 * `IntegrationView` from the authority carries no credential field, this module imports the
 * credential authority NOWHERE, and it never learns whether a credential exists. So it cannot infer
 * a connection from a stored secret — the only thing that produces `connected` here is the
 * `connection_state` column, written by the one writer that requires a real provider response.
 *
 * Pure data. No React, no I/O, no clock, no secrets.
 */

import { providerCatalog } from "@/features/provider-matrix/provider-catalog";
import { findProviderDefinition } from "@/features/provider-catalog/catalog";
import {
  isHealthUsable,
  type ConnectionHealth,
  type ConnectionListing,
  type IntegrationView as AuthorityConnection,
} from "@/features/integration-authority/contracts";
import type {
  ConnectedIntegrationView,
  IntegrationsModel,
  IntegrationsReadiness,
  IntegrationView,
  RecordedNotConnectedView,
} from "@/features/platform-integrations/contracts";

// Provider descriptor types that represent an external integration surface (not model inference).
const INTEGRATION_TYPES = new Set(["Repository Provider", "Communication Provider", "Browser Provider"]);

/** Offline simulation descriptors. Rendered under their own heading and never as connections. */
function descriptorCandidates(): IntegrationView[] {
  return providerCatalog
    .filter((entry) => INTEGRATION_TYPES.has(entry.providerType))
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      providerType: entry.providerType,
      state: "descriptor-only",
      /*
       * `liveSupport` is false for every descriptor and a released test asserts it. The ternary is
       * kept so that a descriptor which somehow claimed live support would still not be able to
       * spell the word this surface reserves for authority rows: it reads "Descriptor only".
       */
      connectionState: entry.liveSupport ? "Descriptor claims live support" : "Not connected",
      credentialStatus: entry.credentialStatus,
      note: "Offline descriptor. No adapter is authenticated and no credential is injected.",
    }));
}

/** The provider's own name, from the definition authority. Falls back to the stored row name. */
function providerLabelFor(connection: AuthorityConnection): string {
  const definition = connection.providerKey ? findProviderDefinition(connection.providerKey) : undefined;
  return definition?.label ?? connection.name;
}

/**
 * WHAT THIS CONNECTION CAN ACTUALLY BE USED FOR — derived from the catalog definition, never typed
 * out per provider.
 *
 * `capabilityScopes` is empty for `google-workspace` because INT-3 requested no scope that permits
 * reading anything. Deriving the sentence means the day a capability is added, this line changes by
 * itself rather than staying a stale reassurance somebody has to remember to edit.
 */
function capabilityStatementFor(connection: AuthorityConnection): string {
  const definition = connection.providerKey ? findProviderDefinition(connection.providerKey) : undefined;
  const capabilities = definition ? Object.keys(definition.capabilityScopes).sort() : [];
  if (capabilities.length === 0) {
    return "Identity verification only. This connection grants Hebun no data capability — no file, calendar, message or directory read, because no scope permitting one was requested.";
  }
  return `Capabilities this provider defines: ${capabilities.join(", ")}. Whether each can be answered right now is the availability seam's answer, not this page's.`;
}

/**
 * WHAT KIND OF ACCOUNT THIS IS — stated from what was RECORDED, never from what can be guessed.
 *
 * Google's `hd` claim is the only evidence of a Workspace domain, it is observed by the transport,
 * and no column stores it. So `verifiedDomain` is null for every connection that exists today and
 * the honest sentence is the consumer-safe one.
 *
 * The email domain is deliberately NOT consulted. `someone@acme.com` may be a Workspace account or
 * a consumer account using a custom address, and Hebun cannot tell them apart from the label. A
 * surface that split on the address would print "verified Workspace domain" on a guess.
 */
function accountKindStatementFor(verifiedDomain: string | null): string {
  if (verifiedDomain) {
    return `Google Account in the verified Workspace domain ${verifiedDomain}.`;
  }
  return "Google Account. No verified Google Workspace domain was recorded for this connection, so none is claimed.";
}

/** One sentence covering lifecycle AND health, which are separate facts and stay separate here. */
function stateStatementFor(health: ConnectionHealth): string {
  if (isHealthUsable(health)) {
    return "Connected, and the last observation of this provider succeeded.";
  }
  if (health === "unknown") {
    return "Connected. Hebun holds no current health observation for this provider, so it makes no claim that a call would succeed.";
  }
  return "Connected. The provider is not answering right now — the authorization is unaffected and no reconnection is needed.";
}

function toConnectedView(connection: AuthorityConnection): ConnectedIntegrationView {
  /*
   * NOT PERSISTED ANYWHERE — see `accountKindStatementFor`. Written as a named constant rather than
   * an inline `null` so that the phase which adds an `hd` column has one obvious place to change,
   * and so a reader can see that the absence is a decision.
   */
  const verifiedDomain: string | null = null;

  return {
    integrationId: connection.integrationId,
    providerLabel: providerLabelFor(connection),
    providerKey: connection.providerKey ?? "",
    connectionState: "connected",
    health: connection.health,
    healthUsable: isHealthUsable(connection.health),
    stateStatement: stateStatementFor(connection.health),
    accountLabel: connection.externalAccountLabel,
    verifiedDomain,
    accountKindStatement: accountKindStatementFor(verifiedDomain),
    lastVerifiedAt: connection.lastVerifiedAt,
    scopes: connection.scopes,
    scopeCount: connection.scopes.length,
    capabilityStatement: capabilityStatementFor(connection),
  };
}

function toRecordedView(connection: AuthorityConnection): RecordedNotConnectedView {
  return {
    integrationId: connection.integrationId,
    providerLabel: providerLabelFor(connection),
    connectionState: connection.connectionState as RecordedNotConnectedView["connectionState"],
  };
}

const DISTINCTIONS: readonly string[] = Object.freeze([
  "A provider descriptor is not an authenticated integration.",
  "An adapter is not a connection.",
  "A stored credential is not a connection — only a verified provider response makes one.",
  "A connection is not an authorization to write; nothing on this page grants or implies one.",
]);

function headlineFor(readiness: IntegrationsReadiness, connectedCount: number): { headline: string; note: string } {
  if (readiness === "no-tenant-context") {
    return {
      headline: "Connection truth unavailable",
      note: "No authorized tenant context resolved for this request, so the connection authority was not read. This is not a statement that nothing is connected.",
    };
  }
  if (readiness === "persistence-unavailable") {
    return {
      headline: "Connection truth unavailable",
      note: "The connection authority could not be reached, so no connection state could be read. This is not a statement that nothing is connected.",
    };
  }
  if (connectedCount === 0) {
    return {
      headline: "No integration connected",
      note: "Read from the tenant's connection authority: this organization currently holds no connected integration. Offline provider descriptors below are simulation definitions, not connections.",
    };
  }
  return {
    headline: connectedCount === 1 ? "1 integration connected" : `${connectedCount} integrations connected`,
    note: "Read from the tenant's connection authority. Each connection below was confirmed by a real provider response. No credential, token or vault detail is shown or reachable from this page.",
  };
}

/**
 * Fold the tenant's authority listing and the offline descriptor catalog into one honest page.
 *
 * The listing is REQUIRED. See the header.
 */
export function getIntegrationsModel(listing: ConnectionListing): IntegrationsModel {
  const readiness: IntegrationsReadiness =
    listing.status === "read"
      ? "authority-read"
      : listing.reason === "no-authorized-tenant-context"
        ? "no-tenant-context"
        : "persistence-unavailable";

  const connections = listing.status === "read" ? listing.connections : [];

  const connected = connections
    .filter((c) => c.connectionState === "connected")
    .map(toConnectedView);

  const recordedNotConnected = connections
    .filter((c) => c.connectionState !== "connected")
    .map(toRecordedView);

  const { headline, note } = headlineFor(readiness, connected.length);

  return {
    readiness,
    state: {
      provenance: "integration-authority",
      connectedCount: connected.length,
      headline,
      note,
    },
    connected,
    recordedNotConnected,
    candidates: descriptorCandidates(),
    distinctions: DISTINCTIONS,
  };
}
