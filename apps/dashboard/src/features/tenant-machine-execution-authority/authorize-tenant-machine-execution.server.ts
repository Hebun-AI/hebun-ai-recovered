/*
 * authorize-tenant-machine-execution.server.ts — THE ONLY WRITER OF TENANT PARTICIPATION.
 *
 * ── WHO MAY WRITE HERE ──────────────────────────────────────────────────────
 *
 * An authenticated human holding THIS TENANT'S Governance authority. Nobody else, and no other
 * shape of caller exists:
 *
 *   - the tenant is taken from the authenticated context, never from an argument
 *   - `resolveGovernanceAuthority` is the ONE released resolver, and it reads
 *     `decision_records.bootstrap` (or an unrevoked delegation) — never a role band, a permission
 *     row or a membership scope, so a tenant OWNER without Governance authority is refused exactly
 *     like a stranger
 *   - the database CHECK refuses any `authorized_by_actor_type` but `human`, which makes "an agent
 *     cannot enrol its own organization" a fact about PostgreSQL rather than about this file
 *   - there is no possession shortcut: deployment possession stops the world, it does not enrol
 *     organizations into it
 *
 * ── WHY NOT THE POSSESSION CEREMONY THAT ARMS THE ROOT SWITCH ───────────────
 *
 * That ceremony writes `updated_by = NULL` because possession is a SOURCE and not an ACTOR — Hebun
 * cannot identify the human at that terminal. Acceptable for an emergency stop, whose failure
 * direction is safe. NOT acceptable for enrolling an organization into unattended mutation, where
 * somebody must own the decision by name, forever. So this row carries a named human, a Governance
 * decision, its session, and an audit event — all committed together or not at all.
 *
 * ── REVISIONS, NOT EDITS ────────────────────────────────────────────────────
 *
 * Nothing is ever updated in place. Withdrawing writes a NEW revision saying `withdrawn` under its
 * own `revoke` decision and leaves its predecessor byte-identical. Re-enrolling writes another
 * active revision under another decision. A withdrawn revision never becomes active again, which is
 * what keeps "was this ever taken away, and when, and by whom" answerable forever.
 *
 * ── WHAT IT STILL DOES NOT DO ───────────────────────────────────────────────
 *
 * It authorizes no act, mints no permit, chooses no work, executes nothing and arms nothing. A
 * tenant holding an active authorization still executes NOTHING until a human authorizes an exact
 * act, a permit exists, and the deployment operator has armed the root control.
 *
 *     ENROLLED != AUTHORIZED != REACHABLE != EXECUTED
 *
 * Server-only.
 */
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { tenantMachineExecutionAuthorizations } from "@/db/schema/tenant-machine-execution-authorization";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { recordGovernanceEventWithin } from "@/features/governance-audit/governance-decision-audit.server";
import {
  resolveGovernanceAuthority,
  type GovernanceAuthorityResolution,
} from "@/features/governance-decision/authority-read.server";
import { writeGovernanceDecisionWithin } from "@/features/governance-decision/decision-authority.server";
import { validateJustification } from "@/features/governance-decision/persistence.server";
import { MACHINE_EXECUTABLE_ACTION_KINDS } from "@/features/governed-machine-execution/contracts";
import {
  TENANT_MACHINE_EXECUTION_AUTHORIZE_DECISION_TYPE,
  TENANT_MACHINE_EXECUTION_SUBJECT_TYPE,
  TENANT_MACHINE_EXECUTION_WITHDRAW_DECISION_TYPE,
  type TenantMachineExecutionState,
  type TenantMachineExecutionWriteRefusal,
} from "./contracts";

const FIRST_AUTHORIZATION_REVISION = 1;

export interface TenantMachineExecutionWriteDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
}

export interface AuthorizeTenantMachineExecutionInput {
  readonly capabilityKey: string;
  readonly justification: string;
  /**
   * WHICH REVISION THE HUMAN WAS ACTUALLY SHOWN. `null` means "I believe this tenant holds no
   * authorization for this capability". K4's lesson: the unique index stops two SIMULTANEOUS
   * transactions but cannot see the slower human case — a screen read at revision 2 and submitted
   * after somebody committed revision 3. Comparing what the human was shown catches exactly that,
   * in both directions.
   */
  readonly observedRevision: number | null;
}

