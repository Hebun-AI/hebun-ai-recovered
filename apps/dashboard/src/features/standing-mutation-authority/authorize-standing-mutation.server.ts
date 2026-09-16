/*
 * standing-mutation-authority/authorize-standing-mutation.server.ts — the ONLY way a standing
 * mutation envelope comes into being or is taken away (RUNG 2).
 *
 * ── WHAT A HUMAN IS DECIDING HERE ───────────────────────────────────────────
 *
 *     That a NAMED agent's EVIDENCED `record-work` proposals need not be decided one at a time,
 *     for at most N acts, no faster than one per M minutes, between two instants.
 *
 * That is the most consequential thing this surface can grant, and every clause of it is a bound.
 * There is no parameter here for a payload, a target, a work title, a department, a provider, a
 * credential, a permit or an act — an envelope authorizes a SHAPE of future authorization, never a
 * particular one, and it performs nothing at the moment it is written.
 *
 * ── IT IS NOT AN ACT, AND NOTHING BECOMES EXECUTABLE ────────────────────────
 *
 *     AUTHORIZED != ISSUED != DELIVERED != EXECUTED
 *
 * Writing this row mints no permit, spends nothing, reaches no provider and records no work. A
 * permit appears only when the issuing seam later finds a pending agent proposal that fits, and
 * even then the released executor re-decides arming, enrolment, liveness and the frozen action set
 * inside the spend's own transaction before anything is written.
 *
 * ── GOVERNANCE, AND GOVERNANCE AT THE TIME OF THE CHANGE ────────────────────
 *
 * Creating and withdrawing both require CURRENT Governance authority, resolved by the one released
 * resolver. The envelope itself is the ORGANIZATION'S standing decision and not a capability
 * belonging to the human who signed it: if that person later loses membership or Governance
 * authority, the envelope stands until the owning lifecycle withdraws it. This is the rule the
 * tenant machine-execution authority already established, followed rather than re-invented.
 *
 * ── LINEAGE, NEVER MUTATION ─────────────────────────────────────────────────
 *
 * Nothing already written is edited. Withdrawing appends a `withdrawn` revision; re-authorizing
 * appends a new `active` one. The effective revision is `max(authorization_revision)`, derived on
 * read. A stored `is_current` beside a derivable one is two facts that can disagree.
 *
 * Server-only.
 */
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { standingMutationAuthorizations } from "@/db/schema/standing-mutation-authorization";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { recordGovernanceEventWithin } from "@/features/governance-audit/governance-decision-audit.server";
import {
  resolveGovernanceAuthority,
  type GovernanceAuthorityResolution,
} from "@/features/governance-decision/authority-read.server";
import { writeGovernanceDecisionWithin } from "@/features/governance-decision/decision-authority.server";
import { validateJustification } from "@/features/governance-decision/persistence.server";
import { MACHINE_EXECUTABLE_ACTION_KINDS } from "@/features/governed-machine-execution/contracts";
import { readDurableAgentRuntimeLiveness } from "@/features/agent-identity/read-durable-agent-identity.server";
import {
  STANDING_MUTATION_AUTHORIZE_DECISION_TYPE,
  STANDING_MUTATION_SUBJECT_TYPE,
  STANDING_MUTATION_WITHDRAW_DECISION_TYPE,
  type StandingMutationState,
  type StandingMutationWriteRefusal,
} from "./contracts";

const FIRST_AUTHORIZATION_REVISION = 1;

/**
 * THE SCHEMA'S OWN BOUNDS, RESTATED HERE SO A REFUSAL IS A SENTENCE AND NOT A CONSTRAINT ERROR.
 *
 * The CHECKs on the table are the authority and they hold regardless of this file. These exist so a
 * human who asks for 500 acts is TOLD the ceiling, rather than shown a database error that reads
 * like an outage. A test asserts the two agree.
 */
export const STANDING_MUTATION_MAX_ACTS_CEILING = 50;
export const STANDING_MUTATION_MIN_INTERVAL_CEILING_MINUTES = 10_080;

export interface StandingMutationWriteDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
  readonly readAgentLiveness?: typeof readDurableAgentRuntimeLiveness;
}

export interface AuthorizeStandingMutationInput {
  /** The ONE agent this envelope names. Never a class, never "any". */
  readonly agentId: string;
  /** Must be a member of the released frozen machine-executable set. */
  readonly actionKind: string;
  readonly notBefore: Date;
  readonly notAfter: Date;
  readonly maxActs: number;
  readonly minIntervalMinutes: number;
  readonly justification: string;
  /**
   * WHICH REVISION THE HUMAN WAS ACTUALLY SHOWN. `null` means "I believe this agent holds no
   * envelope". The unique index stops two SIMULTANEOUS transactions but cannot see the slower human
   * case — a screen read at revision 2 and submitted after somebody committed revision 3.
   */
  readonly observedRevision: number | null;
}

