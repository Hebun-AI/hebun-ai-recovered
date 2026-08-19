/*
 * governance-decision/bootstrap-authority.server.ts — the genesis of Governance authority (G2).
 *
 * ONE FUNCTION MATTERS HERE: `establishGovernanceAuthority` spends an ACCEPTED G2.1 entitlement to
 * create a tenant's first and only bootstrap decision.
 *
 * THE ORDER IS THE SECURITY PROPERTY, and it all happens in ONE transaction:
 *
 *   1. resolve the authenticated human            (server-side, from the durable session)
 *   2. resolve the ACCEPTED genesis entitlement   (same tenant, same identity AND same user)
 *   3. refuse if it is pending, revoked, or already consumed
 *   4. validate the human-authored justification
 *   5. create the governance session
 *   6. create the bootstrap decision              (bootstrap = true, actor_type = 'human')
 *   7. mark the entitlement consumed              (conditional — this is the race gate)
 *   8. append the audit event
 *   9. COMMIT
 *
 * If step 8 fails, nothing in 5-7 survives. "Governance established but unaudited" is excluded by
 * the transaction, not by hoping.
 *
 * NOTHING IS CLIENT-SUPPLIED EXCEPT THE JUSTIFICATION. Tenant, actor, identity, session, bootstrap
 * flag, decision type, domain, subject, timestamps and authority source are all resolved or fixed
 * server-side. A forged `tenantId`, `actorId`, `bootstrap`, `sessionId` or `decisionId` has no
 * parameter to arrive in.
 *
 * TWO DATABASE INVARIANTS ARE THE FINAL DEFENSE, not the reads above:
 *   `decision_records_one_bootstrap_per_tenant_uq`  — one genesis per tenant, ever;
 *   `decision_records_bootstrap_human_chk`          — a genesis actor is always human.
 *
 * WHAT THIS MODULE CANNOT DO: no update, no delete, no reversal, no delegation, no revocation, no
 * approval chain, no voting, no policy evaluation, and no Knowledge mutation. None of those
 * functions exist to be called.
 *
 * Server-only.
 */
import { and, eq, isNull } from "drizzle-orm";
import { genesisNominations } from "@/db/schema/genesis-nomination";
import { decisionRecords, governanceSessions } from "@/db/schema/governance";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  recordGovernanceEventWithin,
  recordGovernanceRefusal,
} from "@/features/governance-audit/governance-decision-audit.server";
import {
  BOOTSTRAP_DECISION_TYPE,
  BOOTSTRAP_GOVERNANCE_DOMAIN,
  BOOTSTRAP_OUTCOME,
  BOOTSTRAP_SUBJECT_TYPE,
  type BootstrapRefusal,
  type BootstrapResult,
} from "./contracts";
/*
 * MOVED, NOT COPIED. The infrastructure helpers this file used to host, and the authority READ it
 * used to define, now live in `persistence.server` and `authority-read.server`. Every caller was
 * migrated to import them there, so this module no longer re-exports them: what it exports is what
 * it is — the act that establishes a tenant's Governance.
 */
import { resolveGovernanceDbOrNull, validateJustification, type GovernanceDeps } from "./persistence.server";


function refused(reason: BootstrapRefusal): BootstrapResult {
  return { status: "refused", reason };
}

/**
 * Establish the tenant's first Governance authority by spending its accepted genesis entitlement.
 *
 * The ONLY client-shaped input is `justification`. Everything else comes from the session or is
 * fixed by the repository's own Governance vocabulary.
 */