export type TenantMachineExecutionWriteResult =
  | {
      readonly status: "written";
      readonly authorizationId: string;
      readonly authorizationRevision: number;
      readonly state: TenantMachineExecutionState;
      readonly governanceDecisionId: string;
      readonly governanceSessionId: string;
    }
  | { readonly status: "refused"; readonly reason: TenantMachineExecutionWriteRefusal };

class TenantMachineExecutionAbort extends Error {
  constructor(readonly reason: TenantMachineExecutionWriteRefusal) {
    super(reason);
  }
}

function refused(reason: TenantMachineExecutionWriteRefusal): TenantMachineExecutionWriteResult {
  return { status: "refused", reason };
}

function resolveDbOrNull(deps: TenantMachineExecutionWriteDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/** Enrol this tenant into machine execution for one capability. */
export function authorizeTenantMachineExecution(
  tenant: TenantContext | null,
  input: AuthorizeTenantMachineExecutionInput,
  deps: TenantMachineExecutionWriteDeps = {},
): Promise<TenantMachineExecutionWriteResult> {
  return writeRevision(tenant, "active", input, deps);
}

/**
 * Withdraw it.
 *
 * The capability is carried forward from the revision being withdrawn rather than re-accepted, for
 * the reason its observation sibling records: a withdrawal that let a caller name a different scope
 * would be a silent re-pointing dressed as a removal.
 */
export function withdrawTenantMachineExecution(
  tenant: TenantContext | null,
  input: AuthorizeTenantMachineExecutionInput,
  deps: TenantMachineExecutionWriteDeps = {},
): Promise<TenantMachineExecutionWriteResult> {
  return writeRevision(tenant, "withdrawn", input, deps);
}

async function writeRevision(
  tenant: TenantContext | null,
  nextState: TenantMachineExecutionState,
  input: AuthorizeTenantMachineExecutionInput,
  deps: TenantMachineExecutionWriteDeps,
): Promise<TenantMachineExecutionWriteResult> {
  if (typeof window !== "undefined") {
    throw new Error("Tenant machine-execution authorization is server-only.");
  }

  /* 1 · AN AUTHENTICATED HUMAN, OR NOTHING. The tenant is theirs; it is never an argument. */
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");
  const authenticated = tenant;

  const justification = validateJustification(input?.justification);
  if (!justification) return refused("justification-required");

  /*
   * 2 · A CAPABILITY A MACHINE MAY ACTUALLY EXECUTE.
   *
   * The released frozen set is the authority, consulted rather than restated. Governance may agree
   * to participate in what that set already admits; it can never add a member to it, so no decision
   * taken here can widen what a machine may do.
   */
  const capabilityKey = (input?.capabilityKey ?? "").trim();
  if (!MACHINE_EXECUTABLE_ACTION_KINDS.has(capabilityKey)) {
    return refused("unsupported-machine-capability");
  }

  const db = resolveDbOrNull(deps);
  if (!db) return refused("persistence-unavailable");
  const now = (deps.now ?? (() => new Date()))();

  /* 3 · THE AUTHORITY, RESOLVED BEFORE THE TRANSACTION. */
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
    let outcome: TenantMachineExecutionWriteResult | null = null;

    await db.transaction(async (rawTx) => {
      const tx = rawTx as unknown as ControlPlaneDatabase;

      /* 4 · WHERE THE LINEAGE CURRENTLY STANDS — highest revision wins, as everywhere else. */
      const existing = await tx
        .select({
          id: tenantMachineExecutionAuthorizations.id,
          authorizationRevision: tenantMachineExecutionAuthorizations.authorizationRevision,
          state: tenantMachineExecutionAuthorizations.state,
        })
        .from(tenantMachineExecutionAuthorizations)
        .where(
          and(
            eq(tenantMachineExecutionAuthorizations.tenantId, authenticated.tenantId),
            eq(tenantMachineExecutionAuthorizations.capabilityKey, capabilityKey),
          ),
        )
        .orderBy(desc(tenantMachineExecutionAuthorizations.authorizationRevision))
        .limit(1);

      const effective = existing[0] ?? null;
      const currentRevision = effective?.authorizationRevision ?? null;

      /* 5 · THE HUMAN'S PRECONDITION. See `observedRevision`. */
      if (observedRevision !== currentRevision) {
        throw new TenantMachineExecutionAbort("stale-authorization-revision");
      }

      /*
       * 6 · WHAT THE TRANSITION MEANS FROM HERE.
       *
       * Withdrawing nothing is refused rather than recorded: a `withdrawn` revision with no active
       * predecessor would record a permission being taken away that nobody ever granted, and the
       * `first_revision_active` CHECK refuses the revision-1 form of it independently.
       *
       * Re-enrolling an already-enrolled tenant is refused too. It would be a second Governance
       * decision that changed nothing, and a ledger full of those stops being readable.
       */
      if (nextState === "withdrawn") {
        if (!effective || effective.state !== "active") {
          throw new TenantMachineExecutionAbort("no-active-authorization");
        }
      } else if (effective && effective.state === "active") {
        throw new TenantMachineExecutionAbort("already-authorized");
      }

      const authorizationRevision = (currentRevision ?? 0) + FIRST_AUTHORIZATION_REVISION;
      const supersedesAuthorizationId = effective?.id ?? null;

      /*
       * 7 · THE CIRCULAR REFERENCE, AND THE AUTHORIZED SOLUTION. The decision must name the
       * revision as its subject and the revision must name the decision as its provenance; both
       * columns are NOT NULL. I1 hit this exact shape and the Director authorized generating the
       * artifact's UUID in the application. R3A, AMA-1 and TRH-23 reused it; so does this. The row
       * this id names is written in the same transaction or not at all.
       */
      const authorizationId = randomUUID();

      /* 8 · THE DECISION, BOUND TO THE REVISION — never to the lineage. */
      const decision = await writeGovernanceDecisionWithin(
        tx,
        authenticated,
        authority,
        {
          decisionType:
            nextState === "withdrawn"
              ? TENANT_MACHINE_EXECUTION_WITHDRAW_DECISION_TYPE
              : TENANT_MACHINE_EXECUTION_AUTHORIZE_DECISION_TYPE,
          subjectType: TENANT_MACHINE_EXECUTION_SUBJECT_TYPE,
          subjectId: authorizationId,
          /* The SHAPE of what was decided. No credential, no permit, no act. */
          evidence: {
            authorityVia: authority.via,
            authorityDelegationDecisionId: authority.delegationDecisionId,
            tenantMachineExecutionAuthorizationId: authorizationId,
            authorizationRevision,
            state: nextState,
            capabilityKey,
            supersedesAuthorizationId,
          },
          justification,
        },
        now,
      );

      /* 9 · THE REVISION. Nothing that already exists is edited. */
      const inserted = await tx
        .insert(tenantMachineExecutionAuthorizations)
        .values({
          id: authorizationId,
          tenantId: authenticated.tenantId,
          authorizationRevision,
          state: nextState,
          capabilityKey,
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
        .returning({ id: tenantMachineExecutionAuthorizations.id });

      const writtenId = inserted[0]?.id;
      if (!writtenId) throw new TenantMachineExecutionAbort("persistence-unavailable");

      /* 10 · The Governance event: a decision was made. */
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
                ? TENANT_MACHINE_EXECUTION_WITHDRAW_DECISION_TYPE
                : TENANT_MACHINE_EXECUTION_AUTHORIZE_DECISION_TYPE,
            subjectType: TENANT_MACHINE_EXECUTION_SUBJECT_TYPE,
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
    if (error instanceof TenantMachineExecutionAbort) return refused(error.reason);
    return refused("persistence-unavailable");
  }
}
