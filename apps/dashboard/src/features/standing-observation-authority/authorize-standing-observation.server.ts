/*
 * standing-observation-authority/authorize-standing-observation.server.ts — THE ONE writer of a
 * standing observation authorization (TRH-23).
 *
 * This module owns exactly one consequential transition, and it is the same transition whether the
 * scope is being authorized for the first time, re-authorized after a withdrawal, narrowed, or
 * withdrawn:
 *
 *     NO REVISION / REVISION N  ->  REVISION N+1
 *
 * ONE TRANSACTION, OR NOTHING:
 *
 *   BEGIN
 *     1. resolve the connection, tenant-scoped, and require it to be this provider's
 *     2. read the current effective revision for this lineage
 *     3. verify the caller was looking at THAT revision   (stale-review precondition, K4)
 *     4. write the Governance decision + its session      (subject = the revision)
 *     5. write the revision, bound to that decision
 *     6. append the Governance audit event                (a decision happened)
 *     7. append the standing-observation audit event      (a tenant's read scope changed)
 *   COMMIT
 *
 * "Authorized but no decision", "decision but no authorization", and "authorized but unaudited" are
 * excluded by the transaction, not by hoping.
 *
 * ── THERE IS NO UPDATE WRITER HERE, AND THAT IS THE SECURITY PROPERTY ────────
 *
 * Every legitimate change is an INSERT of a higher revision. This module contains no `update(`, no
 * `delete(`, and no upsert against `standing_observation_authorizations`, and a firewall test proves
 * no other module in `src/` contains one either. So `UPDATE … SET capability_key = <broader>` is not
 * a forbidden operation — it is an operation with no implementation anywhere. Widening costs a new
 * Governance decision, exactly as narrowing and withdrawal do.
 *
 * The predecessor row is never touched, never stamped and never superseded in place: a historical
 * record a later write can edit was never a record. Supersession is expressed by the successor
 * naming it and holding the higher ordinal.
 *
 * ── WHAT THIS WRITER MAY NOT DO ──────────────────────────────────────────────
 *
 * It cannot authorize itself: `resolveGovernanceAuthority` is the ONE released resolver and it reads
 * `decision_records.bootstrap`, never a role, a permission row, a membership scope or anything the
 * caller supplied. It mints no permit, reaches no provider, reads no credential, decrypts nothing,
 * grants no permission, starts no execution and creates no schedule — none of those modules is
 * imported, and a firewall test walks the real value-import closure rather than trusting this
 * sentence.
 *
 * ── AND IT COLLECTS NOTHING ──────────────────────────────────────────────────
 *
 * This is the property TRH-23 must not blur. Writing an authorization changes what the ORGANIZATION
 * HAS PERMITTED and changes nothing about what actually happens: there is no scheduler, no trigger,
 * no runtime invocation and no machine-caused provider read in this repository, and every audit row
 * this transaction writes carries `collected: false`.
 *
 *   AUTHORIZED != OBSERVED
 *   AUTHORIZED != SCHEDULED
 *   AUTHORIZED != EXECUTABLE UNATTENDED
 *
 * ── AN AGENT CANNOT REACH THIS AT ALL ────────────────────────────────────────
 *
 * Two independent reasons, neither a code convention. There is no agent authentication in Hebun, so
 * an agent has no session from which a `TenantContext` could be resolved; and
 * `standing_observation_authorizations.authorized_by_actor_type` carries a CHECK admitting only
 * `human`, so a row naming an agent as its own authorizer is rejected by PostgreSQL independently of
 * every line below.
 *
 * ── NO TABLE LOCK ────────────────────────────────────────────────────────────
 *
 * `(tenant_id, provider_key, capability_key, subject_ref, authorization_revision)` IS unique, so two
 * simultaneous revisions both computing N+1 produce one commit and one `unique_violation`, reported
 * as a refusal rather than an error. The index is the guarantee; a lock would add contention and
 * prove nothing extra.
 *
 * Server-only.
 */
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { standingObservationAuthorizations } from "@/db/schema/standing-observation-authorization";
import { readConnection } from "@/features/integration-authority/integration-read.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { recordGovernanceEventWithin } from "@/features/governance-audit/governance-decision-audit.server";
import { recordStandingObservationEventWithin } from "@/features/governance-audit/standing-observation-audit.server";
import {
  resolveGovernanceAuthority,
  type GovernanceAuthorityResolution,
} from "@/features/governance-decision/authority-read.server";
import { writeGovernanceDecisionWithin } from "@/features/governance-decision/decision-authority.server";
import { validateJustification } from "@/features/governance-decision/persistence.server";
import {
  FIRST_AUTHORIZATION_REVISION,
  MAX_OBSERVATION_INTERVAL_MINUTES,
  MIN_OBSERVATION_INTERVAL_MINUTES,
  STANDING_OBSERVATION_AUDIT_AUTHORIZED,
  STANDING_OBSERVATION_AUDIT_WITHDRAWN,
  STANDING_OBSERVATION_AUTHORIZE_DECISION_TYPE,
  STANDING_OBSERVATION_SUBJECT_TYPE,
  STANDING_OBSERVATION_WITHDRAW_DECISION_TYPE,
  isObservableCapability,
  type StandingObservationAuthorizationRecord,
  type StandingObservationRefusal,
  type StandingObservationScope,
  type StandingObservationState,
  type StandingObservationWriteResult,
} from "./contracts";

