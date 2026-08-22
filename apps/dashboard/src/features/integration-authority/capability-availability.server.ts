/*
 * integration-authority/capability-availability.server.ts — THE ONE NORMALIZED READ SEAM (I1).
 *
 * ── THE QUESTION ─────────────────────────────────────────────────────────────
 *
 *   "Can this capability currently be answered for this tenant, and if not, why not?"
 *
 * ── WHY A SEAM AND NOT A TABLE READ ──────────────────────────────────────────
 *
 * A consumer that reads `integrations` rows becomes a second interpreter of connection state: it
 * has to know that `unverified` is not `connected`, that a terminal row does not count, that
 * `health` does not move the lifecycle, and that capability requires a scope subset. The moment
 * two consumers know those rules, they disagree — and one of them tells a Director something is
 * available when it is not.
 *
 * So the rules live here, once, and no consumer imports the schema. A firewall test walks the real
 * import graph and asserts that Command reaches no integrations schema module.
 *
 * ── WHAT THIS SEAM STRUCTURALLY CANNOT SAY ───────────────────────────────────
 *
 * `CapabilitySource` has `readAvailable` and `writeCapable` and NO `writeAuthorized`. Write
 * capability is what the granted scopes cover; write AUTHORIZATION is a single-spend Governance
 * permit, and this module imports neither `action-authorization` nor `action-execution` and could
 * not mint one if it did. A consumer holding this view cannot mutate anything with it — there is
 * no handle, no adapter, no token and no permit anywhere in the returned object.
 *
 * ── LIFECYCLE IS NOT AVAILABILITY, AND THIS IS WHERE THEY SEPARATE ───────────
 *
 * `connection_state` records whether the tenant's GRANT still exists. It is never moved by a 429, a
 * 5xx, a timeout, a DNS failure or a TLS failure — a provider outage is not a revocation, and
 * writing one into the lifecycle would tell a tenant to reconnect something nobody took away.
 *
 * `CapabilityState` records whether the capability can be ANSWERED RIGHT NOW, which is a different
 * question with a different answer. So `connected` + any health but `healthy` is `degraded` here
 * while the row on disk still reads `connected` — and both statements are true at the same time,
 * which is the entire reason there are two dimensions.
 *
 * `unknown` degrades too. A successful verification writes `connected` and `healthy` together, so
 * `connected` + `unknown` is not a freshly-verified connection: it is a connection Hebun holds no
 * usable health observation for, and claiming availability from no observation is the same untruth
 * as claiming it from a failed one.
 *
 * ── WHY `available` IS UNREACHABLE IN I1, AND HOW THAT IS ENFORCED ───────────
 *
 * `available` requires `connection_state = 'connected'` with `health = 'healthy'` and covering scopes,
 * and `connected` requires a verification
 * that requires a credential that requires an encryption boundary — none of which exists. The
 * repository cannot produce `connected`; a test proves it; and the RELEASED catalog contains zero
 * `connectable` providers, so `listConnectableProviders()` is empty and this seam reports
 * `readiness: "no-connectable-provider"` with an empty capability list.
 *
 * An empty list alone would read as "everything is fine". `readiness` is what makes that
 * impossible: a consumer must handle the value that says nothing is connectable at all.
 *
 * ── FIXTURES CANNOT REACH A SURFACE ──────────────────────────────────────────
 *
 * Capabilities are enumerated from CONNECTABLE definitions only, so a `fixture` definition
 * contributes no capability and no source and can never be presented to anyone as a provider. The
 * RELEASED catalog holds no entry of either kind; the rule is enforced against the injected
 * catalogs the tests use, which is where a fixture exists at all.
 *
 * ── NOT CONSUMED BY COMMAND ──────────────────────────────────────────────────
 *
 * Nothing imports this module outside its own tests. `UNCONNECTED_CAPABILITIES` in
 * `command-overview/workspace-model.ts` is untouched and stays the Command surface's source, and a
 * test pins that so a later phase has to delete the pin deliberately rather than drift into
 * consumption.
 *
 * Server-only. Reads only — nothing here writes, and nothing here decides.
 */
