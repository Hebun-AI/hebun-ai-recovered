# HEBUN MEMBERSHIP–ROLE TENANT INTEGRITY — CLOSURE REPORT

**Phase:** Membership–Role Tenant Integrity — Gate A and Gate B both resolved from repository evidence, then implemented in the same task
**Date:** 2026-08-13
**Scope consumed:** one composite foreign key on `memberships`. **One additive migration, one statement. Zero new columns, tables, enums or dependencies. No new authority, no new writer, no runtime change.**
**Predecessors:** I1, I1.1, I1.2, I2, Tenant Selection, Post-Login Tenant Switching — all CLOSED, none redesigned.
**Resolves:** the limitation Post-Login Tenant Switching recorded in its §28.2 and named as its §29 next frontier.
**Verdict:** see §16.

---

## 1. Baseline

Re-proven before any modification, remote included.

| Fact | Measured |
|---|---|
| Branch / HEAD / `origin/main` / remote `main` | `main` · `7034cbe197c34a50a24d2a01634b9ff5fb48c9a3` · all identical |
| Ahead / behind | `0 0` |
| Working tree / staged | clean / none |
| Release tag (local + remote) | `hebun-post-login-tenant-switching-complete` → `3f210c3b` → `7034cbe` |
| Migrations / journal before | 23 / 23 |
| `hebun_r1` | 20 applied migrations |

---

## 2. The reported gap, re-proven rather than assumed

The previous phase reported that `memberships.role_id` references `roles.id` with nothing tying the role's tenant to the membership's. **Confirmed from migration SQL, not from the report:**

```
memberships_role_id_roles_id_fk  FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id")
```

One column. A membership in tenant A could name a role belonging to tenant B, and every session path reads that role straight off the membership row to build a `TenantContext`.

---

## 3. What the schema had already decided, three times

The decisive evidence is not that the gap existed — it is that this schema had **already answered the same question for the same parent columns**, everywhere else:

| Constraint | Child | Parent |
|---|---|---|
| `invitations_tenant_role_fk` | `invitations (tenant_id, intended_role_id)` | `roles (tenant_id, id)` |
| `membership_authorizations_tenant_role_fk` | `membership_authorizations (tenant_id, intended_role_id)` | `roles (tenant_id, id)` |
| `role_permissions_tenant_role_fk` | `role_permissions (tenant_id, role_id)` | `roles (tenant_id, id)` |

Plus the same pattern elsewhere: `identity_enrollment_requests → invitations`, `user_session_contexts → memberships`, `genesis_nominations → memberships`, `invitations → organizations`.

Every table that merely *intends* a role was structurally unable to name another tenant's. Only `memberships` — the row that turns a role into live authority — was not. `invitations.intended_role_id` and `membership_authorizations.intended_role_id` carry **no single-column FK at all**; their only role reference is the composite one. The pattern was established; `memberships` was the omission.

---

## 4. Authority ownership

| Question | Answer |
|---|---|
| Membership authority owner | `memberships` — one product writer: `human-onboarding/accept-invitation.server.ts` |
| Role authority owner | `roles` — one product writer: `tenant-role-baseline/provision-member-role.server.ts` |
| Who owns this invariant | **Membership authority.** The constraint lives on the child table, `memberships`. |
| What Role authority had to change | **Nothing.** `roles_tenant_id_id_uq (tenant_id, id)` — the composite reference target — has existed since the auth identity schema foundation, four migrations before this phase. |

No new owner was invented. No second Membership or Role authority exists; a structural sweep of every file under `src/` asserts the writer lists are still exactly one each.

---

## 5. Gate A

