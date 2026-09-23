/*
 * authorize-tenant-external-send.server.ts — THE ONLY WRITER of tenant external-send arming.
 *
 * ── WHAT ONE CALL HERE MEANS, AND THE FOUR THINGS IT DOES NOT ───────────────
 *
 *     ARMED != CONFIGURED != AUTHORIZED != EXECUTED
 *
 * Arming an organization mints no permit, authorizes no act, configures no deployment and sends
 * nothing. It records that a named human, holding this tenant's Governance authority, agreed that
 * this organization's authorized sends may leave the building at all. Every send afterwards still
 * needs its own permit and its own Governance decision.
 *
 * ── WHY THE TENANT IS NEVER AN ARGUMENT ─────────────────────────────────────
 *
 * The tenant is read off the authenticated `TenantContext` and from nowhere else. There is no
 * input field for it, so no caller — including a compromised surface — can arm an organization
 * other than the one whose session it is acting in. That is the containment invariant this whole
 * phase exists for, and it is enforced here by the ABSENCE of a parameter rather than by a check
 * that a future edit could forget.
 *
 * An in-app Director/admin path that arms a DIFFERENT tenant is deliberately NOT built. No such
 * trusted principal exists in Hebun — R5.1 established that in this exact feature area and removed
 * the last one — and inventing it here would recreate the cross-tenant authority this phase is
 * closing.
 *
 * ── WHY GOVERNANCE, AND NOT DEPLOYMENT POSSESSION ───────────────────────────
 *
 * The deployment ceremony that writes the ROOT control writes `updated_by = NULL`, because
 * possession is a SOURCE and not an ACTOR. That is acceptable for an emergency stop. It is not
 * acceptable for arming an organization to reach real people outside it: somebody must own that
 * decision, by name, forever. The `human_authorizer` CHECK enforces it in PostgreSQL, so an agent
 * cannot arm its own organization even if a future code path tried.
 *
 * Server-only.
 */
import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { tenantExternalSendAuthorizations } from "@/db/schema/tenant-external-send-authorization";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { recordGovernanceEventWithin } from "@/features/governance-audit/governance-decision-audit.server";
import {
  resolveGovernanceAuthority,
  type GovernanceAuthorityResolution,
} from "@/features/governance-decision/authority-read.server";
import { writeGovernanceDecisionWithin } from "@/features/governance-decision/decision-authority.server";
import { validateJustification } from "@/features/governance-decision/persistence.server";
import {
  TENANT_EXTERNAL_SEND_ARM_DECISION_TYPE,
  TENANT_EXTERNAL_SEND_DISARM_DECISION_TYPE,
  TENANT_EXTERNAL_SEND_SUBJECT_TYPE,
  type TenantExternalSendState,
  type TenantExternalSendWriteRefusal,
} from "./contracts";

const FIRST_AUTHORIZATION_REVISION = 1;

export interface TenantExternalSendWriteDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
}

export interface AuthorizeTenantExternalSendInput {
  readonly justification: string;
  /**
   * WHICH REVISION THE HUMAN WAS ACTUALLY SHOWN. `null` means "I believe this tenant holds no
   * arming". K4's lesson, which the machine sibling also carries: the unique index stops two
   * SIMULTANEOUS transactions but cannot see the slower human case — a screen read at revision 2
   * and submitted after somebody committed revision 3. Comparing what the human was shown catches
   * exactly that, in both directions.
   *
   * THERE IS NO `tenantId` FIELD HERE, AND THERE NEVER WILL BE. See the header.
   */
  readonly observedRevision: number | null;
}

export type TenantExternalSendWriteResult =
  | {
      readonly status: "written";
      readonly authorizationId: string;
      readonly authorizationRevision: number;
      readonly state: TenantExternalSendState;
      readonly governanceDecisionId: string;
      readonly governanceSessionId: string;
    }
  | { readonly status: "refused"; readonly reason: TenantExternalSendWriteRefusal };

class TenantExternalSendAbort extends Error {
  constructor(readonly reason: TenantExternalSendWriteRefusal) {
    super(reason);
  }
}

function refused(reason: TenantExternalSendWriteRefusal): TenantExternalSendWriteResult {
  return { status: "refused", reason };
}

