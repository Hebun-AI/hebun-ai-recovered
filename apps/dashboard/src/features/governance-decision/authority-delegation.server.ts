/*
 * governance-decision/authority-delegation.server.ts — delegating and revoking Governance
 * authority (G3).
 *
 * THE MUTEX, AND WHY IT IS NOT A NEW TABLE. Authority is a QUERY over immutable Governance
 * decisions, so there is no "active authority" row to lock. Instead every authority mutation takes
 * `SELECT … FOR UPDATE` on the tenant's BOOTSTRAP DECISION row — a row that is guaranteed to exist
 * and to be unique by G2's `decision_records_one_bootstrap_per_tenant_uq`. That serializes all
 * delegation and revocation in a tenant against a row that already exists, so:
 *
 *   - two concurrent delegations of the same human cannot both commit;
 *   - a delegation and a revocation cannot interleave into an ambiguous state;
 *   - an actor whose authority is being revoked cannot slip a new delegation past the check.
 *
 * No second source of truth was created, and no migration was needed.
 *
 * THE POLICY IS THE DIRECTOR'S, NOT THIS FILE'S (Gate A: A1-c / A2-a / A3-a):
 *
 *   - the BOOTSTRAP human may revoke ANY delegation in their tenant;
 *   - a DELEGATE may revoke ONLY delegations they personally granted — peers cannot depose peers;
 *   - BOOTSTRAP authority is neither revocable nor transferable here, so a tenant can never reach
 *     zero Governance authorities.
 *
 * See `AUTHORITY_REVOCATION_POLICY`, which a test asserts against.
 *
 * WHAT THIS MODULE CANNOT DO: it never updates or deletes a decision, never revokes authentication,
 * membership, or a role, never touches Knowledge, providers, or execution, and has no path to end
 * the genesis. Those are absent, not guarded.
 *
 * Server-only.
 */