| | Question | Answer |
|---|---|---|
| A1 | Is the gap real? | **Yes.** Single-column FK, confirmed in migration SQL. |
| A2 | Database invariant or runtime concern? | **Database.** It is a relational fact, and the identical fact is already a DB constraint in three sibling tables. |
| A3 | Which authority owns it? | Membership authority (§4). |
| A4 | Enforceable without changing runtime semantics? | **Yes.** Zero runtime lines changed. |
| A5 | Would it break a legitimate model? | **No.** See §7 and §8. |
| A6 | Do current creation paths already produce same-tenant pairs? | **Yes, transitively.** The one membership writer copies `tenant_id` *and* `role_id` from the invitation row, whose own `invitations_tenant_role_fk` already guarantees that pair. |
| A7 | Do sign-in, selection, onboarding and switching trust `membership.role_id`? | **Yes** — all read it with no tenant check. |
| A8 | Would a DB invariant strengthen all of them at once? | **Yes**, at the single place the value originates. |
| A9 | Is a runtime check still needed after it? | **No** — and notably `findRoleForTenant` has existed in the auth repository since R1 with **zero call sites**. The runtime-check approach was written once and never adopted; this phase did not adopt it either. |
| A10 | Is a schema change necessary? | **Yes.** A constraint cannot be expressed in TypeScript. |

**Gate A: gap real, database-owned, resolvable additively.**

---

## 6. Gate B

| | Question | Answer |
|---|---|---|
| B1 | New database fact | `memberships (tenant_id, role_id)` must reference an existing `roles (tenant_id, id)` pair |
| B2 | Tables altered | `memberships` only |
| B3 | Constraints/indexes added | Exactly one: `memberships_tenant_role_fk` |
| B4 | Enum / column / table needed | **NONE.** The parent-side unique already existed and was **not** duplicated. |
| B5 | Does existing data satisfy it? | **Yes** — see §7 |
| B6 | Does ordering matter? | Only that the parent unique pre-exists. It does, since `20260719124600`. |
| B7 | ON DELETE / ON UPDATE | `ON DELETE restrict ON UPDATE no action` — identical to all three sibling role FKs. **No CASCADE introduced.** |
| B8 | Duplicate source of truth? | **No.** The existing single-column FK constrains a strictly weaker fact. |
| B9 | Runtime writer change? | **None** |
| B10 | Migration required? | **Yes** — one additive statement |

**Gate B authorized exactly one statement, and exactly that statement was generated:**

```sql
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_role_fk"
  FOREIGN KEY ("tenant_id","role_id") REFERENCES "public"."roles"("tenant_id","id")
  ON DELETE restrict ON UPDATE no action;
```

Generated by `drizzle-kit generate` and audited manually. No `DROP`, no `TRUNCATE`, no `CASCADE`, no `ALTER COLUMN`, no `SET NOT NULL`, no data rewrite, no unrelated cleanup. The generated ordering was valid and was accepted unmodified.

---

## 7. Live-data compatibility (read-only)

`hebun_r1`, inspected with `SELECT` only:

| Measure | Value |
|---|---|
| Applied migrations | 20 (unchanged) |
| Memberships / roles | 2 / 2 |
| Memberships whose role belongs to another tenant | **0** |
| Memberships with `role_id IS NULL` | 0 |

Every existing row already satisfies the constraint. **No data repair was needed and none was performed.**

Test fixtures were audited too. Exactly one deliberately created a cross-tenant pair — the Post-Login Tenant Switching test that existed to document this very gap. The `i1-1` fixture that also rewrites `role_id` is same-tenant and was unaffected.

---

## 8. PostgreSQL proof

`tests/membership-role-integrity-flow/integrity-postgres.ts`, against a disposable database.

**Constraint shape, read from `pg_constraint`:** type `f`, child `tenant_id,role_id`, parent `roles(tenant_id,id)`, `confdeltype = r`, `confupdtype = a`. The parent-side `roles_tenant_id_id_uq` is present and was not added by this phase. The pre-existing `memberships_role_id_roles_id_fk` is still present — this phase adds, it does not drop.

**POSITIVE**

| Case | Result |
|---|---|
| Membership tenant A + role tenant A | accepted |
| Membership with `role_id IS NULL` | accepted — MATCH SIMPLE exempts it, so the resolver's "no role" refusal stays reachable |
| Role provisioning, including I1.1's one-member-role rule | unchanged |
| Provision-then-onboard, end to end | works |
| Membership lifecycle: revoke, suspend, soft-delete, restore, version bump | all unchanged |
| I1 / I1.1 / I1.2 / I2 flows, sign-in, initial selection, post-login switching | all pass (§10) |