function resolveDbOrNull(deps: TenantExternalSendWriteDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/** Arm THIS tenant — the one the session belongs to — for outbound external sending. */
export function armTenantExternalSend(
  tenant: TenantContext | null,
  input: AuthorizeTenantExternalSendInput,
  deps: TenantExternalSendWriteDeps = {},
): Promise<TenantExternalSendWriteResult> {
  return writeRevision(tenant, "active", input, deps);
}

/** Disarm it. A new revision, under its own decision; the one it replaces stays byte-identical. */
export function disarmTenantExternalSend(
  tenant: TenantContext | null,
  input: AuthorizeTenantExternalSendInput,
  deps: TenantExternalSendWriteDeps = {},
): Promise<TenantExternalSendWriteResult> {
  return writeRevision(tenant, "withdrawn", input, deps);
}

async function writeRevision(
  tenant: TenantContext | null,
  nextState: TenantExternalSendState,
  input: AuthorizeTenantExternalSendInput,
  deps: TenantExternalSendWriteDeps,
): Promise<TenantExternalSendWriteResult> {
  if (typeof window !== "undefined") {
    throw new Error("Tenant external-send arming is server-only.");
  }

  /* 1 · AN AUTHENTICATED HUMAN, OR NOTHING. The tenant is theirs; it is never an argument. */
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");
  const authenticated = tenant;

  const justification = validateJustification(input?.justification);
  if (!justification) return refused("justification-required");

  const db = resolveDbOrNull(deps);
  if (!db) return refused("persistence-unavailable");
  const now = (deps.now ?? (() => new Date()))();

  /* 2 · THE AUTHORITY, RESOLVED BEFORE THE TRANSACTION. */
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
    let outcome: TenantExternalSendWriteResult | null = null;

    await db.transaction(async (rawTx) => {
      const tx = rawTx as unknown as ControlPlaneDatabase;

      /* 3 · WHERE THIS TENANT'S LINEAGE STANDS — highest revision wins, as everywhere else. */
      const existing = await tx
        .select({
          id: tenantExternalSendAuthorizations.id,
          authorizationRevision: tenantExternalSendAuthorizations.authorizationRevision,
          state: tenantExternalSendAuthorizations.state,
        })
        .from(tenantExternalSendAuthorizations)
        /* The tenant predicate again, from the session. No other tenant's lineage is visible. */
        .where(eq(tenantExternalSendAuthorizations.tenantId, authenticated.tenantId))
        .orderBy(desc(tenantExternalSendAuthorizations.authorizationRevision))
        .limit(1);

      const effective = existing[0] ?? null;
      const currentRevision = effective?.authorizationRevision ?? null;

      /* 4 · THE HUMAN'S PRECONDITION. See `observedRevision`. */
      if (observedRevision !== currentRevision) {
        throw new TenantExternalSendAbort("stale-authorization-revision");
      }

      /*
       * 5 · WHAT THE TRANSITION MEANS FROM HERE.
       *
       * Disarming nothing is refused rather than recorded: a `withdrawn` revision with no active
       * predecessor would record a permission being taken away that nobody ever granted, and the
       * `first_revision_active` CHECK refuses the revision-1 form of it independently.
       *
       * Re-arming an already-armed tenant is refused too. It would be a second Governance decision
       * that changed nothing, and a ledger full of those stops being readable.
       */
      if (nextState === "withdrawn") {
        if (!effective || effective.state !== "active") {
          throw new TenantExternalSendAbort("no-active-arming");
        }
      } else if (effective && effective.state === "active") {
        throw new TenantExternalSendAbort("already-armed");
      }

      const authorizationRevision = (currentRevision ?? 0) + FIRST_AUTHORIZATION_REVISION;
      const supersedesAuthorizationId = effective?.id ?? null;

      /*
       * 6 · THE CIRCULAR REFERENCE, AND THE AUTHORIZED SOLUTION. The decision must name the
       * revision as its subject and the revision must name the decision as its provenance; both
       * columns are NOT NULL. I1 hit this exact shape and the Director authorized generating the
       * artifact's UUID in the application. R3A, AMA-1, TRH-23 and RUNG 2 reused it; so does this.
       * The row this id names is written in the same transaction or not at all.
       */
      const authorizationId = randomUUID();

      /* 7 · THE DECISION, BOUND TO THE REVISION — never to the lineage. */
      const decision = await writeGovernanceDecisionWithin(
        tx,
        authenticated,
        authority,
        {
          decisionType:
            nextState === "withdrawn"
              ? TENANT_EXTERNAL_SEND_DISARM_DECISION_TYPE
              : TENANT_EXTERNAL_SEND_ARM_DECISION_TYPE,
          subjectType: TENANT_EXTERNAL_SEND_SUBJECT_TYPE,
          subjectId: authorizationId,
          /* The SHAPE of what was decided. No credential, no recipient, no permit, no act. */
          evidence: {
            authorityVia: authority.via,
            authorityDelegationDecisionId: authority.delegationDecisionId,
            tenantExternalSendAuthorizationId: authorizationId,
            authorizationRevision,
            state: nextState,
            supersedesAuthorizationId,
          },
          justification,
        },
        now,
      );

      /* 8 · THE REVISION. Nothing that already exists is edited. */
      const inserted = await tx
        .insert(tenantExternalSendAuthorizations)
        .values({
          id: authorizationId,
          tenantId: authenticated.tenantId,
          authorizationRevision,
          state: nextState,
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
        .returning({ id: tenantExternalSendAuthorizations.id });

      const writtenId = inserted[0]?.id;
      if (!writtenId) throw new TenantExternalSendAbort("persistence-unavailable");

      /* 9 · The Governance event: a decision was made. */
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
                ? TENANT_EXTERNAL_SEND_DISARM_DECISION_TYPE
                : TENANT_EXTERNAL_SEND_ARM_DECISION_TYPE,
            subjectType: TENANT_EXTERNAL_SEND_SUBJECT_TYPE,
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
    if (error instanceof TenantExternalSendAbort) return refused(error.reason);
    return refused("persistence-unavailable");
  }
}
