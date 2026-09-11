/*
 * tenant-provisioning/provision-tenant.server.ts — THE tenant bootstrap authority.
 *
 * ── THE ONE EXCEPTION, AND THE WHOLE OF IT ──────────────────────────────────
 *
 * Three tables — `companies`, `roles`, `memberships` — and nothing else, ever. The normal writers
 * cannot enter the bootstrap cycle because the cycle is closed by foreign keys, so this is the cut,
 * and `memberships` is the last point at which it can be made: everything after it is structurally
 * reachable through the authorities that own it.
 *
 * It is not a membership writer, not role administration, not an organization writer, not an
 * invitation or enrollment bypass, and not a generic tenant CRUD helper. After it returns, every
 * later human, membership and role operation goes back to the authority that owns it.
 *
 * ── IT DOES NOT OWN A TRANSACTION, AND THAT IS THE POINT ────────────────────
 *
 * The R4A ceremony this replaces issued its own `begin`/`commit` around a raw `pg` client, which
 * was right when the only caller was a CLI whose entire job was this one act. It is wrong now.
 * Self-service signup must create a human, a credential AND a tenant together — "user created,
 * tenant absent" has to be UNREPRESENTABLE rather than merely unlikely — and a function that owns
 * its own transaction cannot be part of a larger one.
 *
 * So it takes a WRITER, exactly as `insertLocalIdentity` already does and for exactly the same
 * stated reason. The caller owns the transaction:
 *
 *   operator CLI    db.transaction(tx => provisionTenant(tx, ...))
 *   signup          db.transaction(tx => { identity; credential; provisionTenant(tx, ...) })
 *
 * A refusal is a RETURNED VALUE, not a throw, so the caller decides whether to abort the
 * surrounding transaction. `slug-already-taken` must roll back a signup (the human would otherwise
 * exist with no tenant) and must simply report in the CLI (nothing else was written) — one
 * behaviour cannot serve both, so this module states the fact and the caller states the policy.
 *
 * ── THE TENANT ID IS MINTED HERE ────────────────────────────────────────────
 *
 * `companies.id` is a database default. No caller supplies one, no caller may, and there is no
 * parameter through which a browser could reach one — which is what makes "the browser cannot
 * choose a tenant" a property of the type rather than of a validation rule somebody has to
 * remember to write.
 */
import { and, eq, sql } from "drizzle-orm";

import { companies } from "@/db/schema/company";
import { memberships } from "@/db/schema/membership";
import { roles } from "@/db/schema/role";

import {
  BOOTSTRAP_ROLE_NAME,
  BOOTSTRAP_ROLE_TYPE,
  normalizeSlug,
  validateTenantBootstrapInput,
  type ProvisionedTenant,
  type TenantBootstrapInput,
  type TenantBootstrapOutcome,
} from "./contracts";

/**
 * The narrowest database capability this authority needs.
 *
 * Deliberately structural rather than `ControlPlaneDatabase`: a transaction handle satisfies it and
 * so does the root database, which is what lets the CLI and signup share one implementation. It is
 * NOT widened to include `transaction`, so this module is incapable of opening one of its own.
 */
export interface TenantBootstrapWriter {
  insert: (table: never) => never;
  select: (fields?: never) => never;
  update: (table: never) => never;
}

/* The real shape, kept off the public interface so callers pass a drizzle tx without casting. */
type Writer = {
  insert: (table: unknown) => {
    values: (value: unknown) => { returning: (cols: unknown) => Promise<Record<string, string>[]> };
  };
  select: (fields: unknown) => {
    from: (table: unknown) => {
      where: (clause: unknown) => { limit: (n: number) => Promise<Record<string, string>[]> };
    };
  };
  update: (table: unknown) => {
    set: (value: unknown) => { where: (clause: unknown) => Promise<unknown> };
  };
};

/**
 * Postgres unique_violation. The database enforcing one tenant per slug.
 *
 * ── WHY IT WALKS THE CAUSE CHAIN ────────────────────────────────────────────
 *
 * It used to read `error.code` on the error itself, which was correct while the raw `pg` driver
 * threw straight into the ceremony. Drizzle wraps a driver error in `DrizzleQueryError` and the
 * wrapper carries NO `code` — the SQLSTATE lives on `cause`. A flat check therefore stopped
 * recognising a lost slug race and let it escape as an unhandled throw instead of the typed
 * `slug-already-taken` refusal, which the released R4A concurrency test caught.
 *
 * The depth bound exists so a self-referencing `cause` cannot spin.
 */
