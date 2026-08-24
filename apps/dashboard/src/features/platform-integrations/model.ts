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
  type CapabilityAvailabilityView,
  type ConnectionHealth,
  type ConnectionListing,
  type IntegrationView as AuthorityConnection,
} from "@/features/integration-authority/contracts";
import type {
  ConnectedCapabilityView,
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

/** Human-facing capability names. From this repository — a provider never names its own feature here. */
const CAPABILITY_LABELS: Readonly<Record<string, string>> = Object.freeze({
  "google.drive.metadata.read": "Drive metadata access",
  "github.repository.activity.read": "Repository activity",
});

/**
 * WHAT AN AVAILABLE CAPABILITY ACTUALLY MEANS — one sentence per capability, keyed by capability.
 *
 * ── THE DEFECT THIS MAP EXISTS TO MAKE UNREPEATABLE ─────────────────────────
 *
 * This sentence used to be a single hard-coded string describing Google Drive, emitted for EVERY
 * available capability of EVERY provider. It was written when one capability existed, and it read
 * as true because the only provider was Google. The moment a second provider connected, the GitHub
 * card told a tenant that Hebun "reads no file content, and holds no permission to change anything
 * in Drive" — a sentence about a product GitHub does not have, printed as a fact about their
 * GitHub organization.
 *
 * A provider-blind sentence is not a copy problem. It is a claim about access, and it was wrong.
 *
 * ── THE FALLBACK SAYS LESS, NOT SOMETHING ELSE ──────────────────────────────
 *
 * An unmapped capability gets a sentence that names no product, no scope and no endpoint. A
 * capability nobody has written a sentence for must under-describe itself; it may never borrow the
 * previous provider's.
 */
const CAPABILITY_AVAILABLE_STATEMENTS: Readonly<Record<string, string>> = Object.freeze({
  "google.drive.metadata.read":
    "Available. Read-only file discovery and metadata. Hebun reads no file content, and holds no permission to change anything in Drive.",
  /*
   * AVAILABLE IS NOT EXECUTABLE, AND THIS SENTENCE REFUSES TO COLLAPSE THEM.
   *
   * The grant covers this capability — GitHub's own granted permission list says so. No released
   * seam reads a repository or a pull request: the GitHub transport knows exactly one address,
   * `GET /app/installations/{id}`, and the acceptance reachability gate reports this capability
   * `NOT-IMPLEMENTED (0 seam)`. Saying only "Available" here would let a tenant read execution
   * into a permission.
   */
  "github.repository.activity.read":
    "Available. GitHub granted the read permissions this capability declares. Read-only — this release reads no repository and no pull request, and holds no permission to change anything at GitHub.",
});

/**
 * WHAT THIS TENANT CAN ACTUALLY DO RIGHT NOW — read from the availability seam, never the catalog.
 *
 * ── THE DISTINCTION THIS FUNCTION EXISTS TO HOLD ────────────────────────────
 *
 * Before INT-4 this sentence was derived from the provider definition's `capabilityScopes`, which
 * was empty, so "identity verification only" was true for everyone. The moment Drive was added to
 * the catalog that derivation became a LIE: it would have told a tenant holding identity-only
 * scopes that Drive metadata access is what this provider does — which reads as having it.
 *
 * The catalog says what a capability WOULD need. Only the availability seam knows whether THIS
 * tenant's grant covers it, and only it consults health and lifecycle too.
 */
function capabilitiesFor(
  connection: AuthorityConnection,
  availability: CapabilityAvailabilityView | null,
): readonly ConnectedCapabilityView[] {
  if (!availability) return Object.freeze([]);

  const views: ConnectedCapabilityView[] = [];
  for (const entry of availability.capabilities) {
    /* Only capabilities THIS connection is a source for. Another connection's grant is not this one's. */
    const source = entry.sources.find((s) => s.integrationId === connection.integrationId);
    if (!source) continue;

    const available = entry.state === "available" && source.readAvailable;
    const label = CAPABILITY_LABELS[entry.capability] ?? entry.capability;
    views.push({
      capability: entry.capability,
      label,
      state: entry.state,
      available,
      statement: available
        ? (CAPABILITY_AVAILABLE_STATEMENTS[entry.capability] ??
          "Available. The provider granted what this capability declares.")
        : `Not available. ${entry.reason ?? "The provider has not granted what this capability needs."}`,
    });
  }
  return Object.freeze(views);
}

/**
 * One sentence for the whole set, written from what the list ACTUALLY carries.
 *
 * It can never imply a capability the rows below do not show, because it is computed from them.
 */
function capabilityStatementFor(capabilities: readonly ConnectedCapabilityView[]): string {
  const granted = capabilities.filter((c) => c.available);
  if (capabilities.length === 0) {
    return "Identity verification only. This connection grants Hebun no data capability — no file, calendar, message or directory read, because no scope permitting one was requested.";
  }
  if (granted.length === 0) {
    return "Identity verification only. The capabilities this provider defines are listed below and none is granted to this organization yet.";
  }
  return `Granted: ${granted.map((c) => c.label).join(", ")}. Read-only — no write capability exists for this provider in this release.`;
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
 *
 * ── WHY IT NOW ASKS THE CATALOG WHICH KIND OF ACCOUNT THIS PROVIDER BINDS ───
 *
 * This function used to open with the words "Google Account" for every connection of every
 * provider, because when it was written every connection was Google's. A verified GitHub
 * ORGANIZATION therefore read as a Google Account with no Workspace domain — two false claims in
 * one sentence, on a page whose whole purpose is that a connection claim is never a guess.
 *
 * The discriminator is `accountIdentity` on the released catalog entry: `account` for Google,
 * `organization` for GitHub. It is not inferred from the label, the scopes or the provider key's
 * spelling — a connection reaches `connected` only through a verifier that already enforced the
 * catalog's account identity, so the entry is a record of what was verified rather than a guess.
 *
 * A provider with no catalog entry gets the sentence that claims the least: the account was
 * verified, and nothing further is asserted about what kind it is.
 */
function accountKindStatementFor(
  connection: AuthorityConnection,
  verifiedDomain: string | null,
): string {
  const definition = connection.providerKey ? findProviderDefinition(connection.providerKey) : undefined;

  if (definition?.accountIdentity === "organization") {
    return `${providerLabelFor(connection)} organization. This connection is bound to an organization the provider verified, never to an individual account, and no claim is made about its members.`;
  }

  /*
   * The Workspace-domain sentences are GOOGLE'S, and they are keyed by Google's provider key rather
   * than by `accountIdentity`, so a future second account-identity provider cannot inherit them the
   * way GitHub inherited them. `hd` is a Google concept; nothing else can have one.
   */
  if (connection.providerKey === "google-workspace") {
    if (verifiedDomain) {
      return `Google Account in the verified Workspace domain ${verifiedDomain}.`;
    }
    return "Google Account. No verified Google Workspace domain was recorded for this connection, so none is claimed.";
  }

  return `${providerLabelFor(connection)} account, as the provider verified it. Hebun records no further account classification for this provider.`;
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

function toConnectedView(
  connection: AuthorityConnection,
  availability: CapabilityAvailabilityView | null,
): ConnectedIntegrationView {
  /*
   * NOT PERSISTED ANYWHERE — see `accountKindStatementFor`. Written as a named constant rather than
   * an inline `null` so that the phase which adds an `hd` column has one obvious place to change,
   * and so a reader can see that the absence is a decision.
   */
  const verifiedDomain: string | null = null;
  const capabilities = capabilitiesFor(connection, availability);

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
    accountKindStatement: accountKindStatementFor(connection, verifiedDomain),
    lastVerifiedAt: connection.lastVerifiedAt,
    scopes: connection.scopes,
    scopeCount: connection.scopes.length,
    capabilities,
    capabilityStatement: capabilityStatementFor(capabilities),
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
export function getIntegrationsModel(
  listing: ConnectionListing,
  availability: CapabilityAvailabilityView | null = null,
): IntegrationsModel {
  const readiness: IntegrationsReadiness =
    listing.status === "read"
      ? "authority-read"
      : listing.reason === "no-authorized-tenant-context"
        ? "no-tenant-context"
        : "persistence-unavailable";

  const connections = listing.status === "read" ? listing.connections : [];

  const connected = connections
    .filter((c) => c.connectionState === "connected")
    .map((c) => toConnectedView(c, availability));

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
