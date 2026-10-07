/*
 * work_domains — THE WORK DOMAIN AUTHORITY's one table (AP-4A).
 *
 * A work domain is a TYPED KIND OF WORK in one organization ("security", "legal-review", "content"):
 * the vocabulary an agent's responsibility is stated in and a recorded piece of work is classified by.
 * It is deliberately NOT a department. A department is where people and agents SIT; a work domain is
 * what kind of work something IS. One domain can be served from many departments and one department
 * can host many domains, so this table holds no reference to `departments` and nothing derives one
 * from the other.
 *
 * ── IDENTITY: THE SLUG IS FOREVER ──────────────────────────────────────────
 *
 * `(tenant_id, slug)` is unique over the table's WHOLE LIFE — retired rows included. A slug names
 * exactly one domain in one organization, ever, so an audit row, a request payload or a model
 * candidate that carries a slug can never mean two domains at two times, and a grant made against a
 * retired domain can never silently attach to a newer one. The slug is also IMMUTABLE: renaming
 * changes `name` only. There is no delete and no un-retire; a retired domain stays retired, and the
 * way to serve that kind of work again is a NEW domain under a NEW slug.
 *
 * The unique index is also the concurrency guarantee: two simultaneous creations of one slug produce
 * one commit and one `unique_violation`, so the writer needs no table lock.
 *
 * ── LIFECYCLE ──────────────────────────────────────────────────────────────
 *
 * `active` -> `archived` (retired), once. `deleted` is unrepresentable here. Retiring touches no other
 * row: work that names the domain keeps naming it, and responsibilities granted for it stay on their
 * mandate revision as history — they simply stop admitting anything.
 *
 * ── TENANT SAFETY IS STRUCTURAL ────────────────────────────────────────────
 *
 * `(tenant_id, id)` is unique so every referencing table can hold a COMPOSITE foreign key: a reference
 * to another organization's domain is refused by PostgreSQL (23503), not by application code.
 */
import { sql } from "drizzle-orm";
import { check, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { tenantColumns } from "./_base";

export const workDomains = pgTable(
  "work_domains",
  {
    ...tenantColumns,
    name: text("name").notNull(),
    slug: text("slug").notNull(),
  },
  (t) => [
    uniqueIndex("work_domains_tenant_id_uq").on(t.tenantId, t.id),
    /* LIFETIME uniqueness — NOT partial. See the header. */
    uniqueIndex("work_domains_tenant_slug_uq").on(t.tenantId, t.slug),
    check("work_domains_name_chk", sql`char_length(btrim(${t.name})) between 1 and 80`),
    /* The slug shape is stated again in `features/work-domain/contracts.ts`; a test pins the two equal. */
    check("work_domains_slug_chk", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(${t.slug}) <= 48`),
    check("work_domains_lifecycle_chk", sql`${t.lifecycleStatus} in ('active', 'archived')`),
    check(
      "work_domains_retirement_chk",
      sql`(${t.lifecycleStatus} = 'archived') = (${t.deletedAt} is not null)`,
    ),
  ],
);