**NEGATIVE** — every case fails with SQLSTATE `23503` and `constraint = memberships_tenant_role_fk` specifically, not an unrelated constraint:

| Attack | Result |
|---|---|
| INSERT membership tenant B + role tenant A | refused |
| UPDATE `role_id` to a foreign tenant's role | refused; the row is unchanged afterwards |
| UPDATE `tenant_id` while keeping an incompatible role | refused — the invariant binds both columns |
| Direct SQL with full privileges, no session, no ORM, no reader | refused |
| DELETE a role a membership depends on | refused (`restrict`, no CASCADE) |
| Any surviving cross-tenant pair | zero, by construction |

The fourth case is the phase in one line: a connection that bypasses every application reader still cannot construct the row. That is what a TypeScript guard could never have claimed.

---

## 9. Authority non-effects

Asserted structurally in `tests/membership-role-integrity-flow/boundaries-and-firewall.ts`:

- `memberships` still has exactly **one** product writer; `roles` still has exactly **one** — proven by sweeping every file under `src/`, not by naming files.
- No Session, Governance, Identity, Credential, Invitation or Enrollment module was changed, and none names the constraint — it is a database fact, not a branch.
- `findRoleForTenant` still has **zero call sites**, and the membership writer did not gain a role-tenant check. The invariant is not shadowed by a runtime workaround.
- Session authority still writes no audit row.
- No permission runtime, provider, mail, execution or Computer Use capability appears.
- Dependency lists asserted against their exact published contents.
- The migration is asserted to be one statement matching the Gate B shape exactly, with destructive SQL patterns explicitly excluded.

---

## 10. Regressions

| Suite | Result |
|---|---|
| I1 (3), I1.1 (3), I1.2 (3), I2 (3) | PASS |
| authentication-foundation (6), authentication-schema (1) | PASS |
| tenant-selection-flow (2), tenant-switching-flow (2) | PASS |
| membership-role-integrity-flow (2) | PASS |
| **Full `npm run verify`** | **EXIT 0 — 347 passed, 0 failed, 347 total** |
| Lint | 0 errors, 14 warnings (all pre-existing) |
| Typecheck / Build | PASS / Compiled successfully |
| `git diff --check` | clean |

Test count moved 345 → 347 (two new files).

### A defect this phase found in five sibling tests

Five boundary tests failed on the new migration. **None of them was testing this phase.** Each expressed its own claim — *"my phase added no migration"* — as a frozen repository-wide count (`migrations.length === 23`). That proxy is falsified by any later authorized migration, no matter whose.

The repair keeps each phase's real invariant and states it durably: migration filenames are timestamp-prefixed, so a lexical comparison is chronological, and each test now asserts that the migrations which existed **when that phase closed** are intact, plus that no migration bearing that phase's name exists — then or since. `authentication-schema/migration.ts` is the one place a running total legitimately belongs, and its tally was extended to 24.

`g3-flow` had already used the durable pattern: it enumerates every migration permitted beyond G2's, precisely so no phase can add schema silently. It caught this migration **by design**, and the migration was added to that allowlist because it went through Gate B. That test is the model the other four now follow. This phase's own boundary test was written with the same fragile count and was corrected before it could propagate the defect again.

---

## 11. Durable database and orphan safety

- `hebun_r1`: still **20** applied migrations. `memberships_tenant_role_fk` count there is **0** — the constraint is **not** applied to it. Read-only `SELECT`s throughout; no migration, no seed, no ceremony, no data mutation.
- The three known orphan databases — `hebun_test_i12_probe_d073c537`, `hebun_test_i12_manual_be58770e`, `hebun_test_hebun_i1_membership_1c8a8356214345b5` — untouched: not used, mutated, dropped, swept or renamed.
- Every disposable database was created **and** destroyed through its own D1.1 ownership handle. **No new orphan.** No ad-hoc `CREATE DATABASE` / `DROP DATABASE`.

---

## 12. Status honesty