import { sql } from "drizzle-orm";
import { type ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { recordGovernanceEventWithin } from "@/features/governance-audit/governance-decision-audit.server";
import { writeGovernanceDecisionWithin } from "./decision-authority.server";
import { resolveGovernanceAuthority, type GovernanceAuthorityResolution } from "./authority-read.server";
import { resolveGovernanceDbOrNull, validateJustification, type GovernanceDeps } from "./persistence.server";
import {
  type DelegationRefusal,
  type DelegationResult,
  type RevocationRefusal,
  type RevocationResult,
} from "./delegation-contracts";

/** Aborts the transaction when a governed rule refuses mid-flight. */
class AuthorityAbort extends Error {
  constructor(readonly refusal: DelegationRefusal | RevocationRefusal) {
    super(refusal);
    this.name = "AuthorityAbort";
  }
}

/**
 * Take the tenant's Governance mutex and return the bootstrap decision.
 *
 * Everything after this call in the same transaction is serialized per tenant, so the reads below
 * are the reads the write will be committed against — not a snapshot somebody else can invalidate.
 */
async function lockTenantGovernance(
  tx: ControlPlaneDatabase,
  tenantId: string,
): Promise<{ bootstrapDecisionId: string; bootstrapActorId: string }> {
  const rows = await tx.execute(sql`
    select id, actor_id
      from public.decision_records
     where tenant_id = ${tenantId}::uuid and bootstrap = true
     for update
  `);
  const row = rows.rows[0] as { id: string; actor_id: string } | undefined;
  if (!row) throw new AuthorityAbort("no-governance-authority");
  return { bootstrapDecisionId: row.id, bootstrapActorId: row.actor_id };
}

/** Re-resolve the caller's authority INSIDE the mutex. The pre-flight read is never the authority. */
async function requireAuthorityWithinLock(
  tx: ControlPlaneDatabase,
  tenant: TenantContext,
  bootstrapActorId: string,
): Promise<{ via: "bootstrap" | "delegated"; delegationDecisionId: string | null }> {
  if (tenant.userId === bootstrapActorId) return { via: "bootstrap", delegationDecisionId: null };
  const rows = await tx.execute(sql`
    select d.id
      from public.decision_records d
     where d.tenant_id = ${tenant.tenantId}::uuid
       and d.decision_type = 'delegate-authority'
       and d.subject_type = 'user'
       and d.subject_id = ${tenant.userId}::uuid
       and not exists (
             select 1 from public.decision_records r
              where r.tenant_id = d.tenant_id
                and r.decision_type = 'revoke'
                and r.subject_type = 'governance_decision'
                and r.subject_id = d.id
           )
     limit 1
  `);
  const row = rows.rows[0] as { id: string } | undefined;
  if (!row) throw new AuthorityAbort("not-a-governance-authority");
  return { via: "delegated", delegationDecisionId: row.id };
}

/**
 * Delegate Governance authority to another verified human in the same tenant.
 *
 * The client names the receiving human and writes a justification. It cannot supply the tenant, its
 * own identity, the decision type, the authority source, the session, or the timestamp.
 */
export async function delegateGovernanceAuthority(
  tenant: TenantContext | null,
  input: { readonly toUserId: string; readonly justification: string },
  deps: GovernanceDeps = {},
): Promise<DelegationResult> {
  if (typeof window !== "undefined") {
    throw new Error("Governance delegation is server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) {
    return { status: "refused", reason: "unauthenticated" };
  }
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "refused", reason: "persistence-unavailable" };
  const now = (deps.now ?? (() => new Date()))();

  const justification = validateJustification(input?.justification);
  if (!justification) return { status: "refused", reason: "justification-required" };

  const toUserId = typeof input?.toUserId === "string" ? input.toUserId.trim() : "";
  if (!toUserId) return { status: "refused", reason: "target-unresolvable" };
  // Delegating to yourself grants nothing you do not already hold.
  if (toUserId === tenant.userId) return { status: "refused", reason: "self-delegation" };

  try {
    let outcome: DelegationResult | null = null;

    await db.transaction(async (tx) => {
      const handle = tx as unknown as ControlPlaneDatabase;
      const { bootstrapDecisionId, bootstrapActorId } = await lockTenantGovernance(
        handle,
        tenant.tenantId,
      );
      const granting = await requireAuthorityWithinLock(handle, tenant, bootstrapActorId);

      /*
       * THE TARGET MUST BE A REAL, ACTIVE, VERIFIED HUMAN MEMBER OF THIS TENANT. Membership is what
       * makes the human addressable in this tenant at all; a `users` row alone is not enough, and a
       * member of ANOTHER tenant resolves to nothing here — which is how tenant isolation is
       * enforced for the target as well as for the caller.
       */
      const targetRows = await handle.execute(sql`
        select u.id
          from public.users u
          join public.memberships m
            on m.user_id = u.id
           and m.tenant_id = ${tenant.tenantId}::uuid
          join public.auth_identities i
            on i.user_id = u.id
           and i.status = 'active'
           and i.lifecycle_status = 'active'
           and i.revoked_at is null
         where u.id = ${toUserId}::uuid
           and u.lifecycle_status = 'active'
           and m.status = 'active'
           and m.revoked_at is null
           and m.lifecycle_status = 'active'
         limit 1
      `);
      if (targetRows.rows.length === 0) throw new AuthorityAbort("target-unresolvable");

      // A3-a / duplicate: the genesis human already holds permanent authority.
      if (toUserId === bootstrapActorId) throw new AuthorityAbort("already-authorized");

      const existing = await handle.execute(sql`
        select d.id
          from public.decision_records d
         where d.tenant_id = ${tenant.tenantId}::uuid
           and d.decision_type = 'delegate-authority'
           and d.subject_type = 'user'
           and d.subject_id = ${toUserId}::uuid
           and not exists (
                 select 1 from public.decision_records r
                  where r.tenant_id = d.tenant_id
                    and r.decision_type = 'revoke'
                    and r.subject_type = 'governance_decision'
                    and r.subject_id = d.id
               )
         limit 1
      `);
      if (existing.rows.length > 0) throw new AuthorityAbort("already-authorized");

      const authority: GovernanceAuthorityResolution = {
        authorized: true,
        bootstrapDecisionId,
        authorityActorId: bootstrapActorId,
        via: granting.via,
        delegationDecisionId: granting.delegationDecisionId,
        grantedByActorId: null,
      };

      const decision = await writeGovernanceDecisionWithin(
        handle,
        tenant,
        authority,
        {
          decisionType: "delegate-authority",
          subjectType: "user",
          subjectId: toUserId,
          justification,
          evidence: {
            // How the GRANTOR held authority when they granted this. One step of the chain,
            // recorded on the decision so provenance never has to be guessed later.
            grantorAuthorityVia: granting.via,
            grantorDelegationDecisionId: granting.delegationDecisionId,
            bootstrapDecisionId,
          },
        },
        now,
      );

      await recordGovernanceEventWithin(
        handle,
        {
          tenantId: tenant.tenantId,
          userId: tenant.userId,
          requestId: tenant.requestId,
          sessionContextId: tenant.sessionContextId,
        },
        {
          action: "governance.authority.delegated",
          outcome: "committed",
          entityId: decision.decisionId,
          metadata: {
            governanceSessionId: decision.sessionId,
            decisionType: "delegate-authority",
            subjectType: "user",
            subjectId: toUserId,
            bootstrap: false,
          },
        },
        now,
      );

      outcome = {
        status: "delegated",
        decisionId: decision.decisionId,
        governanceSessionId: decision.sessionId,
        grantedToUserId: toUserId,
        delegatedAt: now.toISOString(),
      };
    });

    return outcome ?? { status: "refused", reason: "persistence-unavailable" };
  } catch (error) {
    if (error instanceof AuthorityAbort) {
      return { status: "refused", reason: error.refusal as DelegationRefusal };
    }
    return { status: "refused", reason: "persistence-unavailable" };
  }
}

/**
 * Revoke a delegated Governance authority.
 *
 * The subject is the DELEGATION DECISION, not the human: a human may hold several grants over time,
 * and "revoke the person" would be ambiguous about which one ended. The delegation row is never
 * touched — the revocation is a new decision, and the pair reads as "delegated at T1, revoked at T2".
 *
 * A2-a IS STRUCTURAL, NOT A CHECK. A revocation can only name a `delegate-authority` decision. The
 * genesis is a `certify` decision with `bootstrap = true`, so it cannot be named — the refusal
 * below exists to say so truthfully rather than to be the thing that prevents it.
 */
export async function revokeGovernanceAuthority(
  tenant: TenantContext | null,
  input: { readonly delegationDecisionId: string; readonly justification: string },
  deps: GovernanceDeps = {},
): Promise<RevocationResult> {
  if (typeof window !== "undefined") {
    throw new Error("Governance revocation is server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) {
    return { status: "refused", reason: "unauthenticated" };
  }
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "refused", reason: "persistence-unavailable" };
  const now = (deps.now ?? (() => new Date()))();

  const justification = validateJustification(input?.justification);
  if (!justification) return { status: "refused", reason: "justification-required" };

  const delegationId =
    typeof input?.delegationDecisionId === "string" ? input.delegationDecisionId.trim() : "";
  if (!delegationId) return { status: "refused", reason: "delegation-unresolvable" };

  try {
    let outcome: RevocationResult | null = null;

    await db.transaction(async (tx) => {
      const handle = tx as unknown as ControlPlaneDatabase;
      const { bootstrapDecisionId, bootstrapActorId } = await lockTenantGovernance(
        handle,
        tenant.tenantId,
      );
      const revoking = await requireAuthorityWithinLock(handle, tenant, bootstrapActorId);

      const targetRows = await handle.execute(sql`
        select d.id, d.actor_id, d.subject_id, d.bootstrap, d.decision_type
          from public.decision_records d
         where d.id = ${delegationId}::uuid
           and d.tenant_id = ${tenant.tenantId}::uuid
         limit 1
      `);
      const target = targetRows.rows[0] as
        | { id: string; actor_id: string; subject_id: string; bootstrap: boolean; decision_type: string }
        | undefined;
      // A wrong tenant, a missing decision, and a decision belonging to somebody else are all the
      // same answer — indistinguishable from one that never existed.
      if (!target) throw new AuthorityAbort("delegation-unresolvable");

      // A2-a, stated truthfully. The genesis is not a delegation and G3 implements no way to end it.
      if (target.bootstrap) throw new AuthorityAbort("bootstrap-not-revocable");
      if (target.decision_type !== "delegate-authority") {
        throw new AuthorityAbort("delegation-unresolvable");
      }

      /*
       * A1-c. The bootstrap human may revoke ANY delegation in their tenant; a delegate may revoke
       * only what they personally granted. Peers cannot depose peers.
       */
      if (revoking.via !== "bootstrap" && target.actor_id !== tenant.userId) {
        throw new AuthorityAbort("not-the-grantor");
      }

      const alreadyRevoked = await handle.execute(sql`
        select 1 from public.decision_records r
         where r.tenant_id = ${tenant.tenantId}::uuid
           and r.decision_type = 'revoke'
           and r.subject_type = 'governance_decision'
           and r.subject_id = ${delegationId}::uuid
         limit 1
      `);
      if (alreadyRevoked.rows.length > 0) throw new AuthorityAbort("already-revoked");

      const authority: GovernanceAuthorityResolution = {
        authorized: true,
        bootstrapDecisionId,
        authorityActorId: bootstrapActorId,
        via: revoking.via,
        delegationDecisionId: revoking.delegationDecisionId,
        grantedByActorId: null,
      };

      const decision = await writeGovernanceDecisionWithin(
        handle,
        tenant,
        authority,
        {
          decisionType: "revoke",
          subjectType: "governance_decision",
          subjectId: delegationId,
          justification,
          evidence: {
            revokedDelegationId: delegationId,
            revokedAuthorityOfUserId: target.subject_id,
            grantedByActorId: target.actor_id,
            revokerAuthorityVia: revoking.via,
          },
        },
        now,
      );

      await recordGovernanceEventWithin(
        handle,
        {
          tenantId: tenant.tenantId,
          userId: tenant.userId,
          requestId: tenant.requestId,
          sessionContextId: tenant.sessionContextId,
        },
        {
          action: "governance.authority.revoked",
          outcome: "committed",
          entityId: decision.decisionId,
          metadata: {
            governanceSessionId: decision.sessionId,
            decisionType: "revoke",
            subjectType: "governance_decision",
            subjectId: delegationId,
            bootstrap: false,
          },
        },
        now,
      );

      outcome = {
        status: "revoked",
        decisionId: decision.decisionId,
        governanceSessionId: decision.sessionId,
        revokedDelegationId: delegationId,
        revokedAt: now.toISOString(),
      };
    });

    return outcome ?? { status: "refused", reason: "persistence-unavailable" };
  } catch (error) {
    if (error instanceof AuthorityAbort) {
      return { status: "refused", reason: error.refusal as RevocationRefusal };
    }
    return { status: "refused", reason: "persistence-unavailable" };
  }
}

/**
 * The humans in this tenant who could receive Governance authority: active, verified members who
 * do not already hold it.
 *
 * ONLY A CURRENT AUTHORITY MAY READ THIS. It names tenant members, and a delegating authority
 * legitimately needs to know who they are granting to — but nobody else does, so an unauthorized
 * caller gets an empty list rather than a directory. Tenant-scoped by predicate.
 */
export async function readDelegationCandidates(
  tenant: TenantContext | null,
  deps: GovernanceDeps = {},
): Promise<readonly { readonly userId: string; readonly label: string }[]> {
  if (typeof window !== "undefined") {
    throw new Error("Delegation candidate reads are server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) return [];
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return [];

  const authority = await resolveGovernanceAuthority(tenant, deps);
  if (!authority.authorized) return [];

  try {
    const rows = await db.execute(sql`
      select u.id as user_id, coalesce(u.display_name, u.name, u.email) as label
        from public.users u
        join public.memberships m
          on m.user_id = u.id
         and m.tenant_id = ${tenant.tenantId}::uuid
        join public.auth_identities i
          on i.user_id = u.id
         and i.status = 'active'
         and i.lifecycle_status = 'active'
         and i.revoked_at is null
       where u.lifecycle_status = 'active'
         and m.status = 'active'
         and m.revoked_at is null
         and m.lifecycle_status = 'active'
         and u.id <> ${authority.authorityActorId}::uuid
         and not exists (
               select 1 from public.decision_records d
                where d.tenant_id = ${tenant.tenantId}::uuid
                  and d.decision_type = 'delegate-authority'
                  and d.subject_type = 'user'
                  and d.subject_id = u.id
                  and not exists (
                        select 1 from public.decision_records r
                         where r.tenant_id = d.tenant_id
                           and r.decision_type = 'revoke'
                           and r.subject_type = 'governance_decision'
                           and r.subject_id = d.id
                      )
             )
       order by label
       limit 50
    `);
    return (rows.rows as unknown as { user_id: string; label: string }[]).map((row) => ({
      userId: row.user_id,
      label: row.label,
    }));
  } catch {
    return [];
  }
}

/** Re-exported so callers need not reach into the resolver module for a pre-flight check. */
export { resolveGovernanceAuthority };
