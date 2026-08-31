/*
 * governance-decision/decision-authority.server.ts — who may decide after genesis, and the
 * narrowest reusable decision writer (G2).
 *
 * THE AUTHORIZATION RULE, AND WHERE IT COMES FROM. A tenant's Governance authority is the human
 * named as `actor_id` on that tenant's `bootstrap = true` decision. That is derived from the
 * repository, not invented — see `POST_BOOTSTRAP_AUTHORITY_MODEL` in contracts.ts for the three
 * facts it rests on. It is resolved SERVER-SIDE from the durable session and the durable decision;
 * a role band, a permission row, and a membership scope are all deliberately not consulted, because
 * none of them was ever established by a Governance decision.
 *
 * RECORDING A DECISION CHANGES ONLY THE LEDGER. A `ratify` decision does NOT write
 * `knowledge_nodes.ratified_at`, `ratification_decision_id`, or `governance_session_id`. This module
 * does not import the Knowledge schema at all, so that binding is unavailable rather than merely
 * unwritten — it is the whole content of a later phase.
 *
 * NO REVERSAL. There is no update, no delete, and no "change the justification" here. Superseding a
 * decision is itself a Governance decision, and that runtime does not exist yet.
 *
 * Server-only.
 */
import { sql } from "drizzle-orm";
import { type ControlPlaneDatabase } from "@/db/client.server";
import { decisionRecords, governanceSessions } from "@/db/schema/governance";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { recordGovernanceEventWithin } from "@/features/governance-audit/governance-decision-audit.server";
import {
  GOVERNANCE_DECISION_TYPES,
  GOVERNANCE_SUBJECT_TYPES,
  SUBJECT_GOVERNANCE_DOMAIN,
  type DecisionRefusal,
  type DecisionResult,
  type GovernanceDecisionType,
  type GovernanceSubjectType,
} from "./contracts";
import {
  DELEGATION_OUTCOME,
  REVOCATION_OUTCOME,
  type AuthorityDecisionType,
  type AuthoritySubjectType,
} from "./delegation-contracts";
import {
  MEMBERSHIP_AUTHORIZATION_DECISION_TYPE,
  MEMBERSHIP_AUTHORIZATION_DOMAIN,
  MEMBERSHIP_AUTHORIZATION_OUTCOME,
  MEMBERSHIP_AUTHORIZATION_SUBJECT_TYPE,
} from "@/features/membership-authority/contracts";
import {
  ORGANIZATIONAL_ROLE_DOMAIN,
  ORGANIZATIONAL_ROLE_OUTCOME,
  ORGANIZATIONAL_ROLE_SUBJECT_TYPE,
} from "@/features/tenant-role-baseline/contracts";
import {
  IDENTITY_ENROLLMENT_APPROVED_OUTCOME,
  IDENTITY_ENROLLMENT_DOMAIN,
  IDENTITY_ENROLLMENT_REJECTED_OUTCOME,
  IDENTITY_ENROLLMENT_REJECT_TYPE,
  IDENTITY_ENROLLMENT_SUBJECT_TYPE,
} from "@/features/identity-enrollment/contracts";
import {
  ACTION_APPROVED_OUTCOME,
  ACTION_AUTHORIZATION_DOMAIN,
  ACTION_PERMIT_REVOKED_OUTCOME,
  ACTION_PERMIT_SUBJECT_TYPE,
  ACTION_REJECTED_OUTCOME,
  ACTION_REJECTION_DECISION_TYPE,
  ACTION_REQUEST_SUBJECT_TYPE,
} from "@/features/action-authorization/contracts";
import {
  IMPROVEMENT_HYPOTHESIS_ACCEPTED_OUTCOME,
  IMPROVEMENT_HYPOTHESIS_APPROVE_TYPE,
  IMPROVEMENT_HYPOTHESIS_DECLINED_OUTCOME,
  IMPROVEMENT_HYPOTHESIS_DOMAIN,
  IMPROVEMENT_HYPOTHESIS_SUBJECT_TYPE,
} from "@/features/agent-improvement-hypothesis/contracts";
import {
  AGENT_MANDATE_BOUNDED_OUTCOME,
  AGENT_MANDATE_DOMAIN,
  AGENT_MANDATE_SUBJECT_TYPE,
} from "@/features/agent-mandate/contracts";
import {
  resolveGovernanceDbOrNull,
  validateJustification,
  type GovernanceDeps,
} from "./persistence.server";
/*
 * MOVED, NOT COPIED. Authority resolution and the roster read now live in `authority-read.server`,
 * a module that cannot mutate anything. This file — which CAN — imports them like any other
 * consumer, so the dependency runs writer -> read and never the reverse.
 */
