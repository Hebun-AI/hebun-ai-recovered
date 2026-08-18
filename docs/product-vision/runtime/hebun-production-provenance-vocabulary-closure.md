# Production Provenance Vocabulary — Closure

**Status:** RELEASED and APPLIED to canonical.
**Released at:** `f1850bb` (`feat: widen production provenance vocabulary`)
**Canonical:** `hebun_r1` — 30 → **31** applied migrations, 57 tables (unchanged), **0 business rows changed**.
**Suite:** 407 passed, 0 failed. Lint 0 errors (15 pre-existing warnings, none in changed files), typecheck clean, build clean.

This is the first gate of the Platform Operator Foundation, opened by that gate's verdict **B — existing authority can be safely extended into a minimal Platform Operator.** It changes provenance vocabulary and nothing else.

---

## What was actually wrong

Two CHECK constraints:

```
companies_provisioning_source_chk    provisioning_source IS NULL
                                     OR provisioning_source = 'local-operator-ceremony'
genesis_nominations_source_chk       nomination_source = 'local-operator-ceremony'
```

The second admits **no NULL**, so `nomination_source` was mandatorily "local". A production-born tenant and a production Genesis nomination were therefore not merely undesigned — they were **schema-impossible to record truthfully**. The row had to claim a local root it did not have, or PostgreSQL rejected it outright.

That matters more than a normal constraint, because `provisioning_source` is the **only evidence a ceremony leaves**. Tenant birth writes no `audit_log` row and *cannot*: `actor_id` and `actor_type` are both NOT NULL there, and possession of a deployment is not an identity. So a wrong value would be a permanent lie in the one place the truth is kept.

R4A anticipated this exactly — its own comment reads *"introducing a real operator identity later means adding a value here"* — which is why this gate adds a value rather than a mechanism.

## The value, and why this one

`production-operator-ceremony`.

The existing convention is `<locality>-operator-ceremony`. This changes **one morpheme** for **one reason**: it names a different *deployment*, never a different *kind* of authority. "Operator" already reads in this codebase as an unverified root — both existing headers say so explicitly ("NOT a certified operator", "not 'verified platform admin'") — so reusing the word smuggles in no new semantics.

`platform-admin` was rejected: no such authenticated principal exists, and naming one would assert a verification Hebun cannot perform.

## Schema delta

One additive migration, `20260818172455_production_provenance_vocabulary.sql`, four statements:

```sql
ALTER TABLE "companies" DROP CONSTRAINT "companies_provisioning_source_chk";
ALTER TABLE "genesis_nominations" DROP CONSTRAINT "genesis_nominations_source_chk";
ALTER TABLE "companies" ADD CONSTRAINT "companies_provisioning_source_chk" CHECK (… is null or … = 'local-operator-ceremony' or … = 'production-operator-ceremony');
ALTER TABLE "genesis_nominations" ADD CONSTRAINT "genesis_nominations_source_chk" CHECK (… = 'local-operator-ceremony' or … = 'production-operator-ceremony');
```

DROP + ADD is how a CHECK is widened; it cannot be altered in place. **No new table, column, enum, FK, index, or backfill.** `drizzle-kit generate` emitted exactly these four and nothing else, which also proves the R4A snapshot was current — the stale-snapshot failure mode that bit R3B did not recur.

`genesis_nominations.nomination_source` stays **NOT NULL**, and the widened CHECK gained no `IS NULL` escape. Acceptance, Governance decision, ratification, and the accepted/consumed/revoked constraints are untouched.

## Actor / source boundary — preserved

Nothing in this phase writes `created_by`, `created_by_type`, `updated_by`, `updated_by_type`, `audit_log.actor_id`, `audit_log.actor_type`, or an `authority_source`. No actor is created or implied. Possession remains a **SOURCE**: authoritative for *causing* an act without identifying who performed it.

## Vocabulary only — no writer exists

The database accepting a value says nothing about whether anything can reach it. Asserted as source-level facts, not intent:

- **No `src/` file writes `companies`** — no `.insert(companies)`, `.update(companies)`, or raw equivalent.
- **Only the two schema modules may even name the production root.** Every other file under `src/` is forbidden to mention it.
- **Neither ceremony writes it.** `provision-tenant.ts` and `nominate-genesis-human.ts` still name the *local* root, and are asserted not to name the production one.
- **No guard relaxed.** All five ceremonies (`tenant-provision`, `genesis-nominate`, `provider-connectivity`, `tenant-lifecycle`, `auth-dev-credential`) still carry both `NODE_ENV === "production"` refusal and `assertLocalDatabaseUrl`.