export interface StandingObservationWriteDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
}

/** Aborts the transaction when a governed rule refuses mid-flight. */
class StandingObservationAbort extends Error {
  constructor(readonly refusal: StandingObservationRefusal) {
    super(refusal);
    this.name = "StandingObservationAbort";
  }
}

function refused(reason: StandingObservationRefusal): StandingObservationWriteResult {
  return { status: "refused", reason };
}

function resolveDbOrNull(deps: StandingObservationWriteDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/** PostgreSQL `unique_violation`. Read from the driver's code, never from the message text. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && (error as { code?: unknown }).code === "23505"
  );
}

function trimmedOrEmpty(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * The connection this authorization would route through, resolved through the RELEASED READ SEAM.
 *
 * ── WHY IT DOES NOT QUERY `integrations` DIRECTLY ────────────────────────────
 *
 * A released firewall pins the modules that may name the integrations table to exactly two, both
 * inside `integration-authority`. That boundary exists so that a connection's shape and its
 * tenant predicate have ONE definition; a second module writing its own `where` would be a second
 * answer to "does this tenant own this connection", free to drift from the first. So this asks the
 * authority instead of reading around it.
 *
 * ── AND WHY IT RUNS BEFORE THE TRANSACTION RATHER THAN INSIDE IT ─────────────
 *
 * It is not the safety mechanism, so it does not need to be transactional. The composite foreign
 * key `(integration_id, tenant_id) -> integrations(id, tenant_id)` is what makes an authorization
 * through another tenant's connection impossible, and it is enforced at INSERT whatever this read
 * saw a moment earlier. This exists so a caller gets an honest typed refusal instead of a
 * constraint violation, and so "that connection is for a different provider" stays a
 * distinguishable answer from "there is no such connection".
 *
 * A foreign id, a nonexistent id and a soft-deleted row are indistinguishable here, because the
 * read seam itself refuses to tell them apart.
 */
async function resolveTenantConnection(
  tenant: TenantContext,
  integrationId: string,
  providerKey: string,
  deps: StandingObservationWriteDeps,
): Promise<StandingObservationRefusal | null> {
  const connection = await readConnection(
    tenant,
    integrationId,
    deps.getDb ? { getDb: deps.getDb } : {},
  );
  if (!connection) return "connection-unresolvable";
  if (connection.providerKey !== providerKey) return "connection-provider-mismatch";
  return null;
}

interface EffectiveRevisionRow {
  readonly authorizationId: string;
  readonly authorizationRevision: number;
  readonly state: StandingObservationState;
  readonly integrationId: string;
  readonly intervalMinutes: number;
}

/**
 * This lineage's current effective revision, or `null` when it has never had one.
 *
 * EFFECTIVE IS `max(authorization_revision)`, and this is the only place that definition is applied
 * on the write path. Nothing is locked and nothing is updated: the unique index is what makes the
 * next ordinal safe to compute, and a loser of that race is refused rather than silently retried at
 * a higher ordinal — retrying would write a revision on top of somebody else's without the human
 * ever seeing it.
 */
async function readEffectiveRevisionWithin(
  tx: ControlPlaneDatabase,
  tenantId: string,
  scope: StandingObservationScope,
): Promise<EffectiveRevisionRow | null> {
  const rows = await tx
    .select({
      id: standingObservationAuthorizations.id,
      revision: standingObservationAuthorizations.authorizationRevision,
      state: standingObservationAuthorizations.state,
      integrationId: standingObservationAuthorizations.integrationId,
      intervalMinutes: standingObservationAuthorizations.intervalMinutes,
    })
    .from(standingObservationAuthorizations)
    .where(
      and(
        eq(standingObservationAuthorizations.tenantId, tenantId),
        eq(standingObservationAuthorizations.providerKey, scope.providerKey),
        eq(standingObservationAuthorizations.capabilityKey, scope.capabilityKey),
        eq(standingObservationAuthorizations.subjectRef, scope.subjectRef),
      ),
    )
    .orderBy(desc(standingObservationAuthorizations.authorizationRevision))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return {
    authorizationId: row.id,
    authorizationRevision: row.revision,
    state: row.state,
    integrationId: row.integrationId,
    intervalMinutes: row.intervalMinutes,
  };
}

/** What a caller supplies to authorize (or re-authorize, or narrow) one scope. */
export interface AuthorizeStandingObservationInput {
  readonly providerKey: string;
  readonly capabilityKey: string;
  readonly subjectKind: string;
  /** The PROVIDER's canonical reference. Never a handle a human typed. */
  readonly subjectRef: string;
  readonly integrationId: string;
  readonly intervalMinutes: number;
  readonly justification: string;
  /** The revision the human was shown, or `null` for "I believe this scope has none". */
  readonly observedAuthorizationRevision: number | null;
}

/** What a caller supplies to withdraw one. No scope details: withdrawal narrows nothing. */
export interface WithdrawStandingObservationInput {
  readonly providerKey: string;
  readonly capabilityKey: string;
  readonly subjectKind: string;
  readonly subjectRef: string;
  readonly justification: string;
  readonly observedAuthorizationRevision: number | null;
}

/**
 * Authorize — or re-authorize, or narrow — recurring observation of ONE exact scope, under the
 * tenant's Governance authority.
 *
 * The caller names the scope, the connection, the cadence ceiling and its reason, and states which
 * revision it was shown. It CANNOT supply the tenant, the acting human, the decision, the session,
 * the revision ordinal, the authorized instant, the predecessor, or the state — every one of those
 * is server-derived, and the type gives them no parameter to arrive in.
 */
export async function authorizeStandingObservation(
  tenant: TenantContext | null,
  input: AuthorizeStandingObservationInput,
  deps: StandingObservationWriteDeps = {},
): Promise<StandingObservationWriteResult> {
  return writeRevision(tenant, "active", input, deps);
}

/**
 * Withdraw a standing observation authorization.
 *
 * A NEW revision saying `withdrawn`, under a Governance `revoke` decision. The active revision it
 * replaces is left byte-identical. There is no path by which a withdrawn revision becomes active
 * again: re-authorizing is another new active revision under another new decision, which is what
 * makes "was this ever taken away, and when, and why" answerable forever.
 *
 * The connection and cadence are CARRIED FORWARD from the revision being withdrawn rather than
 * accepted from the caller. A withdrawal that let a caller name a different connection would be a
 * silent re-pointing dressed as a removal.
 */
export async function withdrawStandingObservation(
  tenant: TenantContext | null,
  input: WithdrawStandingObservationInput,
  deps: StandingObservationWriteDeps = {},
): Promise<StandingObservationWriteResult> {
  return writeRevision(tenant, "withdrawn", input, deps);
}

type RevisionInput = AuthorizeStandingObservationInput | WithdrawStandingObservationInput;

function intervalOf(input: RevisionInput): number | null {
  return "intervalMinutes" in input ? input.intervalMinutes : null;
}

function integrationOf(input: RevisionInput): string {
  return "integrationId" in input ? trimmedOrEmpty(input.integrationId) : "";
}

/**
 * The one transition, in the one transaction. Both public entry points land here and differ only in
 * the state they are writing and the decision type that authorizes it.
 */
async function writeRevision(
  tenant: TenantContext | null,
  nextState: StandingObservationState,
  input: RevisionInput,
  deps: StandingObservationWriteDeps,
): Promise<StandingObservationWriteResult> {
  if (typeof window !== "undefined") {
    throw new Error("Standing observation authorization is server-only.");
  }

  /* 1 · A REAL, SERVER-RESOLVED TENANT AND HUMAN. Fail closed before anything is read. */
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");
  const authenticated = tenant;

  /* 2 · EVERY GOVERNANCE DECISION NEEDS A REASON, AND THIS IS ONE. */
  const justification = validateJustification(input?.justification ?? "");
  if (!justification) return refused("justification-required");

  /*
   * 3 · THE SCOPE, REFUSED WHOLE IF IT IS NOT IN THE RELEASED OBSERVABLE ALLOW-LIST.
   *
   * All three of provider, capability and subject KIND must match one released entry together. A
   * capability that changes something outside Hebun can never be authorized to recur, and the
   * allow-list — not `writeCapable`, which is a statement about what is presently possible — is
   * what decides that.
   */
  const scope: StandingObservationScope = {
    providerKey: trimmedOrEmpty(input?.providerKey),
    capabilityKey: trimmedOrEmpty(input?.capabilityKey),
    subjectKind: trimmedOrEmpty(input?.subjectKind),
    subjectRef: trimmedOrEmpty(input?.subjectRef),
  };
  if (!isObservableCapability(scope.providerKey, scope.capabilityKey, scope.subjectKind)) {
    return refused("capability-not-observable");
  }
  if (scope.subjectRef.length === 0) return refused("subject-required");

  const observedRevision =
    input?.observedAuthorizationRevision === null ||
    input?.observedAuthorizationRevision === undefined
      ? null
      : input.observedAuthorizationRevision;
  if (observedRevision !== null && !Number.isInteger(observedRevision)) {
    return refused("stale-authorization-revision");
  }

  /*
   * 4 · THE CADENCE CEILING, ON AUTHORIZATION ONLY.
   *
   * A withdrawal carries the previous revision's interval forward and therefore validates none: a
   * withdrawal that accepted a cadence would be pretending to decide something it does not decide.
   */
  const requestedInterval = intervalOf(input);
  if (nextState === "active") {
    if (
      requestedInterval === null ||
      !Number.isInteger(requestedInterval) ||
      requestedInterval < MIN_OBSERVATION_INTERVAL_MINUTES ||
      requestedInterval > MAX_OBSERVATION_INTERVAL_MINUTES
    ) {
      return refused("interval-out-of-bounds");
    }
    if (integrationOf(input).length === 0) return refused("connection-unresolvable");
  }

  const db = resolveDbOrNull(deps);
  if (!db) return refused("persistence-unavailable");
  const now = (deps.now ?? (() => new Date()))();

  /*
   * 5 · THE AUTHORITY, RESOLVED BEFORE THE TRANSACTION.
   *
   * The ONE released resolver. Only the human the bootstrap decision established — or a human
   * holding an unrevoked delegation — passes. A tenant owner without Governance authority is refused
   * exactly like a stranger, and no role band, permission row or membership scope is consulted
   * anywhere in this module.
   */
  let authority: GovernanceAuthorityResolution;
  try {
    authority = await resolveGovernanceAuthority(authenticated, deps);
  } catch {
    return refused("persistence-unavailable");
  }
  if (!authority.bootstrapDecisionId) return refused("no-governance-authority");
  if (!authority.authorized) return refused("not-the-governance-authority");

  /*
   * THE CONNECTION, THROUGH THE AUTHORITY THAT OWNS IT. Only for an AUTHORIZATION: a withdrawal
   * carries the previous revision's connection forward and names none, so there is nothing here for
   * it to validate. Its own connection is checked by the foreign key like every other row's.
   */
  if (nextState === "active") {
    const connectionRefusal = await resolveTenantConnection(
      authenticated,
      integrationOf(input),
      scope.providerKey,
      deps,
    );
    if (connectionRefusal) return refused(connectionRefusal);
  }

  try {
    let outcome: StandingObservationWriteResult | null = null;

    await db.transaction(async (rawTx) => {
      const tx = rawTx as unknown as ControlPlaneDatabase;

      /* 6 · WHERE THE LINEAGE CURRENTLY STANDS. */
      const effective = await readEffectiveRevisionWithin(tx, authenticated.tenantId, scope);

      /*
       * 7 · THE HUMAN'S PRECONDITION (K4's lesson).
       *
       * The unique index stops two SIMULTANEOUS transactions; it cannot see the slower human case —
       * a scope reviewed at revision 2 and submitted after somebody committed revision 3. Comparing
       * what the human was actually shown catches exactly that, in both directions: believing there
       * is no authorization when there is, and believing there is one when there is not.
       */
      const currentRevision = effective?.authorizationRevision ?? null;
      if (observedRevision !== currentRevision) {
        throw new StandingObservationAbort("stale-authorization-revision");
      }

      /*
       * 8 · WHAT THE TRANSITION MEANS FROM HERE.
       *
       * Withdrawing nothing is refused rather than recorded: a `withdrawn` revision with no active
       * predecessor would be a record of a permission being taken away that nobody ever granted, and
       * the database CHECK refuses the revision-1 form of it independently.
       *
       * Re-authorizing an identical, already-active scope is refused too. It would be a second
       * Governance decision that changed nothing, and a ledger full of those stops being readable.
       */
      if (nextState === "withdrawn") {
        if (!effective || effective.state !== "active") {
          throw new StandingObservationAbort("no-active-authorization");
        }
      } else if (
        effective &&
        effective.state === "active" &&
        effective.integrationId === integrationOf(input) &&
        effective.intervalMinutes === requestedInterval
      ) {
        throw new StandingObservationAbort("already-authorized");
      }

      /*
       * 9 · THE CONNECTION AND THE CADENCE THIS REVISION WILL CARRY.
       *
       * A withdrawal inherits both from the revision it replaces — see `withdrawStandingObservation`
       * for why a withdrawal may not re-point a connection.
       */
      const integrationId = nextState === "active" ? integrationOf(input) : effective!.integrationId;
      const intervalMinutes =
        nextState === "active" ? requestedInterval! : effective!.intervalMinutes;

      const authorizationRevision = (currentRevision ?? 0) + FIRST_AUTHORIZATION_REVISION;
      const supersedesAuthorizationId = effective?.authorizationId ?? null;

      /*
       * 11 · THE CIRCULAR REFERENCE, AND THE AUTHORIZED SOLUTION.
       *
       * The decision must name the revision as its subject and the revision must name the decision
       * as its provenance; both columns are NOT NULL. I1 hit this exact shape and the Director
       * authorized generating the artifact's UUID in the application so the decision can bind to it
       * before the row exists. R3A and AMA-1 reused it; so does this. The row this id names is
       * written in the same transaction or not at all.
       */
      const authorizationId = randomUUID();

      /*
       * 12 · THE GOVERNANCE DECISION, BOUND TO THE REVISION — never to the lineage.
       *
       * A decision bound to the lineage would silently mean "whatever authorization is current when
       * someone reads this", which is the defect K4 found when G2's subject was a Knowledge fact
       * rather than a version.
       */
      const decision = await writeGovernanceDecisionWithin(
        tx,
        authenticated,
        authority,
        {
          decisionType:
            nextState === "withdrawn"
              ? STANDING_OBSERVATION_WITHDRAW_DECISION_TYPE
              : STANDING_OBSERVATION_AUTHORIZE_DECISION_TYPE,
          subjectType: STANDING_OBSERVATION_SUBJECT_TYPE,
          subjectId: authorizationId,
          /*
           * Evidence carries the SHAPE of what was decided. No credential, no key, no provider
           * response — and no justification duplicate: the decision row already owns the sentence.
           */
          evidence: {
            authorityVia: authority.via,
            authorityDelegationDecisionId: authority.delegationDecisionId,
            standingObservationAuthorizationId: authorizationId,
            authorizationRevision,
            state: nextState,
            providerKey: scope.providerKey,
            capabilityKey: scope.capabilityKey,
            subjectKind: scope.subjectKind,
            subjectRef: scope.subjectRef,
            integrationId,
            intervalMinutes,
            supersedesAuthorizationId,
          },
          justification,
        },
        now,
      );

      /* 13 · THE REVISION. Nothing that already exists is edited. */
      let inserted: { readonly id: string }[];
      try {
        inserted = await tx
          .insert(standingObservationAuthorizations)
          .values({
            id: authorizationId,
            tenantId: authenticated.tenantId,
            authorizationRevision,
            state: nextState,
            providerKey: scope.providerKey,
            capabilityKey: scope.capabilityKey,
            subjectKind: scope.subjectKind,
            subjectRef: scope.subjectRef,
            integrationId,
            intervalMinutes,
            governanceDecisionId: decision.decisionId,
            governanceSessionId: decision.sessionId,
            /*
             * THE ACCOUNTABLE HUMAN. The database CHECK refuses anything but `human` independently
             * of this line, which is what makes "an agent cannot authorize its own collection" a
             * fact about PostgreSQL rather than about this file.
             */
            authorizedByActorType: "human",
            authorizedByActorId: authenticated.userId,
            authorizedAt: now,
            supersedesAuthorizationId,
            createdAt: now,
            createdBy: authenticated.userId,
            createdByType: "human",
            updatedAt: now,
            updatedBy: authenticated.userId,
            updatedByType: "human",
          })
          .returning({ id: standingObservationAuthorizations.id });
      } catch (error) {
        /*
         * A LOST RACE, REPORTED AS ONE. Another revision committed this ordinal between the read
         * above and this insert. Nothing here retries at a higher ordinal: that would write a
         * revision on top of one the human never saw.
         */
        if (isUniqueViolation(error)) {
          throw new StandingObservationAbort("concurrent-authorization-change");
        }
        throw error;
      }

      const writtenId = inserted[0]?.id;
      if (!writtenId) throw new StandingObservationAbort("persistence-unavailable");

      /* 14 · The Governance event: a decision was made. */
      await recordGovernanceEventWithin(
        tx,
        {
          tenantId: authenticated.tenantId,
          userId: authenticated.userId,
          requestId: authenticated.requestId,
          sessionContextId: authenticated.sessionContextId,
        },
        {
          action: "governance.decision.recorded",
          outcome: "committed",
          entityId: decision.decisionId,
          metadata: {
            governanceSessionId: decision.sessionId,
            decisionType:
              nextState === "withdrawn"
                ? STANDING_OBSERVATION_WITHDRAW_DECISION_TYPE
                : STANDING_OBSERVATION_AUTHORIZE_DECISION_TYPE,
            subjectType: STANDING_OBSERVATION_SUBJECT_TYPE,
            subjectId: authorizationId,
            bootstrap: false,
          },
        },
        now,
      );

      /*
       * 15 · The standing-observation event: a tenant's read scope changed. Different authority,
       * different entity type — two truthful events about two different owners, in one transaction,
       * not one event duplicated.
       */
      await recordStandingObservationEventWithin(
        tx,
        {
          tenantId: authenticated.tenantId,
          userId: authenticated.userId,
          requestId: authenticated.requestId,
          sessionContextId: authenticated.sessionContextId,
        },
        {
          action:
            nextState === "withdrawn"
              ? STANDING_OBSERVATION_AUDIT_WITHDRAWN
              : STANDING_OBSERVATION_AUDIT_AUTHORIZED,
          outcome: "committed",
          entityId: authorizationId,
          metadata: {
            authorizationRevision,
            state: nextState,
            providerKey: scope.providerKey,
            capabilityKey: scope.capabilityKey,
            subjectKind: scope.subjectKind,
            subjectRef: scope.subjectRef,
            integrationId,
            intervalMinutes,
            governanceDecisionId: decision.decisionId,
            governanceSessionId: decision.sessionId,
            supersedesAuthorizationId,
            /* TRH-23 authorizes; nothing collects. Stated on every row. */
            collected: false,
          },
        },
        now,
      );

      const record: StandingObservationAuthorizationRecord = {
        authorizationId,
        authorizationRevision,
        state: nextState,
        providerKey: scope.providerKey,
        capabilityKey: scope.capabilityKey,
        subjectKind: scope.subjectKind,
        subjectRef: scope.subjectRef,
        integrationId,
        intervalMinutes,
        governanceDecisionId: decision.decisionId,
        governanceSessionId: decision.sessionId,
        authorizedByActorId: authenticated.userId,
        authorizedAt: now.toISOString(),
        supersedesAuthorizationId,
      };
      outcome = { status: "authorized", authorization: record };
    });

    return outcome ?? refused("persistence-unavailable");
  } catch (error) {
    if (error instanceof StandingObservationAbort) return refused(error.refusal);
    /*
     * A unique violation can also surface here when the driver reports it at COMMIT rather than at
     * the statement. Same fact, same refusal.
     */
    if (isUniqueViolation(error)) return refused("concurrent-authorization-change");
    return refused("persistence-unavailable");
  }
}