export type StandingMutationWriteResult =
  | {
      readonly status: "written";
      readonly authorizationId: string;
      readonly authorizationRevision: number;
      readonly state: StandingMutationState;
      readonly governanceDecisionId: string;
      readonly governanceSessionId: string;
    }
  | { readonly status: "refused"; readonly reason: StandingMutationWriteRefusal };

class StandingMutationAbort extends Error {
  constructor(readonly reason: StandingMutationWriteRefusal) {
    super(reason);
  }
}

function refused(reason: StandingMutationWriteRefusal): StandingMutationWriteResult {
  return { status: "refused", reason };
}

function resolveDbOrNull(deps: StandingMutationWriteDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/** Positive, whole, and inside the schema's own ceiling. */
function isBoundedCount(value: unknown, ceiling: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= ceiling;
}

/**
 * Authorize a new standing envelope, or withdraw the standing one.
 *
 * `nextState` is the transition, not a field a caller may set on an existing row: nothing here
 * updates, and both branches append a revision.
 */
export async function writeStandingMutationAuthorization(
  tenant: TenantContext | null,
  nextState: StandingMutationState,
  input: AuthorizeStandingMutationInput | null,
  deps: StandingMutationWriteDeps = {},
): Promise<StandingMutationWriteResult> {
  if (typeof window !== "undefined") {
    throw new Error("Standing mutation authorization is server-only.");
  }

  /* 1 · A HUMAN, RESOLVED FROM THE DURABLE SESSION. There is no parameter for an actor. */
  const authenticated = tenant;
  if (!authenticated?.tenantId || !authenticated.userId) return refused("unauthenticated");

  const justification = validateJustification(input?.justification);
  if (!justification) return refused("justification-required");

  /*
   * 2 · THE KIND, AGAINST THE RELEASED FROZEN SET — consulted, never restated.
   *
   * An envelope can only ever name something a machine may already perform. It cannot add a member
   * to that set, so no decision taken here can widen what a machine may do.
   */
  const actionKind = (input?.actionKind ?? "").trim();
  if (!MACHINE_EXECUTABLE_ACTION_KINDS.has(actionKind)) {
    return refused("unsupported-action-kind");
  }

  const agentId = (input?.agentId ?? "").trim();
  if (!agentId) return refused("agent-unresolvable");

  /* 3 · THE ENVELOPE'S OWN SHAPE, refused as a sentence rather than as a constraint violation. */
  const notBefore = input?.notBefore;
  const notAfter = input?.notAfter;
  if (
    !(notBefore instanceof Date) ||
    !(notAfter instanceof Date) ||
    Number.isNaN(notBefore.getTime()) ||
    Number.isNaN(notAfter.getTime()) ||
    notAfter.getTime() <= notBefore.getTime() ||
    !isBoundedCount(input?.maxActs, STANDING_MUTATION_MAX_ACTS_CEILING) ||
    !isBoundedCount(input?.minIntervalMinutes, STANDING_MUTATION_MIN_INTERVAL_CEILING_MINUTES)
  ) {
    return refused("invalid-envelope");
  }

  const db = resolveDbOrNull(deps);
  if (!db) return refused("persistence-unavailable");
  const now = (deps.now ?? (() => new Date()))();

  /*
   * 4 · THE AGENT MUST EXIST, BELONG HERE, AND BE IN SERVICE.
   *
   * Read through the released identity authority applying its own `inService` predicate, never a
   * second reading of the agents table. An envelope for a retired agent would authorize nothing and
   * would only ever manufacture refusals at issuance.
   */
  const liveness = await (deps.readAgentLiveness ?? readDurableAgentRuntimeLiveness)(
    authenticated.tenantId,
    agentId,
    deps.getDb ? { getDb: deps.getDb } : {},
  );
  /* Every branch named. An outage is reported as itself and never as a retirement. */
  if (liveness === "unavailable") return refused("persistence-unavailable");
  if (liveness === "unknown-agent") return refused("agent-unresolvable");
  if (liveness !== "in-service") return refused("agent-not-in-service");

  /* 5 · THE AUTHORITY, RESOLVED BEFORE THE TRANSACTION. */
  let authority: GovernanceAuthorityResolution;
  try {
    authority = await resolveGovernanceAuthority(authenticated, deps);
  } catch {
    return refused("persistence-unavailable");
  }
  if (!authority.bootstrapDecisionId) return refused("no-governance-authority");
  if (!authority.authorized) return refused("not-the-governance-authority");

  const observedRevision = input?.observedRevision ?? null;

  try {
    let outcome: StandingMutationWriteResult | null = null;

    await db.transaction(async (rawTx) => {
      const tx = rawTx as unknown as ControlPlaneDatabase;

      /* 6 · WHERE THE LINEAGE STANDS — highest revision wins, as everywhere else. */
      const existing = await tx
        .select({
          id: standingMutationAuthorizations.id,
          authorizationRevision: standingMutationAuthorizations.authorizationRevision,
          state: standingMutationAuthorizations.state,
        })
        .from(standingMutationAuthorizations)
        .where(
          and(
            eq(standingMutationAuthorizations.tenantId, authenticated.tenantId),
            eq(standingMutationAuthorizations.agentId, agentId),
          ),
        )
        .orderBy(desc(standingMutationAuthorizations.authorizationRevision))
        .limit(1);

      const effective = existing[0] ?? null;
      const currentRevision = effective?.authorizationRevision ?? null;

      /* 7 · THE HUMAN'S PRECONDITION. See `observedRevision`. */
      if (observedRevision !== currentRevision) {
        throw new StandingMutationAbort("stale-authorization-revision");
      }

      /*
       * 8 · WHAT THE TRANSITION MEANS FROM HERE.
       *
       * Withdrawing nothing is refused rather than recorded: a `withdrawn` revision with no active
       * predecessor would record a permission being taken away that nobody ever granted.
       * Re-authorizing an already-standing envelope is refused too — a second Governance decision
       * that changed nothing, and a ledger full of those stops being readable.
       */
      if (nextState === "withdrawn") {
        if (!effective || effective.state !== "active") {
          throw new StandingMutationAbort("no-active-authorization");
        }
      } else if (effective && effective.state === "active") {
        throw new StandingMutationAbort("already-authorized");
      }

      const authorizationRevision = (currentRevision ?? 0) + FIRST_AUTHORIZATION_REVISION;
      const supersedesAuthorizationId = effective?.id ?? null;

      /*
       * 9 · THE CIRCULAR REFERENCE, AND THE AUTHORIZED SOLUTION. The decision must name the
       * revision as its subject and the revision must name the decision as its provenance; both
       * columns are NOT NULL. I1 hit this shape and the Director authorized generating the
       * artifact's UUID in the application. R3A, AMA-1, TRH-23 and the tenant machine-execution
       * authority all reuse it; so does this.
       */
      const authorizationId = randomUUID();

      /* 10 · THE DECISION, BOUND TO THE REVISION — never to the lineage. */
      const decision = await writeGovernanceDecisionWithin(
        tx,
        authenticated,
        authority,
        {
          decisionType:
            nextState === "withdrawn"
              ? STANDING_MUTATION_WITHDRAW_DECISION_TYPE
              : STANDING_MUTATION_AUTHORIZE_DECISION_TYPE,
          subjectType: STANDING_MUTATION_SUBJECT_TYPE,
          subjectId: authorizationId,
          /* The SHAPE of what was decided. No payload, no target, no permit, no act. */
          evidence: {
            authorityVia: authority.via,
            authorityDelegationDecisionId: authority.delegationDecisionId,
            standingMutationAuthorizationId: authorizationId,
            authorizationRevision,
            state: nextState,
            agentId,
            actionKind,
            notBefore: notBefore.toISOString(),
            notAfter: notAfter.toISOString(),
            maxActs: input!.maxActs,
            minIntervalMinutes: input!.minIntervalMinutes,
            supersedesAuthorizationId,
          },
          justification,
        },
        now,
      );

      /* 11 · THE REVISION. Nothing that already exists is edited. */
      const inserted = await tx
        .insert(standingMutationAuthorizations)
        .values({
          id: authorizationId,
          tenantId: authenticated.tenantId,
          authorizationRevision,
          state: nextState,
          agentId,
          actionKind,
          notBefore,
          notAfter,
          maxActs: input!.maxActs,
          minIntervalMinutes: input!.minIntervalMinutes,
          governanceDecisionId: decision.decisionId,
          governanceSessionId: decision.sessionId,
          /* The CHECK refuses anything but `human` independently of this line. */
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
        .returning({ id: standingMutationAuthorizations.id });

      const writtenId = inserted[0]?.id;
      if (!writtenId) throw new StandingMutationAbort("persistence-unavailable");

      /* 12 · The Governance event: a decision was made. */
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
                ? STANDING_MUTATION_WITHDRAW_DECISION_TYPE
                : STANDING_MUTATION_AUTHORIZE_DECISION_TYPE,
            subjectType: STANDING_MUTATION_SUBJECT_TYPE,
            subjectId: authorizationId,
            bootstrap: false,
          },
        },
        now,
      );

      outcome = {
        status: "written",
        authorizationId,
        authorizationRevision,
        state: nextState,
        governanceDecisionId: decision.decisionId,
        governanceSessionId: decision.sessionId,
      };
    });

    return outcome ?? refused("persistence-unavailable");
  } catch (error) {
    if (error instanceof StandingMutationAbort) return refused(error.reason);
    return refused("persistence-unavailable");
  }
}