**Production therefore still has no write path.** A later gate must build the ceremony that may legitimately use this value.

## Bite-proofs

| | Proof | Result |
|---|---|---|
| A | Drop `companies_provisioning_source_chk`, retry an unknown root | accepted → the rejection test depends on the constraint, not on something incidental. Restored, bite returns |
| B | Evaluate a deliberately permissive predicate | returns `true` for the values just rejected → the CHECK probe's `false` is not vacuous |
| C | Add a `src/` import of the deployment ceremony | `"no file under src may import the deployment-possession ceremony"` fails, naming the file. Restored byte-identically (sha256 verified) |
| D | Append a backfill `UPDATE` to the migration | statement count 5 ≠ 4 → the no-backfill guard fails. Restored byte-identically (sha256 verified) |

**Bite-proof C failed for the wrong reason on the first attempt** and was redone. Injecting the import into the *control-plane module itself* crashed module loading before the assertion ran — a circular import, not a firewall verdict. Moving the injection to a leaf file the test does not load at runtime made the real assertion fire. A bite-proof that dies of an unrelated error proves nothing about the guard.

## Released-test repairs

A 31st migration legitimately falsified released claims. Every failure was audited; none was weakened.

| Suite | Was | Now |
|---|---|---|
| `r5-1-flow`, `r6b-flow`, `r6d-flow` | `migrations.length === 30` + "newest migration is R4A's" | boundary form: the inherited migration is intact, the count **at or before** the boundary is unchanged, and no later migration bears the phase's name |
| `r7-1-flow` | `newer === []` | boundary intact + declared-later list + no later migration bears R7.1's name |
| `g3-flow`, `kr3`, `kr4`, `kr5`, `knowledge-ingestion`, `invitation-revocation`, `stranded-enrollment` | declared-later-phase ledger | the new migration declared in it |
| `authentication-schema/migration` | applied count `"30"` | `"31"` — this file declares itself *"the ONE place a running total belongs"*, so updating it is the design, not a weakening |

**R5.1's comment claimed a timestamp-prefix boundary while its assertions were a repo-wide total and a "newest migration" identity.** Both were falsified by any later phase. The comment now describes what the code does.

Two naming collisions were found and resolved by renaming *this* phase's artifacts, never by weakening another phase's guard:

- `tests/g1-flow/` already belongs to the released **G1 Knowledge mutation audit**. This suite is `tests/provenance-vocabulary/`.
- The released G1 firewall forbids any migration matching `/g1|governance[-_]?audit|knowledge[-_]?mutation/i`. The first generated filename contained `g1_` and correctly tripped it; the migration is named by capability instead, matching the `r4a_…` / `r3w_…` precedent.

## Canonical impact

Applied through `drizzle-kit migrate`. Verified after:

- **Ledger by sha256, not by count:** 31 files = 31 journal entries = 31 applied rows, **0 hash mismatches**.
- **`companies` digest byte-identical** before and after (`68cf5df68f2063c43e34605698845741`); both rows still `provisioning_source = NULL`.
- Genesis: 1 row, still `local-operator-ceremony`. `audit_log`: 17, unchanged. Provider control: 1 row, `director_enabled = false`, `version = 30` — unchanged. Knowledge 1 node / 1 fact, attempts / permits / requests all 0 — unchanged.
- Tables still 57. No disposable database residue.

**NULL was preserved, never backfilled.** NULL continues to mean *"no ceremony provenance exists for this row"*, which is the truth about the two seeded rows.

## Remaining limitations

- **No production write path.** Nothing can yet create a production tenant or nominate Genesis in production. This gate makes the record *expressible*, not *reachable*.
- **Platform acts remain unauditable.** `audit_log.tenant_id` is nullable so platform *scope* is representable, but `actor_id` / `actor_type` are NOT NULL, so a possession act still has no honest actor. Blocked on a real platform principal, not on an audit-hardening phase.
- **No platform principal exists**, by design. Deployment possession is still a source, not an identity.
- `provisioning_source` remains NULL on both pre-existing tenants, permanently and correctly.

## Next gate

**G2 — Mock Surface Gating.** 19 mock modules with 93 non-test importers must not reach a real tenant. Not started.
