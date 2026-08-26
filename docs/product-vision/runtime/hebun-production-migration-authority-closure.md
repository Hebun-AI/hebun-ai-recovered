# Production Migration Authority — Release Closure

**Status:** engineering/release record. Not runtime state, not an authority.
**Released implementation:** `b29d2810732cd17ff52acc0a2a8f5b8e4fd71f8d`, authored 2026-08-26 12:45:59 +0300.
**Parent:** `afbb4725a7266527f1e41dcadf51ae33a99dcd06`.
**Tag:** none, per the untagged convention in force across this series.
**Lifecycle reached:** designed · implemented · verified · **released**. *Deployed* is not a
meaningful state for this artifact — it is an operator ceremony, not runtime code.
**Immediate successor:** `hebun-migration-server-version-gate-closure.md` — hardening of this
ceremony's version gate, released 2h16m later.

> **Record provenance.** Written after the fact during the INT-5C release ceremony. Commit, file and
> test facts were measured from the repository in that session. **Whether this ceremony was the tool
> that applied migration 36 to production was NOT independently observed by this process** — see §7.

---

## 1. What this closes

KR-EXT1 authored migration 36. Nothing in the repository could apply it to a hosted deployment.
Possession ceremonies existed (G4), but possession gates *ceremonies*, not *migrations*, and every
one of them refused when the target was behind — which is exactly the state a migration exists to
fix. This adds the one path that converges a deployment's schema onto the release the checkout
carries.

`npm run platform:migrate`.

## 2. What shipped

8 files, +2,343 / −8.

| File | Role |
|---|---|
| `scripts/platform-migrate.ts` | the ceremony (344 lines) |
| `scripts/lib/canonical-migrations.ts` | the canonical ledger + exact-prefix proof (309) |
| `scripts/lib/production-migration.ts` | backup, lock, counts, banner (362) |
| `scripts/lib/production-possession.ts` | **the possession / convergence split** (+97) |
| `package.json` | `platform:migrate` script entry |
| `tests/prodmig-flow/{bite-proofs,boundaries-and-firewall,canonical-prefix-postgres}.ts` | proof |

## 3. The possession / convergence split — the load-bearing design move

`verifyProductionTarget` fuses two questions: *do I possess this deployment?* and *is it already
converged?* Every ceremony that writes an organizational row needs both. **A migration ceremony
needs the first and is defined by the second being false.**

So possession was factored out as `verifyProductionIdentity`, and this ceremony proves the schema
separately. Nothing was loosened for any existing caller — the fused function still exists and still
refuses.

## 4. Why a count could never have authorized this

The released convergence check compares applied count against authored count. That is sufficient to
gate a row write and far too weak to gate a migration, because a count cannot distinguish:

- a target missing migration 12 from one missing migration 34;
- a target whose migration 20 was applied from a **file later edited**;
- a target carrying somebody else's migration 30 in place of ours.

All three read as *"n applied"*. Only the per-migration hash separates them. So the authority
compares **hashes, in order**, and the count falls out as a consequence rather than standing in as
evidence.

## 5. The engine cannot do this, and that is a division of labour

Drizzle's migrator decides what is pending from **one row** — the newest applied `created_at` — and
applies everything authored after it. It never verifies that the applied history *is* the authored
history. Two consequences, both silent:

- a target missing a migration in the **middle** is never repaired; the gap is skipped forever,
  because every authored migration older than the newest applied one is passed over;
- a target carrying a **divergent** migration with a newer timestamp causes the engine to apply
  nothing **and report success**.

This is not routed around. The engine applies authored migrations; deciding whether this target is
one the engine may safely be pointed at happens **before** it is invoked, because afterwards is too
late. Once the applied ledger is proven an exact **prefix** of the canonical one and the canonical
`when` values are proven strictly increasing, the engine's timestamp rule and the authority's index
rule select **the same set** — the same answer derived two ways, with both preconditions asserted
rather than assumed.

## 6. Bounded mutation, measured rather than asserted

**May mutate:** the schema, and the migration ledger. That is the entire list.

**May not:** Knowledge facts or nodes, integrations, Governance decisions, permits, execution
attempts, provider controls, tenant lifecycle, external send. Organizational tables are counted
before and after and the comparison is reported.

`canonical-migrations.ts` issues only `select`, opens no transaction and applies nothing — the
proof cannot damage what it inspects.

**Local posture takes the same code path**, not a parallel one. A rehearsal that runs a different
route than the real thing proves only that the rehearsal works.

**Credential handling:** the backup invokes `pg_dump` without putting the URL on the command line,
because `pg_dump -d "$URL"` leaks the password to every process table reader via `ps`.

## 7. What this record does NOT claim

Production's ledger reads **36 applied**, digest `1b67f950a863b1d86b072dee14c6edb3`, converged with
the 36 authored migrations — measured during the INT-5C ceremony. That proves migration 36 **is
applied**. It does **not** prove which tool applied it. The application of migration 36 to
production was Director-observed; this process did not witness it and does not assert it here.

**Availability of an authority is not evidence that it ran.**

## 8. Validation evidence

Re-run in full at `dc39ee9`:

| Suite | Result |
|---|---|
| `tests/prodmig-flow/bite-proofs.ts` | **18 mutations bit** |
| `tests/prodmig-flow/boundaries-and-firewall.ts` | PASS |
| `tests/prodmig-flow/canonical-prefix-postgres.ts` | PASS |
| Full suite | **495 / 495** |

## 9. Final truth ledger

| | |
|---|---|
| Ceremony exists and is released | **YES** — `platform:migrate` |
| Possession fused with convergence | **split**, no existing caller loosened |
| Convergence proved by | **per-migration hash prefix**, never count |
| Engine trusted to detect divergence | **NO** — proved before invocation |
| Organizational mutation | **none permitted**, counted before/after |
| Applied migration 36 to production | **not witnessed by this process** — see §7 |

## 10. Known defect at release, fixed 2h16m later

This release shipped a **fail-open server-version gate**: `show server_version` was read under the
wrong key, so the pg_dump-vs-server comparison was inert. It was hardening that failed, not safety —
the backup itself was always fail-closed. See `hebun-migration-server-version-gate-closure.md`.