import {
  resolveGovernanceAuthority,
  type GovernanceAuthorityResolution,
} from "./authority-read.server";

function refused(reason: DecisionRefusal): DecisionResult {
  return { status: "refused", reason };
}

/**
 * Confirm the subject exists AND belongs to the caller's tenant.
 *
 * The subject vocabulary is closed to one entry, so this is a real existence check against a real
 * table rather than a shape test on a client string. A subject id belonging to another tenant
 * resolves to nothing — indistinguishable from one that never existed.
 *
 * The table name is NOT interpolated from input: it is chosen by a `switch` over a union type, so
 * there is no path by which a caller's value becomes part of a query.
 */
async function subjectExistsInTenant(
  db: SubjectReader,
  tenantId: string,
  subjectType: GovernanceSubjectType,
  subjectId: string,
): Promise<boolean> {
  switch (subjectType) {
    case "knowledge_node": {
      const rows = await db.execute(
        sql`select 1 from public.knowledge_nodes where id = ${subjectId}::uuid and tenant_id = ${tenantId}::uuid limit 1`,
      );
      return rows.rows.length > 0;
    }
    default:
      return false;
  }
}

/** Anything that can run the subject existence check — the database, or an open transaction. */
type SubjectReader = Pick<ControlPlaneDatabase, "execute">;

/** A drizzle handle that can write a decision: the database, or an open transaction on it. */
export type DecisionWriter = Pick<ControlPlaneDatabase, "insert" | "execute">;

/**
 * Write one Governance decision INSIDE a caller's transaction.
 *
 * This exists so a phase that must change something else atomically with the decision — K4 binding
 * a ratification to an exact Knowledge version — can join this transaction rather than opening a
 * second one. "Decision committed but the Knowledge binding failed" is not a state a second
 * transaction could have prevented.
 *
 * The caller supplies the transaction and the already-resolved authority; it cannot supply the
 * tenant, the actor, the bootstrap flag, or the timestamp.
 */