import type { ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  listConnectableCapabilities,
  listConnectableProviders,
  PROVIDER_CATALOG,
} from "@/features/provider-catalog/catalog";
import { listConnections } from "./integration-repository.server";
import {
  isHealthUsable,
  isImpairedHealth,
  type CapabilityAvailabilityEntry,
  type CapabilityAvailabilityView,
  type CapabilitySource,
  type CapabilityState,
  type ConnectionDefinition,
  type IntegrationView,
  type ProviderCatalog,
} from "./contracts";

export interface CapabilityAvailabilityDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  /**
   * Injected so a test can exercise the mapping against a `connectable` definition, which the
   * RELEASED catalog deliberately does not have. Production leaves it unset.
   */
  readonly catalog?: ProviderCatalog;
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Capability availability is server-only.");
  }
}

/** A view no consumer can misread as "fine": the reason travels with the emptiness. */
const NOTHING_CONNECTABLE: CapabilityAvailabilityView = Object.freeze({
  readiness: "no-connectable-provider" as const,
  capabilities: Object.freeze([]),
});

/** `true` when every scope the capability needs is in the granted set. */
function covers(granted: readonly string[], required: readonly string[]): boolean {
  return required.every((scope) => granted.includes(scope));
}

/**
 * One connection weighed against one capability — the source a consumer sees, plus the two facts
 * `classify` needs in order to say WHY, kept here so nothing recomputes them from the row.
 */
interface EvaluatedSource {
  readonly connection: IntegrationView;
  readonly source: CapabilitySource;
  /** The granted scopes cover the read, whatever the lifecycle and whatever the health. */
  readonly coversRead: boolean;
}

/**
 * How one connection contributes to one capability, or `null` when it does not.
 *
 * `readAvailable` and `writeCapable` are DERIVED here on every read and stored nowhere. A cached
 * copy would drift from `scopes` the instant a provider reduced a grant, and a stale `true` is the
 * one error this whole subsystem exists to prevent.
 *
 * THREE CONDITIONS, ALL REQUIRED: the lifecycle is `connected`, the health is `healthy`, and the
 * scopes cover it. The health term is what keeps an unreachable provider — and an unobserved one —
 * from being reported as a working source, and it does NOT touch the lifecycle, which is why the
 * `connectionState` this object was built from still reads `connected` afterwards.
 */
function evaluate(
  connection: IntegrationView,
  definition: ConnectionDefinition,
  capability: string,
): EvaluatedSource | null {
  const scopes = definition.capabilityScopes[capability];
  if (!scopes) return null;

  const isConnected = connection.connectionState === "connected";
  const isUsable = isConnected && isHealthUsable(connection.health);
  const granted = connection.scopes;
  const coversRead = covers(granted, scopes.read);

  const source: CapabilitySource = {
    integrationId: connection.integrationId,
    providerKey: definition.providerKey,
    accountLabel: connection.externalAccountLabel,
    lastVerifiedAt: connection.lastVerifiedAt,
    /* A stored credential is not a connection, a grant is not a connection, and a provider that is
     * not answering — or has not been asked — is not a source, however intact the grant remains. */
    readAvailable: isUsable && coversRead,
    writeCapable: isUsable && covers(granted, scopes.write),
  };

  return { connection, source, coversRead };
}

/**
 * The capability's state, and the reason when it is not `available`.
 *
 * The order of these branches is the doctrine, in code: a connection that exists but was never
 * verified is `unverified` and NOT `not-connected`, because a tenant who supplied something
 * deserves to be told it was never confirmed rather than that nothing is there.
 */
