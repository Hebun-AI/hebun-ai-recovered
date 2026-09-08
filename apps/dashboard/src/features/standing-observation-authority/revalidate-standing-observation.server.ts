/*
 * standing-observation-authority/revalidate-standing-observation.server.ts — THE AUTHORITATIVE
 * CHECK, immediately before any future provider transport (TRH-23).
 *
 * ── WHY THIS EXISTS SEPARATELY FROM THE MINT ─────────────────────────────────
 *
 * Minting a principal proves an active authorization was READ. It does not prove the read may
 * happen NOW. Between a trigger firing and a request going out, an authorization can be withdrawn,
 * a connection can be revoked, a capability can stop being available and a credential can vanish. A
 * decision taken at trigger time is a cached opinion; this is the only check that is not.
 *
 * Everything earlier — registration validation, a trigger's own filter, the mint itself — is a
 * FILTER. Its only job is to stop obviously dead work early. If any of them disagreed with this
 * function, this function would still be right.
 *
 * ── THE ANSWER TO THE DIRECTOR'S QUESTION ────────────────────────────────────
 *
 * "The Director revokes at 12:00:00 and a trigger fired at 11:59:59 — can the provider call still
 * happen?" NO. The withdrawal is a new effective revision, and this function re-reads the effective
 * revision from the database after the trigger and before transport. The principal minted a second
 * earlier carries no authority past that read, because it carries no authority at all: it is
 * evidence of a lookup, and this is the lookup that counts.
 *
 * ── HOW FAR TOCTOU IS BOUNDED, STATED HONESTLY ───────────────────────────────
 *
 * To the width of the provider call itself. A withdrawal committed after this check returns and
 * before the provider answers cannot stop the request, because Hebun has no provider-side cancel.
 * That window is a property of talking to a remote system, not a defect this design can close, and
 * saying so is better than implying a guarantee that does not exist.
 *
 * ── ONE LIMITATION, RECORDED RATHER THAN INVENTED ────────────────────────────
 *
 * There is NO OPERATOR KILL SWITCH FOR PROVIDER READS in this repository.
 * `provider_connectivity_controls` is explicitly the Director's control over MODEL-GENERATION
 * connectivity, is global rather than tenant-scoped, and has nothing to do with provider
 * invocation. This function therefore does not consult one, and does not pretend to: a check
 * against a switch that does not exist would be a fabricated safety property.
 *
 * ── IT REACHES NO PROVIDER, AND OPENS NO SECRET ──────────────────────────────
 *
 * It asks the capability authority, the connection authority and the credential METADATA seam —
 * three reads that were measured to need a tenant and nothing about the human holding it, and which
 * TRH-23 narrowed for exactly this. It does NOT call `withDecryptedSecret`, which still requires the
 * branded human context.
 *
 * NO SECRET IS OPENED IN THIS FUNCTION, and this module imports no transport. Since TRH-24 a
 * transport caller does exist — one composition, which calls this function FIRST and only then
 * spends the connection's key through `withConnectionScopedSecret`, inside a callback frame. So
 * decryption happens strictly after this returns `authorized`, in a module this one cannot reach.
 * The order is the point: nothing is opened until every condition below has passed.
 *
 * Server-only.
 */
import type { ControlPlaneDatabase } from "@/db/client.server";
import { getCapabilityAvailability } from "@/features/integration-authority/capability-availability.server";
import { listConnections } from "@/features/integration-authority/integration-read.server";
import { listCredentialMetadata } from "@/features/integration-credentials/credential-repository.server";
import { readLatestAuthorizedObservationAt } from "@/features/provider-observation-history/read-provider-observations.server";
import { isObservableCapability } from "./contracts";
import {
  resolveObservationReadEnabled,
  type ProviderConnectivityControlRepository,
} from "./observation-read-control.server";
import {
  mintObservationPrincipal,
  tenantScopeOf,
  type ObservationPrincipal,
} from "./observation-principal.server";

export interface RevalidateStandingObservationDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Injectable so the cadence ceiling is provable without waiting a day. Never reaches a column. */
  readonly now?: () => Date;
  /**
   * The kill-switch repository. `null` means "no durable authority", which FAILS CLOSED — and is
   * the value a test uses to prove that an unreadable switch stops a transport rather than
   * permitting one. There is no value of this field that can ENABLE a read the switch has not
   * enabled: it selects where the answer is read from, never what the answer is.
   */
  readonly controlRepo?: ProviderConnectivityControlRepository | null;
}

