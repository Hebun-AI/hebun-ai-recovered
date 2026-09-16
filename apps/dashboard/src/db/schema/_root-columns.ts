/*
 * The root column contract — the columns EVERY table carries, tenant-owned or not.
 *
 * ── WHY THIS IS ITS OWN MODULE ──────────────────────────────────────────────
 *
 * It is a PRIMITIVE, and a primitive may import nothing but other primitives. `_base.ts` cannot be
 * one: `tenantColumns` names `companies.id` as its foreign key, so `_base` imports `company`. When
 * `rootColumns` also lived in `_base`, `company` had to import `_base` back to spread it, and every
 * tenant table that `company` names in its relations spread `tenantColumns` from a `_base` that was
 * still suspended on that import. Whichever module a bundle evaluated first decided whether that
 * worked, so production routes answered 500 with
 * `Cannot access 'tenantColumns' before initialization` on some deployments and not on others.
 *
 * Here it depends on `drizzle-orm` and `./_enums` only, so it is always fully initialised before
 * anything spreads it. `_base.ts` re-exports it unchanged, so there is still exactly one definition
 * and every existing `import { rootColumns } from "./_base"` keeps meaning the same thing.
 *
 * Actor references (S2). createdBy / updatedBy / deletedBy remain plain `uuid` columns. Each has a
 * NULLABLE companion `*_by_type` (actorTypeEnum) column, forming the canonical polymorphic
 * `(actorType, actorId)` reference (Identity §3.9). We deliberately do NOT add a single FK-to-users:
 * agent/system/service actors are not rows in `users`, so a users-FK cannot express them and would
 * create a cross-table cycle.
 *
 * THIS MODULE MUST NEVER IMPORT A TABLE. `tests/schema-module-cycle/` fails if it does.
 */
import { integer, timestamp, uuid } from "drizzle-orm/pg-core";
import { actorTypeEnum, lifecycleStatusEnum } from "./_enums";

export const rootColumns = {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
  /** Companion to createdBy — the actor's type in the polymorphic reference. */
  createdByType: actorTypeEnum("created_by_type"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid("updated_by"),
  /** Companion to updatedBy. */
  updatedByType: actorTypeEnum("updated_by_type"),
  version: integer("version").notNull().default(1),
  lifecycleStatus: lifecycleStatusEnum("lifecycle_status").notNull().default("active"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  /** Soft-delete actor attribution — nullable; set only when the row is deleted. */
  deletedBy: uuid("deleted_by"),
  /** Companion to deletedBy. */
  deletedByType: actorTypeEnum("deleted_by_type"),
};
