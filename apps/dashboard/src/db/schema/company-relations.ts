/*
 * The `companies` ownership relations — moved out of `company.ts`, unchanged.
 *
 * ── WHY THEY ARE NOT BESIDE THE TABLE ───────────────────────────────────────
 *
 * Every tenant table spreads `tenantColumns`, and `tenantColumns` names `companies.id`, so `_base`
 * imports `company`. If `company` ALSO imports tenant tables — which is all these relations need —
 * the imports form a loop: `_base → company → organization → _base`. Evaluating any tenant table
 * cold then reaches `organization` while `_base` is still suspended on its own import of `company`,
 * and `organization` spreads a `tenantColumns` that does not exist yet. That is the production
 * error `Cannot access 'tenantColumns' before initialization`, and whether a bundle hit it depended
 * only on which module it happened to evaluate first.
 *
 * Here nothing imports this module except the schema barrel, so it evaluates after every table it
 * names. A relation is ORM metadata — it emits no SQL, no constraint and no migration — and drizzle
 * finds it through the barrel exactly as before.
 *
 * `company.ts` MUST NOT import a tenant table. `tests/schema-module-cycle/` fails if it does.
 */
import { relations } from "drizzle-orm";
import { companies } from "./company";
import { organizations } from "./organization";
import { departments } from "./department";
import { agents } from "./agent";
import { registries } from "./registry";

/* Ownership relations that are already certain. */
export const companiesRelations = relations(companies, ({ many }) => ({
  organizations: many(organizations),
  departments: many(departments),
  agents: many(agents),
  registries: many(registries),
}));