function classify(
  connections: readonly IntegrationView[],
  evaluated: readonly EvaluatedSource[],
): { state: CapabilityState; reason: string | null } {
  if (evaluated.some((e) => e.source.readAvailable)) {
    return { state: "available", reason: null };
  }
  if (connections.length === 0) {
    return {
      state: "not-connected",
      reason: "No connection to a provider offering this capability exists for this organization.",
    };
  }

  const connected = connections.filter((c) => c.connectionState === "connected");
  if (connected.length > 0) {
    /*
     * THREE DIFFERENT DEGRADATIONS, AND THE SCOPE GAP IS REPORTED FIRST.
     *
     * A scope gap persists until the tenant re-grants; both health gaps resolve without the tenant
     * doing anything. Reporting a transient one over the permanent one would tell a tenant to wait
     * for a provider that is answering perfectly well and will never cover this capability.
     */
    const covering = evaluated.filter(
      (e) => e.connection.connectionState === "connected" && e.coversRead,
    );
    if (covering.length === 0) {
      return {
        state: "degraded",
        reason: "A connection exists, but the granted access does not cover this capability.",
      };
    }

    /*
     * The grant covers it and the connection is live, so the only thing left is the health, and
     * these two are DIFFERENT FACTS: one attempt was made and failed, the other was never made.
     */
    if (covering.some((e) => isImpairedHealth(e.connection.health))) {
      return {
        state: "degraded",
        reason:
          "The connection is granted and covers this capability, but the provider is not " +
          "currently responding. The grant is unaffected and no reconnection is required.",
      };
    }
    return {
      state: "degraded",
      reason:
        "Connection health has not been established, so this capability cannot be claimed as " +
        "usable right now. The grant is unaffected and no reconnection is required.",
    };
  }
  if (connections.some((c) => c.connectionState === "revoked" || c.connectionState === "expired")) {
    return {
      state: "revoked",
      reason: "The provider ended this grant. Reconnecting is required to restore it.",
    };
  }
  return {
    state: "unverified",
    reason: "A connection record exists but has never been verified, so nothing can be read yet.",
  };
}

/**
 * What this tenant can currently be answered from.
 *
 * The whole view, not one capability, because a consumer asking one at a time would build its own
 * loop and its own idea of what "all capabilities" means.
 */
export async function getCapabilityAvailability(
  tenant: TenantContext | null,
  deps: CapabilityAvailabilityDeps = {},
): Promise<CapabilityAvailabilityView> {
  assertServerOnly();

  const catalog = deps.catalog ?? PROVIDER_CATALOG;
  const connectable = listConnectableProviders(catalog);
  /*
   * NOTHING IS CONNECTABLE — the truthful state of this deployment for the whole of I1. Reported
   * before the tenant is even considered, because it is a fact about the build and not about them.
   */
  if (connectable.length === 0) return NOTHING_CONNECTABLE;

  const capabilities = listConnectableCapabilities(catalog);

  /* No tenant: every capability is unanswerable, and the view says exactly why. */
  if (!tenant?.tenantId) {
    return {
      readiness: "catalog-ready",
      capabilities: capabilities.map((capability) => ({
        capability,
        state: "not-connected" as const,
        reason: "No organization is resolved for this request.",
        sources: Object.freeze([]),
      })),
    };
  }

  const listing = await listConnections(tenant, { getDb: deps.getDb, catalog });
  const all = listing.status === "read" ? listing.connections : [];

  /*
   * Terminal rows are excluded from being SOURCES but are still consulted by `classify`, which is
   * how a revoked connection produces "the provider ended this grant" instead of the bare "nothing
   * is connected" a tenant would find baffling after they had connected something.
   */
  const live = all.filter(
    (c) => c.connectionState !== "disconnected" && c.connectionState !== "revoked",
  );

  const byKey = new Map(connectable.map((definition) => [definition.providerKey, definition]));

  const entries: CapabilityAvailabilityEntry[] = capabilities.map((capability) => {
    const relevant = all.filter((c) => {
      const definition = c.providerKey ? byKey.get(c.providerKey) : undefined;
      return definition !== undefined && definition.capabilityScopes[capability] !== undefined;
    });

    const evaluated = live
      .map((c) => {
        const definition = c.providerKey ? byKey.get(c.providerKey) : undefined;
        return definition ? evaluate(c, definition, capability) : null;
      })
      .filter((e): e is EvaluatedSource => e !== null);

    const sources: readonly CapabilitySource[] = evaluated.map((e) => e.source);
    const { state, reason } = classify(relevant, evaluated);
    return { capability, state, reason, sources: Object.freeze(sources) };
  });

  return { readiness: "catalog-ready", capabilities: Object.freeze(entries) };
}
