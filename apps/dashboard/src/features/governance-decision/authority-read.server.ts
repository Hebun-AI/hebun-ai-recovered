/*
 * governance-decision/authority-read.server.ts — the canonical READ of Governance authority.
 *
 * ── ONE RESOLVER, AND IT LIVES HERE NOW ──────────────────────────────────────
 *
 * `resolveGovernanceAuthority` is still the single answer to "does this human hold Governance
 * authority in this tenant?". It was not copied, split, or reimplemented — it MOVED, verbatim, out
 * of a module that also exports `recordGovernanceDecision` and `writeGovernanceDecisionWithin`.
 * Exactly one definition of it exists in the repository, and a released census asserts that.
 *
 * ── WHY THE MOVE ─────────────────────────────────────────────────────────────
 *
 * A consumer that only needs to READ Governance had no way to do so without importing a module
 * that could WRITE it. That made the boundary unprovable: every firewall protecting "Heby may
 * explain Governance but never exercise it" had to be expressed as a ban on module NAMES, which is
 * both too coarse (it flags a comment) and too weak (it missed R3W importing the writer-bearing
 * module for a database handle).
 *
 * With the reads here, the property becomes mechanical: no module reachable from Heby's grounding
 * path exports a Governance writer. That is checked by walking the import graph, not by matching a
 * filename.
 *
 * ── DEPENDENCY DIRECTION ─────────────────────────────────────────────────────
 *
 * infrastructure  ←  reads (this file)  ←  writers  ←  server actions
 *
 * Writers import these reads — `recordGovernanceDecision` still resolves authority through
 * `resolveGovernanceAuthority`, and `provisionMemberRole` still does too. Nothing inverted, and no
 * writer is reachable from here: this module imports no writer, opens no transaction, and contains
 * no INSERT, UPDATE or DELETE.
 *
 * ── WHAT THIS IS NOT ─────────────────────────────────────────────────────────
 *
 * It is not a new authority, not a second source of truth, and not a projection layer. It is the
 * same code, in a file that cannot mutate anything, so that reading Governance no longer requires
 * holding a reference to the act that creates one.
 *
 * Server-only.
 */
import { and, eq, sql } from "drizzle-orm";
import { decisionRecords } from "@/db/schema/governance";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import type { GovernanceAuthorityLookup, GovernanceDecisionView } from "./contracts";
import type { AuthorityProvenance, AuthorityRosterLookup } from "./delegation-contracts";
import { resolveGovernanceDbOrNull, type GovernanceDeps } from "./persistence.server";

export interface GovernanceAuthorityResolution {
  readonly authorized: boolean;
  /** The bootstrap decision id the authority flows from, or null when none exists. */
  readonly bootstrapDecisionId: string | null;
  /** The human the bootstrap established, or null. Never surfaced to another tenant. */
  readonly authorityActorId: string | null;
  /* ── G3 provenance ── */
  /** How the CALLER holds authority. `none` when they do not. */
  readonly via: "none" | "bootstrap" | "delegated";
  /** The delegation decision the caller's authority came from. Null for the genesis human. */
  readonly delegationDecisionId: string | null;
  /** Who granted the caller's authority. Null for the genesis human — nobody granted the first. */
  readonly grantedByActorId: string | null;
}

const NO_AUTHORITY: GovernanceAuthorityResolution = {
  authorized: false,
  bootstrapDecisionId: null,
  authorityActorId: null,
  via: "none",
  delegationDecisionId: null,
  grantedByActorId: null,
};

/**
 * SQL for "the active delegations of a tenant", as one expression used by every reader.
 *
 * A delegation is ACTIVE when a committed `delegate-authority` decision exists and no committed
 * `revoke` decision names it. That `not exists` is the entire revocation mechanism: revoking never
 * touches the delegation row, so history stays exactly as written and "authority ended" is itself a
 * durable decision rather than a deletion.
 */
function activeDelegationsSql(tenantId: string) {
  return sql`
    select d.id            as delegation_id,
           d.subject_id    as grantee_user_id,
           d.actor_id      as grantor_user_id,
           d.decided_at    as since,
           d.justification as justification,
           d.authority_source_actor_id as grantor_authority_actor_id
      from public.decision_records d
     where d.tenant_id = ${tenantId}::uuid
       and d.decision_type = 'delegate-authority'
       and d.subject_type = 'user'
       and d.actor_type = 'human'
       and not exists (
             select 1 from public.decision_records r
              where r.tenant_id = d.tenant_id
                and r.decision_type = 'revoke'
                and r.subject_type = 'governance_decision'
                and r.subject_id = d.id
           )
  `;
}

