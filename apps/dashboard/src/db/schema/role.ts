/* Roles — defined per tenant.
 *
 * S5 adds ADDITIVE authority metadata (all nullable/defaulted). `type`
 * (roleTypeEnum) is UNCHANGED — it remains the authority band. `authorityRank`
 * is optional ordinal metadata for ceiling computation (done later by the
 * resolver — NOT here). `systemRole` marks immutable built-in roles. `policyRefs`
 * links roles to policies (Spec 50) as data, not enforcement. Lifecycle/version
 * come from tenantColumns. */
import { sql } from "drizzle-orm";
import { pgTable, boolean, integer, jsonb, text, unique, uniqueIndex } from "drizzle-orm/pg-core";
import { tenantColumns } from "./_base";
import { roleTypeEnum } from "./_enums";

export const roles = pgTable(
  "roles",
  {
    ...tenantColumns,
    name: text("name").notNull(),
    type: roleTypeEnum("type").notNull().default("member"),

  /* ── S5 additive authority metadata ── */
  /** Optional ordinal for ceiling computation (resolver reads it later). */
  authorityRank: integer("authority_rank"),
  /** Immutable built-in role marker (e.g. platform owner/auditor). */
  systemRole: boolean("system_role").notNull().default(false),
  /** Policy references bound to this role (Spec 50) — data, not enforcement. */
    policyRefs: jsonb("policy_refs"),
  },
  (t) => [
    unique("roles_tenant_id_id_uq").on(t.tenantId, t.id),

    /*
     * I1.1 — THE ORDINARY-MEMBER-ROLE INVARIANT.
     *
     * A tenant has AT MOST ONE ordinary `member` role. Partial, so the privileged bands
     * (`owner`, `director`, `operator`, `auditor`) stay entirely unconstrained — a tenant may hold
     * as many of those as its history produced, and no seeded role is disturbed.
     *
     * WHY THE DATABASE AND NOT THE SERVER. Provisioning reads "does a member role exist?" and then
     * writes one. Two concurrent ceremonies both read "no" and both write, so the read is a
     * courtesy and this index is the actual invariant. It is also what makes I1's role choice
     * unambiguous: "the tenant's member role" names exactly one row or none.
     *
     * NO LIFECYCLE PREDICATE, DELIBERATELY. `where type = 'member'` alone, because I1.1 implements
     * no role deletion, suspension or revocation — nothing can move a role out of `active`. Adding
     * `and lifecycle_status = 'active'` would describe a state no runtime can reach and would
     * quietly weaken the invariant to "one ACTIVE member role", which is not what was authorized.
     */
    uniqueIndex("roles_one_member_per_tenant_uq")
      .on(t.tenantId)
      .where(sql`${t.type} = 'member'`),
  ],
);
