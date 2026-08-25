/*
 * integration-authority/heby-integration-source.server.ts — THE INTEGRATION AUTHORITY'S read
 * projection of itself, shaped for Heby grounding (INT-5A).
 *
 * ── WHY IT LIVES ON THIS SIDE OF THE BOUNDARY ────────────────────────────────
 *
 * G6C settled this and the reasoning transfers unchanged: a projection belongs to the authority
 * that owns the facts, and the consumer imports the projection. Heby's import surface is therefore
 * a module whose whole graph contains zero writers, instead of one that reaches
 * `integration-repository.server.ts` — which can create a connection, attach a credential to one,
 * hold one for refresh, record a verification, and end one.
 *
 * INT-5A also had to do the half G6C did not need: `capability-availability.server.ts` reached
 * those writers through `listConnections`, so the read was split out into
 * `integration-read.server.ts` first. That is why this file can exist at all.
 *
 * ── WHAT THIS IS ─────────────────────────────────────────────────────────────
 *
 * A READ PROJECTION. It owns no integration fact, holds no table, writes nothing, and decides
 * nothing. Every value it returns is read through `getCapabilityAvailability`, the NORMALIZED seam
 * that already owns the rules — that `unverified` is not `connected`, that a terminal row does not
 * count, that health does not move the lifecycle, and that a capability requires a scope subset.
 * This module re-derives none of that. It translates one shape into another.
 *
 * ── WHAT IT STRUCTURALLY CANNOT DO ───────────────────────────────────────────
 *
 * IT PERFORMS NO PROVIDER I/O. It imports no Google transport, no GitHub transport, no provider
 * record reader, and no `fetch`. The seam it calls reads the control-plane database and nothing
 * else, so answering a Heby question can never become a request to Google or GitHub, can never
 * consume a provider rate limit, and can never make a Heby answer depend on a provider being up.
 *
 * IT READS NO PROVIDER RECORD. There is no Drive file here, no repository, no pull request and no
 * provider payload. The distinction is the whole phase: this source says "Drive metadata can
 * currently be read"; it never says what is in Drive. That second capability is INT-5B and it does
 * not exist.
 *
 * IT VERIFIES NOTHING. A Heby question does not contact a provider to refresh health, so a stale
 * `unknown` health is reported as `degraded` — the truthful reading of "nothing has been observed"
 * — rather than being resolved by a side effect nobody asked for.
 *
 * ── NON-AUTHORITATIVE, AND SAYING SO ─────────────────────────────────────────
 *
 * G6C's source declares `authoritative: true` because `decision_records` IS the Governance record.
 * This one is the opposite and must say so: capability state is DERIVED on every read from the
 * lifecycle, the last observed health and the granted scopes. It is a statement about what Hebun
 * can presently do, not organizational truth, and nothing here may be promoted into Knowledge.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import type { ResolvedSourceItem, SourceResolution } from "@/features/heby-runtime/contracts";
import { getCapabilityAvailability } from "./capability-availability.server";
import type {
  CapabilityAvailabilityEntry,
  CapabilityAvailabilityView,
  CapabilitySource,
} from "./contracts";

/**
 * Named for what it is, and for what it is not. A reader who sees this line must not conclude that
 * Heby looked inside any connected system.
 */
export const INTEGRATIONS_PROVENANCE =
  "Integration capability state — which organizational systems this organization has connected and " +
  "what may currently be read from them, tenant-scoped and derived on read from the connection " +
  "lifecycle, the last observed health and the granted scopes (authoritative: false). No provider " +
  "was contacted to produce this, and it contains no provider records.";

/** Why the source could not be resolved. Each is a real state, never a placeholder for zero. */
export const INTEGRATIONS_UNAVAILABLE = Object.freeze({
  noTenant: "No authorized tenant context, so no integration state was read.",
  noConnectableProvider:
    "This deployment ships no connectable provider definition, so no integration capability exists " +
    "to report. That is a fact about the build, not about this organization.",
  noCapability:
    "No integration capability is declared for this organization's connectable providers.",
});

export interface IntegrationGroundingDeps {
  readonly readAvailability?: (
    tenant: TenantContext | null,
  ) => Promise<CapabilityAvailabilityView>;
}

function unavailable(reason: string): SourceResolution {
  return {
    sourceClass: "integrations",
    state: "unavailable",
    provenance: INTEGRATIONS_PROVENANCE,
    authoritative: false,
    items: [],
    unavailableReason: reason,
  };
}

/**
 * The lifecycle word for a capability state.
 *
 * `ResolvedSourceItem.lifecycle` is a CLOSED vocabulary Heby's evidence layer already owns
 * (`settled | superseded | retired | unknown`), and INT-5A does not widen it. The mapping is
 * conservative on purpose: only `available` is `settled`, `revoked` is `retired`, and every
 * degradation is `unknown` because the honest reading of a degraded capability is that its present
 * usability has not been established — not that it has been settled one way.
 */