| State | Claim |
|---|---|
| **DESIGNED** | Composite tenant-paired foreign key, matching three existing sibling constraints |
| **IMPLEMENTED ON DISK** | `src/db/schema/membership.ts` + `20260813090642_membership_role_tenant_integrity.sql` |
| **PROVEN IN DISPOSABLE POSTGRESQL** | Yes — positive, negative, bypass, lifecycle and regression cases, all against a real database |
| **NOT YET APPLIED TO `hebun_r1`** | Correct. `hebun_r1` remains at 20 migrations and **does not have this invariant.** Applying it is part of the deferred durable rollout, not of this phase. |

The development database is four migrations behind the repository — 20 applied against 24 on disk, this phase's among them — and gains nothing from this phase until that rollout happens.

---

## 13. Schema, migration and dependency delta

- **Schema delta:** one foreign key on `memberships`. No column, table, enum, index or check added, removed or altered.
- **Migration delta:** +1 (23 → 24 SQL, 23 → 24 journal). One statement.
- **Dependency delta:** 0 — `package.json` and the lockfile are byte-identical to HEAD.

---

## 14. Changed-file census

**Modified (9)**

- `src/db/schema/membership.ts` — the composite FK
- `src/db/migrations/meta/_journal.json` — generated
- `tests/authentication-schema/migration.ts` — running tally 23 → 24
- `tests/g3-flow/boundaries-and-firewall.ts` — Gate-B migration allowlist
- `tests/i1-2-flow/`, `tests/i2-flow/`, `tests/tenant-selection-flow/`, `tests/tenant-switching-flow/boundaries-and-firewall.ts` — durable migration-count assertions (§10)
- `tests/tenant-switching-flow/switch-postgres.ts` — record integrity (§15)

**New (4)**

- `src/db/migrations/20260813090642_membership_role_tenant_integrity.sql`
- `src/db/migrations/meta/20260813090642_snapshot.json` — generated
- `tests/membership-role-integrity-flow/integrity-postgres.ts`
- `tests/membership-role-integrity-flow/boundaries-and-firewall.ts`

---

## 15. Record integrity

The Post-Login Tenant Switching test contained a block that **set up** a cross-tenant role assignment and asserted only that switching was as strict as an ordinary sign-in — the honest thing to assert while the gap existed. PostgreSQL now refuses the row that block created.

The assertion was **inverted, not deleted**: the block now asserts that the update is rejected by `memberships_tenant_role_fk`, which is strictly stronger than the parity it used to settle for. The comment records what it used to prove and why it changed.

`docs/product-vision/runtime/hebun-post-login-tenant-switching-closure.md` is **unmodified**. Its §28.2 still records the gap as a limitation *of that phase*, and its §29 still names this work as the next frontier — correct history. No code constant claimed the gap, so none needed inverting. The annotation on the released switching tag is immutable and likewise remains historical.

---

## 16. Remaining limitations and what was explicitly NOT implemented

1. **`hebun_r1` does not have the invariant.** §12. Durable rollout is a separate frontier.
2. **The single-column `memberships_role_id_roles_id_fk` remains**, now redundant with the composite one. Removing it would be a `DROP` this phase was not authorized to perform, and it weakens nothing.
3. **Role *type* is still not constrained by membership.** The database now guarantees a role belongs to the right tenant; which band a membership may hold remains I1's runtime decision, deliberately untouched.
4. **Not implemented:** any data repair (none was needed), any change to Session, Governance, Identity, Credential, Invitation or Enrollment authority, any runtime validation, any permission runtime, any durable rollout, any second writer.

## 17. Commit / tag / push state

**None.** No commit, no tag, no push. HEAD remains `7034cbe`, `0 / 0` with `origin/main`, working tree carrying this phase's changes only.

## 18. Next frontier

**P3 durable rollout** — `hebun_r1` is now four migrations behind, and this phase's invariant is among them. Applying it is a durable-database decision with its own gate.

---

# MEMBERSHIP–ROLE TENANT INTEGRITY CLOSED — IMPLEMENTED AND PROVEN, DURABLE ROLLOUT DEFERRED

The gap was real, it was database-owned, and the schema had already answered the same question three times for the same parent columns. One composite foreign key closed it, with zero runtime change, zero new authority, zero dependency delta, and one additive migration statement — proven against a real PostgreSQL database, and not yet applied to `hebun_r1`.