interface ActiveDelegationRow {
  delegation_id: string;
  grantee_user_id: string;
  grantor_user_id: string;
  since: Date;
  justification: string;
  grantor_authority_actor_id: string | null;
}

/**
 * Resolve whether the authenticated human holds this tenant's Governance authority.
 *
 * TWO WAYS IN, AND ONLY TWO (G3). The caller is authorized when they are the actor on the tenant's
 * bootstrap decision, or when an ACTIVE delegation names them. A revoked delegation resolves as not
 * authorized — the `not exists` above is what makes that true, and it cannot be raced past because
 * every authority mutation serializes on the bootstrap row (see `authority-delegation.server.ts`).
 *
 * Read-only, tenant-scoped, and fail-closed. What is deliberately NOT consulted: `roles.type`,
 * `roles.authority_rank`, `memberships.authority_scope`, `permissions`, `role_permissions`, provider
 * state, and anything the client supplied. None of them was ever established by a Governance
 * decision, so none of them can grant Governance authority.
 */

function toView(row: typeof decisionRecords.$inferSelect): GovernanceDecisionView {
  return {
    decisionId: row.id,
    sessionId: row.sessionId,
    decisionType: row.decisionType,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    actorType: row.actorType,
    actorId: row.actorId,
    bootstrap: row.bootstrap,
    outcome: row.outcome,
    justification: row.justification,
    decidedAt: row.decidedAt.toISOString(),
  };
}

/**
 * Read this tenant's Governance authority: the bootstrap decision, if it exists, and whether the
 * VIEWER is the human it established.
 *
 * Tenant-scoped by predicate. The viewer flag is computed from the session's own user id, so the
 * surface learns whether it is them — never who the other person is.
 */
export async function readGovernanceAuthority(
  tenant: TenantContext | null,
  deps: GovernanceDeps = {},
): Promise<GovernanceAuthorityLookup> {
  if (typeof window !== "undefined") {
    throw new Error("Governance authority reads are server-only.");
  }
  if (!tenant?.tenantId) return { status: "unavailable", reason: "no-authorized-tenant-context" };
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-unavailable" };

  try {
    const rows = await db
      .select()
      .from(decisionRecords)
      .where(
        and(eq(decisionRecords.tenantId, tenant.tenantId), eq(decisionRecords.bootstrap, true)),
      )
      .limit(1);
    const row = rows[0];
    return {
      status: "read",
      authority: {
        bootstrap: row ? toView(row) : null,
        viewerIsGovernanceAuthority: Boolean(
          row && row.actorType === "human" && row.actorId === tenant.userId,
        ),
      },
    };
  } catch {
    return { status: "unavailable", reason: "persistence-unavailable" };
  }
}

export async function resolveGovernanceAuthority(
  tenant: TenantContext | null,
  deps: GovernanceDeps = {},
): Promise<GovernanceAuthorityResolution> {
  if (!tenant?.tenantId || !tenant.userId) return NO_AUTHORITY;
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return NO_AUTHORITY;

  try {
    const rows = await db
      .select({
        id: decisionRecords.id,
        actorType: decisionRecords.actorType,
        actorId: decisionRecords.actorId,
      })
      .from(decisionRecords)
      .where(
        and(eq(decisionRecords.tenantId, tenant.tenantId), eq(decisionRecords.bootstrap, true)),
      )
      .limit(1);
    const bootstrap = rows[0];
    // No genesis means no Governance in this tenant at all — a delegation could not exist either,
    // because only an authority can grant one.
    if (!bootstrap) return NO_AUTHORITY;

    const base = {
      bootstrapDecisionId: bootstrap.id,
      authorityActorId: bootstrap.actorId,
    };

    if (bootstrap.actorType === "human" && bootstrap.actorId === tenant.userId) {
      return {
        ...base,
        authorized: true,
        via: "bootstrap",
        delegationDecisionId: null,
        grantedByActorId: null,
      };
    }

    const delegations = await db.execute(activeDelegationsSql(tenant.tenantId));
    const mine = (delegations.rows as unknown as ActiveDelegationRow[]).find(
      (row) => row.grantee_user_id === tenant.userId,
    );
    if (!mine) {
      return { ...base, authorized: false, via: "none", delegationDecisionId: null, grantedByActorId: null };
    }
    return {
      ...base,
      authorized: true,
      via: "delegated",
      delegationDecisionId: mine.delegation_id,
      grantedByActorId: mine.grantor_user_id,
    };
  } catch {
    return NO_AUTHORITY;
  }
}