export function isUniqueViolation(error: unknown): boolean {
  for (let current: unknown = error, depth = 0; current !== null && current !== undefined && depth < 5; depth += 1) {
    if (typeof current === "object" && (current as { code?: unknown }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * Is this slug already a tenant?
 *
 * A COURTESY READ, not the invariant. Two concurrent provisions both read "no" and both write, so
 * `companies_slug_uq` is what actually decides — this read exists to turn the common case into a
 * clean typed refusal instead of an integrity error. The race is handled at the insert.
 *
 * Soft-deleted rows COUNT as occupying the slug: the unique index does not exclude them, so
 * reporting the slug as free would promise a write the database will refuse.
 */
async function slugIsTaken(writer: Writer, slug: string): Promise<boolean> {
  const rows = await writer
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.slug, slug))
    .limit(1);
  return rows.length > 0;
}

/**
 * Bring ONE tenant into existence, owned by ONE already-established human.
 *
 * The caller owns the transaction and the caller established the human. This writes the company,
 * the owner role and the bootstrap membership, and leaves everything else to the authorities that
 * own it.
 */
export async function provisionTenant(
  writer: TenantBootstrapWriter,
  input: TenantBootstrapInput,
): Promise<TenantBootstrapOutcome> {
  if (!validateTenantBootstrapInput(input)) {
    return Object.freeze({ status: "refused" as const, reason: "invalid-input" as const });
  }

  const db = writer as unknown as Writer;
  const slug = normalizeSlug(input.slug);
  const displayName = input.displayName.trim();

  if (await slugIsTaken(db, slug)) {
    return Object.freeze({ status: "refused" as const, reason: "slug-already-taken" as const });
  }

  let tenantId: string;
  try {
    /*
     * THE TENANT. `plan` is omitted so the column keeps its own default — this authority assigns it
     * no meaning, and writing 'free' would be tenant birth quietly claiming a billing concept that
     * has no consumer.
     *
     * `tenant_status` starts at `provisioning` and is promoted below, inside the same transaction,
     * exactly as the R4A ceremony did. The transient value is never observable by any reader, so
     * there is no incomplete tenant to recover and deliberately no recovery state machine.
     *
     * `created_by` / `created_by_type` are omitted. For a ceremony there is no honest actor to name;
     * for signup the human does not exist until this same transaction commits, and claiming they
     * created the row they are about to be granted would be attribution running ahead of the fact.
     * The truthful value is NULL, and `provisioning_source` carries what is actually known.
     */
    const companyRows = await db
      .insert(companies)
      .values({
        name: displayName,
        slug,
        tenantStatus: "provisioning",
        provisioningSource: input.provisioningSource,
      })
      .returning({ id: companies.id });
    tenantId = companyRows[0]!.id;
  } catch (error) {
    /*
     * `companies_slug_uq` deciding a race the courtesy read could not. The database refusing a
     * second tenant on one slug is the expected, correct outcome — not an error condition.
     */
    if (isUniqueViolation(error)) {
      return Object.freeze({ status: "refused" as const, reason: "slug-already-taken" as const });
    }
    throw error;
  }

  /*
   * THE OWNER ROLE. Shape taken from the one existing role writer
   * (`tenant-role-baseline/provision-member-role.server.ts`): `system_role` false because this is an
   * ordinary tenant role and not a built-in, `authority_rank` and `policy_refs` left NULL because no
   * runtime reads them and populating them would invent an authority.
   *
   * It does not collide with the later `member` baseline: `roles_one_member_per_tenant_uq` is
   * PARTIAL on `type = 'member'`, so the privileged bands are unconstrained.
   */
  const roleRows = await db
    .insert(roles)
    .values({
      tenantId,
      name: BOOTSTRAP_ROLE_NAME,
      type: BOOTSTRAP_ROLE_TYPE,
      systemRole: false,
    })
    .returning({ id: roles.id });
  const roleId = roleRows[0]!.id;

  /*
   * THE BOOTSTRAP MEMBERSHIP. `status` is written because the column is nullable and every read
   * seam filters `status = 'active'` — a NULL membership is invisible to sign-in.
   *
   * `accepted_invitation_id` stays NULL, and that is the truthful value: no invitation exists.
   * `memberships_accepted_invitation_uq` is a plain UNIQUE and Postgres treats NULLs as distinct, so
   * any number of bootstrap memberships coexist with invited ones. Nothing is fabricated — no
   * invitation id, no authorization id, no delegating actor, no created-by.
   */
  const membershipRows = await db
    .insert(memberships)
    .values({
      tenantId,
      userId: input.userId,
      roleId,
      status: "active",
      statusChangedAt: sql`now()`,
    })
    .returning({ id: memberships.id });
  const membershipId = membershipRows[0]!.id;

  /*
   * ACTIVE, in the same transaction as the membership. There is therefore no window in which a
   * tenant is active and memberless, and none in which `provisioning` is durable.
   *
   * The predicate names the id created above AND the transient status, so this statement is
   * structurally incapable of touching another tenant's row or of re-activating a suspended one.
   */
  await db
    .update(companies)
    .set({ tenantStatus: "active", tenantStatusChangedAt: sql`now()`, updatedAt: sql`now()` })
    .where(and(eq(companies.id, tenantId), eq(companies.tenantStatus, "provisioning")));

  const tenant: ProvisionedTenant = Object.freeze({
    tenantId,
    slug,
    displayName,
    roleId,
    membershipId,
    userId: input.userId,
    provisioningSource: input.provisioningSource,
  });
  return Object.freeze({ status: "provisioned" as const, tenant });
}