export async function writeGovernanceDecisionWithin(
  tx: DecisionWriter,
  tenant: TenantContext,
  authority: GovernanceAuthorityResolution,
  input: {
    readonly decisionType:
      | GovernanceDecisionType
      | AuthorityDecisionType
      | typeof MEMBERSHIP_AUTHORIZATION_DECISION_TYPE;
    readonly subjectType:
      | GovernanceSubjectType
      | AuthoritySubjectType
      | typeof MEMBERSHIP_AUTHORIZATION_SUBJECT_TYPE
      | typeof ORGANIZATIONAL_ROLE_SUBJECT_TYPE
      | typeof IDENTITY_ENROLLMENT_SUBJECT_TYPE
      | typeof ACTION_REQUEST_SUBJECT_TYPE
      | typeof ACTION_PERMIT_SUBJECT_TYPE
      | typeof IMPROVEMENT_HYPOTHESIS_SUBJECT_TYPE
      | typeof AGENT_MANDATE_SUBJECT_TYPE;
    readonly subjectId: string;
    readonly justification: string;
    readonly evidence?: Record<string, unknown>;
  },
  now: Date,
): Promise<{ readonly decisionId: string; readonly sessionId: string }> {
  /*
   * G3: an authority decision belongs to the `authority-delegation` domain — the domain the schema
   * declares owns who holds authority, and the same one the genesis session already uses.
   *
   * I1: admitting a human is NOT moving authority, so it gets its own domain rather than borrowing
   * that one. Ordinary subjects keep their own mapping.
   */
  const domain =
    input.subjectType === MEMBERSHIP_AUTHORIZATION_SUBJECT_TYPE
      ? MEMBERSHIP_AUTHORIZATION_DOMAIN
      : input.subjectType === ORGANIZATIONAL_ROLE_SUBJECT_TYPE
        ? ORGANIZATIONAL_ROLE_DOMAIN
        : /*
           * I1.2 — approving or refusing that a prospective human may become an authenticable Hebun
           * identity. Its own domain, because it is the only decision whose effect is global rather
           * than tenant-scoped: after it the human exists everywhere and belongs nowhere.
           */
          input.subjectType === IDENTITY_ENROLLMENT_SUBJECT_TYPE
          ? IDENTITY_ENROLLMENT_DOMAIN
          : /*
             * R3A — authorizing, refusing, or revoking ONE consequential act. Its own domain, and
             * the first about DOING rather than about who may do. `provider-tool` says a
             * capability exists rather than that one use of it is permitted; `authority-delegation`
             * would assert that authorizing an act moves Governance authority, which a permit
             * never does. Both the request and the permit subject map here, because approving an
             * action and revoking that approval belong to one ledger question.
             */
            input.subjectType === ACTION_REQUEST_SUBJECT_TYPE ||
              input.subjectType === ACTION_PERMIT_SUBJECT_TYPE
            ? ACTION_AUTHORIZATION_DOMAIN
            : /*
               * SIA-3 — deciding whether an evidence-backed hypothesis about an agent's SELECTION
               * BEHAVIOUR is worth pursuing. `learning` is an existing enum value with no prior
               * usage, and it is the honest fit: no authority moves (so not
               * `authority-delegation`), no agent is created or retired (so not
               * `agent-registration`), and nothing becomes executable (so not
               * `action-authorization`). A decision here authorizes an INVESTIGATION, never a
               * change — nothing in this repository can apply a hypothesis.
               */
              input.subjectType === IMPROVEMENT_HYPOTHESIS_SUBJECT_TYPE
              ? IMPROVEMENT_HYPOTHESIS_DOMAIN
              : /*
                 * AMA-1 — deciding the bounded organizational purpose one durable agent serves.
                 *
                 * Its own domain, and the enum's own comment records why `agent-registration` was
                 * refused despite existing unused since the foundation baseline: registration is
                 * an agent COMING INTO EXISTENCE, which `features/agent-identity` owns and this
                 * decision never performs. Not `action-authorization` — nothing becomes executable
                 * and no act is authorized. Not `authority-delegation` — a mandate grants nothing
                 * and moves no authority. Not `learning` — nothing is hypothesised or measured.
                 */
                input.subjectType === AGENT_MANDATE_SUBJECT_TYPE
                ? AGENT_MANDATE_DOMAIN
                : input.subjectType === "user" || input.subjectType === "governance_decision"
                  ? ("authority-delegation" as const)
                  : SUBJECT_GOVERNANCE_DOMAIN[input.subjectType];

  const outcome =
    /*
     * R3A IS CHECKED FIRST, AND THAT ORDER IS LOAD-BEARING. A permit revocation uses the same
     * `revoke` decision type G3 uses to end a delegation, so the generic `revoke` branch below
     * would label it `REVOCATION_OUTCOME` — "Governance authority was revoked". Ending one
     * action's authorization is not ending anyone's authority, and the ledger must not say it was.
     */
    input.subjectType === ACTION_REQUEST_SUBJECT_TYPE
      ? input.decisionType === ACTION_REJECTION_DECISION_TYPE
        ? ACTION_REJECTED_OUTCOME
        : ACTION_APPROVED_OUTCOME
      : input.subjectType === ACTION_PERMIT_SUBJECT_TYPE
        ? ACTION_PERMIT_REVOKED_OUTCOME
        : /*
           * SIA-3 IS CHECKED ON ITS SUBJECT, AND BEFORE EVERY GENERIC BRANCH — the same reason
           * R3A's comment above gives, and a sharper one.
           *
           * A hypothesis decision uses `approve`, which NO branch below matches: it is not
           * `delegate-authority`, not `revoke`, not the membership type and not `ratify`. It would
           * therefore have fallen through to the final `: "rejected"` and recorded an ACCEPTANCE
           * as a REJECTION in the permanent ledger. The subject check is what makes that
           * unreachable.
           *
           * The outcome words are `-accepted` / `-declined` rather than `approved`: what a human
           * accepted is a HYPOTHESIS, and a ledger row read years later must not suggest that an
           * improvement was made.
           */
          input.subjectType === IMPROVEMENT_HYPOTHESIS_SUBJECT_TYPE
          ? input.decisionType === IMPROVEMENT_HYPOTHESIS_APPROVE_TYPE
            ? IMPROVEMENT_HYPOTHESIS_ACCEPTED_OUTCOME
            : IMPROVEMENT_HYPOTHESIS_DECLINED_OUTCOME
          : /*
             * AMA-1 IS CHECKED ON ITS SUBJECT, AND BEFORE EVERY GENERIC BRANCH — for the sharper
             * of the two reasons SIA-3's comment gives.
             *
             * A mandate decision uses `approve`, which is ALSO
             * `MEMBERSHIP_AUTHORIZATION_DECISION_TYPE`. Without this branch a mandate decision
             * would fall into the membership branch below and record `membership-authorized` in
             * the permanent ledger — a decision about an agent's purpose, filed as a human being
             * admitted to the organization. Only the subject distinguishes them.
             */
            input.subjectType === AGENT_MANDATE_SUBJECT_TYPE
          ? AGENT_MANDATE_BOUNDED_OUTCOME
          : input.decisionType === "delegate-authority"
          ? DELEGATION_OUTCOME
          : input.decisionType === "revoke"
            ? REVOCATION_OUTCOME
            : /*
           * I1.2's subject is checked BEFORE the shared `approve` branch, because both I1 and I1.2
           * use `approve` and only the subject distinguishes what was approved. A refusal keeps the
           * same subject and flips to the reject outcome.
           */
          input.subjectType === IDENTITY_ENROLLMENT_SUBJECT_TYPE
          ? input.decisionType === IDENTITY_ENROLLMENT_REJECT_TYPE
            ? IDENTITY_ENROLLMENT_REJECTED_OUTCOME
            : IDENTITY_ENROLLMENT_APPROVED_OUTCOME
          : input.decisionType === MEMBERSHIP_AUTHORIZATION_DECISION_TYPE
            ? input.subjectType === ORGANIZATIONAL_ROLE_SUBJECT_TYPE
              ? ORGANIZATIONAL_ROLE_OUTCOME
              : MEMBERSHIP_AUTHORIZATION_OUTCOME
            : input.decisionType === "ratify"
              ? "ratified"
              : "rejected";

  const sessionRows = await tx
    .insert(governanceSessions)
    .values({
      tenantId: tenant.tenantId,
      governanceDomain: domain,
      decisionType: input.decisionType,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      proposerActorType: "human",
      proposerActorId: tenant.userId,
      riskClass: "medium",
      /* Unlike the genesis, an ordinary decision HAS a prior authority, and names it. */
      authoritySourceActorType: "human",
      authoritySourceActorId: authority.authorityActorId,
      governanceLifecycleStatus: "recorded",
      createdBy: tenant.userId,
      createdByType: "human",
    })
    .returning({ id: governanceSessions.id });
  const sessionId = sessionRows[0]!.id;

  const decisionRows = await tx
    .insert(decisionRecords)
    .values({
      tenantId: tenant.tenantId,
      sessionId,
      decisionType: input.decisionType,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      actorType: "human",
      actorId: tenant.userId,
      authoritySourceActorType: "human",
      authoritySourceActorId: authority.authorityActorId,
      // Never a genesis. The database CHECK and unique index guard this independently.
      bootstrap: false,
      outcome,
      justification: input.justification,
      evidence: {
        authorityFromBootstrapDecisionId: authority.bootstrapDecisionId,
        ...(input.evidence ?? {}),
      },
      decidedAt: now,
      createdBy: tenant.userId,
      createdByType: "human",
    })
    .returning({ id: decisionRecords.id });

  return { decisionId: decisionRows[0]!.id, sessionId };
}