/**
 * Why a read may not proceed. Each value is a DIFFERENT FACT, and they are deliberately not
 * collapsed: "you never authorized this", "you took it away", "the connection is unwell" and "the
 * provider is failing" call for four different human responses, and a single `not-allowed` would
 * make all four unanswerable.
 *
 * Note what is NOT here: no provider failure, no quota failure, no persistence failure of an
 * observation. Those are transport and storage outcomes, and this function never reaches either.
 */
export type StandingObservationRevalidationRefusal =
  /* ── the authorization itself ── */
  | "not-authorized"
  | "authorization-superseded"
  | "authorization-withdrawn"
  | "capability-not-observable"
  /* ── the scope, as the principal claims it ── */
  | "provider-mismatch"
  | "capability-mismatch"
  | "subject-mismatch"
  | "connection-mismatch"
  /* ── the connection and what it can currently answer ── */
  | "connection-authority-unavailable"
  | "connection-not-owned-by-tenant"
  | "connection-unhealthy"
  | "capability-not-available"
  | "capability-not-read-only"
  /* ── the credential, by METADATA only. Nothing is opened here. ── */
  | "credential-authority-unavailable"
  | "credential-unavailable"
  /* ── the cadence ceiling the authorization itself carries (TRH-24) ── */
  | "observed-too-recently"
  | "observation-history-unavailable"
  /**
   * TRH-25 prerequisite. The Director's global kill switch over machine-principal provider reads is
   * OFF, or could not be read — which this system treats identically, because "we could not find
   * out whether we are allowed" must never be answered as "yes".
   *
   * DELIBERATELY NOT COLLAPSED INTO `not-authorized`. The organization's permission is intact and
   * the authorization is untouched; an operator has temporarily stopped the operation. Telling a
   * reader "you are not authorized" would send them to Governance to re-grant something they never
   * lost, which is the one response that would make an incident worse.
   */
  | "observation-read-disabled"
  | "persistence-unavailable";

export type RevalidateStandingObservationResult =
  | {
      readonly status: "authorized";
      /**
       * The principal, unchanged. Returning it is NOT a grant — it is how the transport caller is
       * forced to hold something this function produced rather than something it minted itself.
       */
      readonly principal: ObservationPrincipal;
      /** The connection this read is permitted to spend, as the authorization named it. */
      readonly integrationId: string;
    }
  | { readonly status: "refused"; readonly reason: StandingObservationRevalidationRefusal };

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Standing observation revalidation is server-only.");
  }
}

/**
 * Revalidate one standing observation, authoritatively, immediately before transport.
 *
 * The principal is passed in, but NOTHING IT SAYS IS TRUSTED: the authorization is re-minted from
 * the database by id, and every field the caller's principal carries is compared against the row
 * that came back. A principal built an hour ago against a since-narrowed authorization fails on the
 * comparison; a forged one fails at the mint, because the id it names either does not exist or does
 * not resolve to what it claims.
 */
