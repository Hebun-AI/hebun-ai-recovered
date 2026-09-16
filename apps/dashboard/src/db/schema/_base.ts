/*
 * Reusable column contracts. No table manually re-declares these.
 *
 * - rootColumns  : global / platform tables (companies, users, providers, …)
 * - tenantColumns : every tenant-owned table. Adds the mandatory tenantId FK.
 *
 * `rootColumns` is DEFINED in `./_root-columns` and re-exported here unchanged, so this module
 * remains the one place a table imports its column contract from. See that module for why the
 * definition cannot live here: `tenantColumns` below must import `companies`, and `company` must
 * never have to import this module back.
 *
 * Actor references (S2). createdBy / updatedBy / deletedBy remain plain `uuid`
 * columns (unchanged — no data loss, no runtime change). Each now has a NULLABLE
 * companion `*_by_type` (actorTypeEnum) column, forming the canonical polymorphic
 * `(actorType, actorId)` reference (Identity §3.9). We deliberately do NOT add a
 * single FK-to-users: agent/system/service actors are not rows in `users`, so a
 * users-FK cannot express them and would create a cross-table cycle. Resolution
 * of the pair to a concrete actor is the Identity domain's job (later stage);
 * the columns are additive, nullable, and require no backfill. tenantId carries
 * the real ownership FK.
 */

import { uuid } from "drizzle-orm/pg-core";
import { rootColumns } from "./_root-columns";
import { companies } from "./company";

export { rootColumns };

export const tenantColumns = {
  ...rootColumns,
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => companies.id),
};