/**
 * Record one ordinary Governance decision under an established authority.
 *
 * The client supplies exactly three things: the decision type (a closed union), the subject (a
 * closed type plus an id that must resolve inside its own tenant), and the human-authored
 * justification. It cannot supply the tenant, the actor, the authority source, the bootstrap flag,
 * the session, the timestamp, or the outcome.
 *
 * The decision, its session and its audit row commit together.
 */
export async function recordGovernanceDecision(
  tenant: TenantContext | null,
  input: {
    readonly decisionType: string;
    readonly subjectType: string;
    readonly subjectId: string;
    readonly justification: string;
  },
  deps: GovernanceDeps = {},
): Promise<DecisionResult> {
  if (typeof window !== "undefined") {
    throw new Error("Governance decisions are server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return refused("persistence-unavailable");
  const now = (deps.now ?? (() => new Date()))();

  if (!GOVERNANCE_DECISION_TYPES.includes(input?.decisionType as GovernanceDecisionType)) {
    return refused("invalid-decision-type");
  }
  if (!GOVERNANCE_SUBJECT_TYPES.includes(input?.subjectType as GovernanceSubjectType)) {
    return refused("subject-unresolvable");
  }
  const decisionType = input.decisionType as GovernanceDecisionType;
  const subjectType = input.subjectType as GovernanceSubjectType;

  const justification = validateJustification(input?.justification);
  if (!justification) return refused("justification-required");

  const authority = await resolveGovernanceAuthority(tenant, deps);
  if (!authority.bootstrapDecisionId) return refused("no-governance-authority");
  if (!authority.authorized) return refused("not-the-governance-authority");

  try {
    if (!(await subjectExistsInTenant(db, tenant.tenantId, subjectType, input.subjectId))) {
      return refused("subject-unresolvable");
    }

    let recorded: { decisionId: string; sessionId: string } | null = null;

    await db.transaction(async (tx) => {
      const { decisionId, sessionId } = await writeGovernanceDecisionWithin(
        tx,
        tenant,
        authority,
        { decisionType, subjectType, subjectId: input.subjectId, justification },
        now,
      );

      await recordGovernanceEventWithin(
        tx,
        {
          tenantId: tenant.tenantId,
          userId: tenant.userId,
          requestId: tenant.requestId,
          sessionContextId: tenant.sessionContextId,
        },
        {
          action: "governance.decision.recorded",
          outcome: "committed",
          entityId: decisionId,
          metadata: {
            governanceSessionId: sessionId,
            decisionType,
            subjectType,
            subjectId: input.subjectId,
            bootstrap: false,
          },
        },
        now,
      );

      recorded = { decisionId, sessionId };
    });

    if (!recorded) return refused("persistence-unavailable");
    const outcome = recorded as { decisionId: string; sessionId: string };
    return {
      status: "recorded",
      decisionId: outcome.decisionId,
      sessionId: outcome.sessionId,
      decidedAt: now.toISOString(),
    };
  } catch {
    return refused("persistence-unavailable");
  }
}