export async function revalidateStandingObservation(
  principal: ObservationPrincipal,
  deps: RevalidateStandingObservationDeps = {},
): Promise<RevalidateStandingObservationResult> {
  assertServerOnly();

  /*
   * 1-5 · THE AUTHORIZATION, RE-READ FROM THE DATABASE.
   *
   * Re-minting is the check: it proves the authorization exists, that the named revision is the
   * EFFECTIVE one for its lineage, that it is `active`, and that its scope is still in the released
   * observable allow-list. A withdrawal or a narrowing committed one millisecond ago is visible
   * here, because nothing between the trigger and this line was cached.
   */
  const fresh = await mintObservationPrincipal(principal.authorizationId, {
    getDb: deps.getDb,
    /* The invocation identity of the caller's run is kept; this mint is a verification, not a run. */
    newInvocationId: () => principal.invocationId,
  });
  if (fresh.status === "refused") {
    switch (fresh.reason) {
      case "authorization-superseded":
        return { status: "refused", reason: "authorization-superseded" };
      case "authorization-withdrawn":
        return { status: "refused", reason: "authorization-withdrawn" };
      case "capability-not-observable":
        return { status: "refused", reason: "capability-not-observable" };
      case "persistence-unavailable":
        return { status: "refused", reason: "persistence-unavailable" };
      default:
        return { status: "refused", reason: "not-authorized" };
    }
  }
  const current = fresh.principal;

  /*
   * 6-10 · THE CALLER'S PRINCIPAL MUST STILL DESCRIBE THE ROW.
   *
   * Substitution is what these five comparisons exist to defeat. A caller holding a real principal
   * for scope A cannot present it for scope B: the fields are readonly, a copy with one field
   * changed loses the runtime brand, and even a genuine principal is re-derived here from its own
   * authorization id and compared field by field.
   *
   * The tenant is compared first and is never taken from the caller: `current.tenantId` came from
   * the row. A trigger cannot say `tenantId = X` and thereby gain X.
   */
  if (current.tenantId !== principal.tenantId) return { status: "refused", reason: "not-authorized" };
  if (current.providerKey !== principal.providerKey) {
    return { status: "refused", reason: "provider-mismatch" };
  }
  if (current.capabilityKey !== principal.capabilityKey) {
    return { status: "refused", reason: "capability-mismatch" };
  }
  if (current.subjectKind !== principal.subjectKind || current.subjectRef !== principal.subjectRef) {
    return { status: "refused", reason: "subject-mismatch" };
  }
  if (current.integrationId !== principal.integrationId) {
    return { status: "refused", reason: "connection-mismatch" };
  }

  /*
   * 11 · READ-ONLY, BY ALLOW-LIST AND NOT BY A FLAG.
   *
   * `writeCapable === false` on a catalog entry is a statement about what is presently possible and
   * its own contract says it is "CAPABILITY, NEVER PERMISSION". A phase that added a write half
   * would flip that flag and silently widen every standing authorization ever issued. The closed
   * allow-list is what decides, and it is checked again here rather than inherited from the mint.
   */
  if (!isObservableCapability(current.providerKey, current.capabilityKey, current.subjectKind)) {
    return { status: "refused", reason: "capability-not-read-only" };
  }

  /*
   * 12 · THE OPERATOR'S STOP (TRH-25 prerequisite).
   *
   * Placed HERE for two reasons that are both about what a refusal tells the reader.
   *
   * AFTER the authorization's own truth, so a withdrawn or superseded grant still reports itself.
   * "You took this away" and "an operator paused everything" are different facts and the more
   * specific one must win — a disabled switch must never be able to disguise a withdrawal.
   *
   * BEFORE the connection, capability and credential reads, so a stopped deployment touches no
   * tenant data and spends nothing while it is stopped.
   *
   * IT IS CHECKED IN THIS FUNCTION rather than in a ceremony, a trigger or a scanner, for the same
   * reason every other condition is: those are preparatory surfaces, and a check that lives in one
   * can be walked around by writing a second one. This runs immediately before transport and
   * applies to EVERY machine-principal read that exists or ever will — the manual TRH-24 ceremony
   * included. An emergency stop with a documented exemption is not an emergency stop.
   *
   * FAIL CLOSED. `resolveObservationReadEnabled` answers `false` for an absent row, an unreachable
   * database and any read error alike, so a switch that cannot be read stops the transport.
   *
   * A DISABLED SWITCH CHANGES NOTHING ELSE. No authorization is altered, no cadence is spent, no
   * row is written and nothing is recorded — the attempt simply does not happen, and the next one
   * after the switch returns is permitted on exactly the terms it always had.
   */
  if (!(await resolveObservationReadEnabled(
    deps.controlRepo !== undefined
      ? { repo: deps.controlRepo }
      : deps.getDb
        ? { getDb: deps.getDb }
        : {},
  ))) {
    return { status: "refused", reason: "observation-read-disabled" };
  }

  const scope = tenantScopeOf(current);

  /*
   * 13 · THE CONNECTION STILL BELONGS TO THIS TENANT.
   *
   * The composite foreign key made it true at write time; this proves it is still true now — a
   * connection can be soft-deleted after an authorization was written.
   */
  const connections = await listConnections(scope, deps.getDb ? { getDb: deps.getDb } : {});
  if (connections.status !== "read") {
    return { status: "refused", reason: "connection-authority-unavailable" };
  }
  const connection = connections.connections.find((c) => c.integrationId === current.integrationId);
  if (!connection) return { status: "refused", reason: "connection-not-owned-by-tenant" };
  if (connection.providerKey !== current.providerKey) {
    return { status: "refused", reason: "provider-mismatch" };
  }

  /*
   * 14 · THE CAPABILITY IS STILL AVAILABLE, THROUGH THIS CONNECTION.
   *
   * The capability authority is the released answer to "can this be answered for this tenant, and
   * if not, why not". It is asked here rather than assumed, and the source must be THIS connection —
   * an authorization for connection C is not satisfied by connection D being healthy.
   */
  const availability = await getCapabilityAvailability(scope, { getDb: deps.getDb });
  const entry = availability.capabilities.find((c) => c.capability === current.capabilityKey);
  const source = entry?.sources.find(
    (s) => s.integrationId === current.integrationId && s.providerKey === current.providerKey,
  );
  if (!entry || entry.state !== "available" || !source || !source.readAvailable) {
    return { status: "refused", reason: "capability-not-available" };
  }
  /*
   * A CONNECTION THE AUTHORITY WILL NOT READ THROUGH IS UNHEALTHY, AND SAID SO SEPARATELY. The
   * distinction matters to a human: "the capability is gone" and "this particular connection needs
   * attention" call for different actions.
   */
  if (connection.connectionState !== "connected") {
    return { status: "refused", reason: "connection-unhealthy" };
  }

  /*
   * 15 · A USABLE CREDENTIAL STILL EXISTS — BY METADATA, AND NOTHING IS OPENED.
   *
   * This seam returns kinds, liveness and timestamps. It never returns ciphertext and never decrypts.
   * Opening a secret requires `withDecryptedSecret`, which still takes the branded HUMAN context and
   * is therefore not callable from this path at all.
   */
  const credentials = await listCredentialMetadata(scope, current.integrationId, {
    getDb: deps.getDb,
    env: deps.env,
  });
  if (credentials.status !== "read") {
    return { status: "refused", reason: "credential-authority-unavailable" };
  }
  if (!credentials.credentials.some((c) => c.live)) {
    return { status: "refused", reason: "credential-unavailable" };
  }

  /*
   * 16 · THE CADENCE CEILING — THE ONLY CONDITION THAT IS ABOUT TIME (TRH-24).
   *
   * `interval_minutes` is what Governance authorized: this scope may be observed under this standing
   * permission NO MORE OFTEN than every K minutes. Until now nothing enforced it, because nothing
   * could exercise the authorization at all.
   *
   * IT IS A REFUSAL, NEVER A TRIGGER. Nothing here schedules anything, nothing computes a next run,
   * and a missed interval is not owed. The only thing this can do is stop an otherwise-authorized
   * invocation from proceeding too soon.
   *
   * IT IS CHECKED HERE RATHER THAN IN THE CEREMONY for the same reason every other condition is: a
   * ceremony's check is a courtesy that can be skipped by writing a second ceremony. This one runs
   * immediately before transport and cannot be.
   *
   * A FAILED PROVIDER READ STORES NOTHING, so it leaves no timestamp and a retry is permitted. That
   * falls out of measuring stored observations rather than attempts, and it is the correct
   * behaviour rather than a lucky one.
   */
  const lastAuthorized = await readLatestAuthorizedObservationAt(
    scope,
    {
      providerKey: current.providerKey,
      capabilityKey: current.capabilityKey,
      subjectRef: current.subjectRef,
    },
    { getDb: deps.getDb },
  );
  if (lastAuthorized.status !== "read") {
    /*
     * FAIL CLOSED. "We could not find out when this was last observed" is not "it was never
     * observed" — reporting the second would let an unreadable history become a licence.
     */
    return { status: "refused", reason: "observation-history-unavailable" };
  }
  if (lastAuthorized.observedAt !== null) {
    const since = (deps.now ?? (() => new Date()))().getTime() - Date.parse(lastAuthorized.observedAt);
    if (!Number.isFinite(since) || since < current.intervalMinutes * 60_000) {
      return { status: "refused", reason: "observed-too-recently" };
    }
  }

  return { status: "authorized", principal: current, integrationId: current.integrationId };
}