export async function establishGovernanceAuthority(
  tenant: TenantContext | null,
  input: { readonly justification: string },
  deps: GovernanceDeps = {},
): Promise<BootstrapResult> {
  if (typeof window !== "undefined") {
    throw new Error("Governance bootstrap is server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId || !tenant.authIdentityId) {
    return refused("unauthenticated");
  }
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return refused("persistence-unavailable");
  const now = (deps.now ?? (() => new Date()))();

  const justification = validateJustification(input?.justification);
  if (!justification) return refused("justification-required");

  try {
    /* ── The entitlement gate. Read first so the REFUSAL can be truthful; the writes below
     * are still predicated, because a read is never the authority. ── */
    const nominations = await db
      .select()
      .from(genesisNominations)
      .where(eq(genesisNominations.tenantId, tenant.tenantId))
      .limit(1);
    const nomination = nominations[0];
    if (!nomination) return refused("no-entitlement");

    /* BOTH halves of the identity must be the session's own. A row whose identity and user named
     * different people could never be spent by anyone — it fails closed rather than becoming
     * exploitable. Checked BEFORE status, so a wrong human learns nothing about the entitlement's
     * lifecycle. */
    if (
      nomination.nominatedAuthIdentityId !== tenant.authIdentityId ||
      nomination.nominatedUserId !== tenant.userId
    ) {
      return refused("not-the-entitled-human");
    }
    if (nomination.status === "pending") return refused("entitlement-not-accepted");
    if (nomination.status === "revoked") return refused("entitlement-revoked");
    if (nomination.consumedAt !== null) {
      // An authorized human spending a spent entitlement: a governed refusal, and history.
      await recordAuthorizedRefusal(tenant, nomination.id, "entitlement-already-consumed", deps);
      return refused("entitlement-already-consumed");
    }

    const existing = await db
      .select({ id: decisionRecords.id })
      .from(decisionRecords)
      .where(
        and(eq(decisionRecords.tenantId, tenant.tenantId), eq(decisionRecords.bootstrap, true)),
      )
      .limit(1);
    if (existing.length > 0) {
      await recordAuthorizedRefusal(tenant, nomination.id, "already-bootstrapped", deps);
      return refused("already-bootstrapped");
    }

    let established: { decisionId: string; sessionId: string } | null = null;

    await db.transaction(async (tx) => {
      /* 5. THE SESSION — the bounded process the decision was made inside.
       *
       * `authoritySourceActor*` is left NULL, and that is the genesis stating the truth about
       * itself: there was no prior authority to decide under. Every LATER decision names one. */
      const sessionRows = await tx
        .insert(governanceSessions)
        .values({
          tenantId: tenant.tenantId,
          governanceDomain: BOOTSTRAP_GOVERNANCE_DOMAIN,
          decisionType: BOOTSTRAP_DECISION_TYPE,
          subjectType: BOOTSTRAP_SUBJECT_TYPE,
          subjectId: tenant.tenantId,
          proposerActorType: "human",
          proposerActorId: tenant.userId,
          riskClass: "critical",
          // No voting mode: there is no voting runtime, and claiming one would be a lie.
          governanceLifecycleStatus: "recorded",
          createdBy: tenant.userId,
          createdByType: "human",
        })
        .returning({ id: governanceSessions.id });
      const sessionId = sessionRows[0]!.id;

      /* 6. THE CONSTITUTIONAL EVENT. `decision_records_one_bootstrap_per_tenant_uq` refuses a
       * second one even if the read above raced; `..._bootstrap_human_chk` refuses a non-human. */
      const decisionRows = await tx
        .insert(decisionRecords)
        .values({
          tenantId: tenant.tenantId,
          sessionId,
          decisionType: BOOTSTRAP_DECISION_TYPE,
          subjectType: BOOTSTRAP_SUBJECT_TYPE,
          subjectId: tenant.tenantId,
          actorType: "human",
          actorId: tenant.userId,
          bootstrap: true,
          outcome: BOOTSTRAP_OUTCOME,
          justification,
          // Identity references and standing only — never credential or bearer material.
          evidence: {
            genesisNominationId: nomination.id,
            nominatedAuthIdentityId: nomination.nominatedAuthIdentityId,
            entitlementAcceptedAt: nomination.acceptedAt?.toISOString() ?? null,
            acceptanceAssuranceLevel: nomination.acceptedAssuranceLevel,
            nominationSource: nomination.nominationSource,
          },
          decidedAt: now,
          createdBy: tenant.userId,
          createdByType: "human",
        })
        .returning({ id: decisionRecords.id });
      const decisionId = decisionRows[0]!.id;

      /* 7. SPEND THE ENTITLEMENT. Predicated on it still being unconsumed, so a concurrent
       * transaction that got here first makes this update zero rows — and the abort below
       * unwinds the session and the decision with it. */
      const consumed = await tx
        .update(genesisNominations)
        .set({
          consumedAt: now,
          consumedByDecisionId: decisionId,
          updatedAt: now,
          updatedBy: tenant.userId,
          updatedByType: "human",
        })
        .where(
          and(
            eq(genesisNominations.id, nomination.id),
            eq(genesisNominations.tenantId, tenant.tenantId),
            eq(genesisNominations.status, "accepted"),
            isNull(genesisNominations.consumedAt),
          ),
        )
        .returning({ id: genesisNominations.id });

      if (consumed.length === 0) {
        // Somebody else spent it inside the window. Abort everything.
        throw new EntitlementRaceLost();
      }

      /* 8. HISTORY, IN THE SAME TRANSACTION. */
      await recordGovernanceEventWithin(
        tx,
        {
          tenantId: tenant.tenantId,
          userId: tenant.userId,
          requestId: tenant.requestId,
          sessionContextId: tenant.sessionContextId,
        },
        {
          action: "governance.bootstrap.established",
          outcome: "committed",
          entityId: decisionId,
          metadata: {
            governanceSessionId: sessionId,
            decisionType: BOOTSTRAP_DECISION_TYPE,
            subjectType: BOOTSTRAP_SUBJECT_TYPE,
            subjectId: tenant.tenantId,
            bootstrap: true,
            genesisNominationId: nomination.id,
          },
        },
        now,
      );

      established = { decisionId, sessionId };
    });

    if (!established) return refused("persistence-unavailable");
    const outcome = established as { decisionId: string; sessionId: string };
    return {
      status: "established",
      decisionId: outcome.decisionId,
      sessionId: outcome.sessionId,
      establishedAt: now.toISOString(),
    };
  } catch (error) {
    /* A lost race is a GOVERNED refusal, not a system failure — the constitution worked. Both the
     * application predicate (EntitlementRaceLost) and the database's own unique index (23505)
     * arrive here, and both mean the same thing. */
    if (error instanceof EntitlementRaceLost || isUniqueViolation(error)) {
      return refused("already-bootstrapped");
    }
    return refused("persistence-unavailable");
  }
}

/** Thrown inside the transaction to abort it when a concurrent bootstrap won. */
class EntitlementRaceLost extends Error {
  constructor() {
    super("the genesis entitlement was consumed by another transaction");
    this.name = "EntitlementRaceLost";
  }
}

/** Postgres unique_violation — the database refusing a second genesis. */
function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === "23505") return true;
  const cause = (error as { cause?: { code?: unknown } } | null)?.cause;
  return cause?.code === "23505";
}

/**
 * Record that an AUTHORIZED actor was refused by a governed rule. Outside any transaction, because
 * a refusal has none. Unauthenticated and unauthorized attempts are NOT recorded — see
 * `GOVERNANCE_AUDIT_BOUNDARY`.
 */
async function recordAuthorizedRefusal(
  tenant: TenantContext,
  nominationId: string,
  reason: BootstrapRefusal,
  deps: GovernanceDeps,
): Promise<void> {
  await recordGovernanceRefusal(
    {
      tenantId: tenant.tenantId,
      userId: tenant.userId,
      requestId: tenant.requestId,
      sessionContextId: tenant.sessionContextId,
    },
    {
      action: "governance.bootstrap.established",
      outcome: "rejected",
      // No decision exists to point at; the refusal is about the tenant's Governance itself.
      entityId: tenant.tenantId,
      metadata: {
        governanceSessionId: null,
        decisionType: BOOTSTRAP_DECISION_TYPE,
        subjectType: BOOTSTRAP_SUBJECT_TYPE,
        subjectId: tenant.tenantId,
        bootstrap: true,
        genesisNominationId: nominationId,
        refusalReason: reason,
      },
    },
    deps,
  );
}