function lifecycleFor(state: CapabilityAvailabilityEntry["state"]): ResolvedSourceItem["lifecycle"] {
  if (state === "available") return "settled";
  if (state === "revoked") return "retired";
  return "unknown";
}

/**
 * The one source a capability is reported from, when there is one.
 *
 * A capability may be offered by several connections. The reported source is the one that makes
 * the capability answerable when any does, so `accountLabel` and `lastVerifiedAt` describe the
 * connection the state actually came from rather than an arbitrary first row.
 */
function reportedSource(entry: CapabilityAvailabilityEntry): CapabilitySource | undefined {
  return entry.sources.find((source) => source.readAvailable) ?? entry.sources[0];
}

/**
 * The item's one machine-derived detail line.
 *
 * EVERY CLAUSE IS READ OFF THE SEAM. The state, the reason and both booleans are the seam's own
 * values; nothing is inferred, nothing is softened, and a missing value is omitted rather than
 * guessed. `read: no` and `write: no` are stated explicitly rather than left absent, because a
 * silent omission is what a model would read as "unknown, therefore maybe".
 */
function detailFor(entry: CapabilityAvailabilityEntry, source: CapabilitySource | undefined): string {
  const parts: string[] = [`state ${entry.state}`];
  if (source) {
    parts.push(`read ${source.readAvailable ? "available" : "not available"}`);
    /*
     * WRITE IS ALWAYS STATED, AND IS ALWAYS THE SEAM'S ANSWER. INT-5A adds no write capability and
     * may not imply one; `writeCapable` is the seam's CAPABILITY value and never a permission —
     * even `true` would mean only "the grant covers a write", never "Hebun may perform one".
     */
    parts.push(`write capability ${source.writeCapable ? "present" : "absent"}`);
    if (source.accountLabel) parts.push(`account ${source.accountLabel}`);
    if (source.lastVerifiedAt) parts.push(`last verified ${source.lastVerifiedAt}`);
  }
  if (entry.reason) parts.push(entry.reason);
  return parts.join(" · ");
}

/**
 * Read this tenant's integration capability state for Heby grounding.
 *
 * Tenant-scoped through the seam's own predicate — this module passes the server-resolved
 * `TenantContext` straight through and constructs no query of its own. There is no parameter by
 * which a caller could name a different tenant, a different integration, or a different provider
 * account.
 *
 * ZERO CAPABILITIES IS AN ANSWER, NOT A SUCCESS. A deployment with no connectable definition and a
 * catalog with no declared capability are different facts with different reasons, and neither is
 * reported as an empty resolved source. A tenant that has simply connected nothing DOES resolve —
 * with items whose state is `not-connected` — because "you have connected nothing" is a real,
 * grounded answer that Heby should be able to give.
 */
export async function readIntegrationGroundingSource(
  tenant: TenantContext | null,
  deps: IntegrationGroundingDeps = {},
): Promise<SourceResolution> {
  if (typeof window !== "undefined") {
    throw new Error("Integration grounding reads are server-only.");
  }
  if (!tenant?.tenantId) return unavailable(INTEGRATIONS_UNAVAILABLE.noTenant);

  const view = await (deps.readAvailability ?? ((t: TenantContext | null) => getCapabilityAvailability(t)))(
    tenant,
  );

  if (view.readiness === "no-connectable-provider") {
    return unavailable(INTEGRATIONS_UNAVAILABLE.noConnectableProvider);
  }
  if (view.capabilities.length === 0) {
    return unavailable(INTEGRATIONS_UNAVAILABLE.noCapability);
  }

  const items: ResolvedSourceItem[] = view.capabilities.map((entry) => {
    const source = reportedSource(entry);
    return {
      /*
       * THE IDENTITY IS THE PROVIDER'S AND THE CAPABILITY'S, JOINED — both already owned elsewhere.
       * `providerKey` is the catalog's key and `capability` is the capability key the provider
       * module defines; INT-5A mints neither and invents no new identifier scheme.
       *
       * The integration row's UUID is deliberately NOT the reference. A capability is the thing
       * being reported, one capability may be offered by several connections, and a database id is
       * not a stable public identity for a fact about what can be read.
       */
      recordRef: `${source?.providerKey ?? "unknown-provider"}/${entry.capability}`,
      label: `${source?.providerKey ?? "Unconnected provider"} — ${entry.capability}`,
      detail: detailFor(entry, source),
      lifecycle: lifecycleFor(entry.state),
    };
  });

  return {
    sourceClass: "integrations",
    state: "resolved",
    provenance: INTEGRATIONS_PROVENANCE,
    authoritative: false,
    items,
  };
}
