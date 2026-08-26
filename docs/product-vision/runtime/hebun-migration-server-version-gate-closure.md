# Migration Server-Version Gate — Hardening Closure

**Status:** engineering/release record. Not runtime state, not an authority.
**Released implementation:** `0c67a23fc580fc9ca5fe8a9df9b67b603931365c`, authored 2026-08-26 15:01:19 +0300.
**Parent:** `b29d2810732cd17ff52acc0a2a8f5b8e4fd71f8d`.
**Tag:** none, per the untagged convention in force across this series.
**Lifecycle reached:** designed · implemented · verified · **released**.
**Hardens:** `hebun-production-migration-authority-closure.md`.

> **Record provenance.** Written after the fact during the INT-5C release ceremony. Every statement
> below is measured from the repository or from the commit's own message at `0c67a23`. The real
> ceremony output quoted in §1 is reproduced from that commit message, which recorded it at the
> time; this process did not itself run the ceremony.

---

## 1. The defect

A real production migration ceremony printed:

```
server : PostgreSQL undefined
```

A later read-only preflight against the same cluster proved why:

```
show server_version -> rows[0] keys: ["server_version"]
show server_version -> value: "18.6 (3484359)"
```

The ceremony read `rows[0].v`, because the query was written as
`client.query<{ v: string }>("show server_version")`. **That generic is a caller-supplied assertion
about a runtime shape, checked by nobody** — `pg` returns whatever the server named the column. So
the value was `undefined` at runtime while type-checking as `string`.

## 2. Why it failed OPEN

`majorOf` was `Number(/(\d+)/.exec(version)?.[1] ?? "0")`. `undefined` became the string
`"undefined"`, matched no digits, and answered **0**. The gate it feeds is
`dumpMajor < serverMajor`, which is **false for every pg_dump when the server major is 0**.

The early `pg_dump-too-old` refusal was therefore **inert**. It failed open, in silence, in a
ceremony whose entire purpose is to fail closed.

**The test agreed with the bug.** `canonical-prefix-postgres.ts` read the column the same way, so
its `pg_dump-too-old` skip branch was unreachable for the life of the released code.

## 3. What was NOT compromised

The completed KR-EXT1 production migration stands. **The backup itself was always fail-closed** —
that ceremony ran pg_dump 18.3 against PostgreSQL 18.6 and produced a `pg_restore -l` validated
archive. What was lost was the **early refusal**, not the safety.

**This is hardening, not remediation.**

## 4. The fix

- `parsePostgresVersion(raw: unknown)` becomes the single version authority. It takes `unknown`
  **deliberately**, because its callers hold values that came off a wire or out of a child process,
  where a compile-time type is a claim rather than a fact. The match is anchored at the start, so a
  build identifier can never be mistaken for a major version.
- `readServerVersion(client)` runs `show server_version`, reads the **real** field name, requires
  exactly one row, and validates through the parser.
- Unknown, missing, malformed, NaN, zero or otherwise unparseable versions **refuse**. `majorOf` is
  **deleted**, so no code path can produce a zero major at all.
- `createValidatedBackup` now takes a `PostgresVersion` (raw + major) rather than a string. Only the
  parser constructs one, so the bad state is **unrepresentable** rather than merely better-checked.
- An unreadable `pg_dump --version` refuses by its own name (`pg_dump-unreadable-version`) instead
  of reporting *"the available pg_dump is 0"* to an operator.
- The ceremony refuses with `TARGET_UNVERIFIED` when the version cannot be established — **before**
  the baseline fingerprint, the backup, the banner, the confirmation and the migration.

**Compatibility:** pg_dump major < server major refuses; pg_dump major ≥ server major passes. A
newer pg_dump against an older server is supported and is not rejected for being newer.

## 5. What shipped

6 files, +611 / −14.

| File | Role |
|---|---|
| `scripts/lib/production-migration.ts` | the parser, `readServerVersion`, typed backup input (+162) |
| `scripts/platform-migrate.ts` | `TARGET_UNVERIFIED` refusal ordering (+25) |
| `tests/prodmig-flow/server-version-gate.ts` | **new**, 379 lines |
| `tests/prodmig-flow/bite-proofs.ts` | +35 |
| `tests/prodmig-flow/canonical-prefix-postgres.ts` | the test that had agreed with the bug, repaired |
| `learnings.md` | +11 |

## 6. The transferable lesson

**A TypeScript row-shape annotation is a runtime lie.** `client.query<{ v: string }>(...)` asserts a
shape nobody verifies. Where a value crosses a process or a wire, parse it from `unknown` and refuse
what does not parse.

**A defaulting fallback can invert a gate.** `?? "0"` looks defensive and turned a refusal into an
approval. When a sentinel feeds a comparison, ask what the comparison does at the sentinel.

**A test written from the same misunderstanding cannot catch it.** The skip branch was unreachable
and green.

## 7. Validation evidence

Re-run in full at `dc39ee9`:

| Suite | Result |
|---|---|
| `tests/prodmig-flow/server-version-gate.ts` | PASS |
| `tests/prodmig-flow/bite-proofs.ts` | **18 mutations bit** |
| `tests/prodmig-flow/canonical-prefix-postgres.ts` | PASS |
| Full suite | **495 / 495** |

## 8. Final truth ledger

| | |
|---|---|
| Severity | degraded diagnostic + inert early gate — **not** a safety failure |
| Backup safety during the window | **intact**, fail-closed throughout |
| KR-EXT1 production migration | **stands**, no remediation required |
| `majorOf` | **deleted** — zero major now unrepresentable |
| Refusal ordering | before fingerprint, backup, banner, confirmation, migration |