/**
 * The tenant's full authority roster, with provenance, for reads and for the surface.
 *
 * Tenant-scoped by predicate. Under A3-a the active list always contains at least the genesis
 * human, because bootstrap authority is not revocable — a test asserts that.
 */
export async function readAuthorityRoster(
  tenant: TenantContext | null,
  deps: GovernanceDeps = {},
): Promise<AuthorityRosterLookup> {
  if (typeof window !== "undefined") {
    throw new Error("Governance authority reads are server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) {
    return { status: "unavailable", reason: "no-authorized-tenant-context" };
  }
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-unavailable" };

  try {
    const bootstrapRows = await db
      .select()
      .from(decisionRecords)
      .where(
        and(eq(decisionRecords.tenantId, tenant.tenantId), eq(decisionRecords.bootstrap, true)),
      )
      .limit(1);
    const bootstrap = bootstrapRows[0];
    if (!bootstrap) {
      return {
        status: "read",
        roster: { active: [], revoked: [], viewerIsAuthority: false, viewerIsBootstrapAuthority: false },
      };
    }

    const active: AuthorityProvenance[] = [
      {
        kind: "bootstrap",
        actorId: bootstrap.actorId,
        decisionId: bootstrap.id,
        grantedByActorId: null,
        grantorAuthorityDecisionId: null,
        since: bootstrap.decidedAt.toISOString(),
        justification: bootstrap.justification,
      },
    ];

    const delegations = await db.execute(activeDelegationsSql(tenant.tenantId));
    for (const row of delegations.rows as unknown as ActiveDelegationRow[]) {
      active.push({
        kind: "delegated",
        actorId: row.grantee_user_id,
        decisionId: row.delegation_id,
        grantedByActorId: row.grantor_user_id,
        grantorAuthorityDecisionId: row.grantor_authority_actor_id,
        since: new Date(row.since).toISOString(),
        justification: row.justification,
      });
    }

    /* Revoked delegations. History is never deleted, so this is a join, not a tombstone table. */
    const revokedRows = await db.execute(sql`
      select d.id            as delegation_id,
             d.subject_id    as grantee_user_id,
             d.actor_id      as grantor_user_id,
             d.decided_at    as since,
             d.justification as justification,
             d.authority_source_actor_id as grantor_authority_actor_id,
             r.id            as revocation_id,
             r.actor_id      as revoked_by,
             r.decided_at    as revoked_at,
             r.justification as revocation_justification
        from public.decision_records d
        join public.decision_records r
          on r.tenant_id = d.tenant_id
         and r.decision_type = 'revoke'
         and r.subject_type = 'governance_decision'
         and r.subject_id = d.id
       where d.tenant_id = ${tenant.tenantId}::uuid
         and d.decision_type = 'delegate-authority'
         and d.subject_type = 'user'
       order by r.decided_at desc
    `);

    const revoked = (revokedRows.rows as unknown as Array<
      ActiveDelegationRow & {
        revocation_id: string;
        revoked_by: string;
        revoked_at: Date;
        revocation_justification: string;
      }
    >).map((row) => ({
      kind: "delegated" as const,
      actorId: row.grantee_user_id,
      decisionId: row.delegation_id,
      grantedByActorId: row.grantor_user_id,
      grantorAuthorityDecisionId: row.grantor_authority_actor_id,
      since: new Date(row.since).toISOString(),
      justification: row.justification,
      revokedAt: new Date(row.revoked_at).toISOString(),
      revocationDecisionId: row.revocation_id,
      revokedByActorId: row.revoked_by,
      revocationJustification: row.revocation_justification,
    }));

    return {
      status: "read",
      roster: {
        active,
        revoked,
        viewerIsAuthority: active.some((entry) => entry.actorId === tenant.userId),
        viewerIsBootstrapAuthority: bootstrap.actorId === tenant.userId,
      },
    };
  } catch {
    return { status: "unavailable", reason: "persistence-unavailable" };
  }
}
