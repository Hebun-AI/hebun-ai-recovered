# SCI-2A — Knowledge Version Database Immutability

**Status: CLOSED / PRODUCTION-VERIFIED (2026-10-06).** IMPLEMENTED `64b9a63f` (parent `90e661d7`,
pushed to `main` by the Director) · MIGRATED to production through `platform:migrate` (ledger 71 → 72)
· PRODUCTION-VERIFIED read-only (see *Production acceptance*). Migration
`20261006111812_sci2a_knowledge_version_immutability`. Architecture: SCI-0
([`hebun-sci0-secure-content-ingestion-trust-boundary.md`](hebun-sci0-secure-content-ingestion-trust-boundary.md)),
design gate SCI-2A-INTEGRITY-FIRST.

WF-3 = BLOCKED-BY-SCI · WF-4 = CLOSED / PRODUCTION-ACCEPTED · Agent #2 = STOPPED.

## The invariant

    SAME KNOWLEDGE VERSION ID => SAME VERSION-DEFINING CONTENT

Enforced by PostgreSQL on `knowledge_nodes`, independent of which application code, script or
legacy adapter sends the SQL. Before SCI-2A it held only by writer discipline (the K3 source census
in `tests/k3-flow/no-in-place-edit.ts`); the census stays, the database now backs it.

## What the migration installs

One function, three triggers, nothing else — no table, no column, no data rewrite, no backfill,
no re-ratification. The Drizzle snapshot is byte-equal to its predecessor's.

| Object | Kind | Effect |
|---|---|---|
| `knowledge_nodes_guard_version_immutability()` | plpgsql trigger function | the rule |
| `knowledge_nodes_version_immutable_update` | `BEFORE UPDATE … FOR EACH ROW` | refuses a change to any column outside the post-creation allowlist |
| `knowledge_nodes_version_immutable_delete` | `BEFORE DELETE … FOR EACH ROW` | refuses every delete |
| `knowledge_nodes_version_immutable_truncate` | `BEFORE TRUNCATE … FOR EACH STATEMENT` | refuses truncate, including one cascading from `companies` |

Refusals raise SQLSTATE `23001` (`restrict_violation`) and name the offending columns.

**Deny-by-default.** The function compares `to_jsonb(OLD) - allowlist` with `to_jsonb(NEW) - allowlist`
(`IS DISTINCT FROM`). So:

- an `UPDATE` that repeats an unchanged protected value passes (ORM-shaped updates are harmless);
- `NULL` ↔ value is a change; jsonb is compared semantically, not textually;
- a column added to `knowledge_nodes` later is protected until a migration names it.

## Column classification (all 46 columns)

**B — legitimate post-creation state (allowed to change).** Exactly the columns written by the two
authorities that update a node in place; both `.set({…})` literals are pinned column-by-column by
the K3 census.

| Column(s) | Writer |
|---|---|
| `ratification_decision_id`, `governance_session_id`, `ratified_by_actor_type`, `ratified_by_actor_id`, `ratified_at` | `knowledge-ratification/ratify-version.server.ts` |
| `knowledge_lifecycle_status`, `retired_at` | `knowledge/retract-source.server.ts` |
| `updated_at`, `updated_by`, `updated_by_type` | both |

**A — protected.** Everything else (36 columns), in two groups:

- **A1 — version identity, content and origin.** `id`, `tenant_id`, `type`, `ref_id`, `label`,
  `statement`, `provenance`, `source_attribution`, `references`, `dependencies`, `memory_refs`,
  `knowledge_version`, `supersedes_knowledge_node_id`, `domain_key`, `category_key`,
  `knowledge_scope`, `owner_actor_type`, `owner_actor_id`, `created_at`, `created_by`,
  `created_by_type`. Changing any of them means the row no longer says what it said, whose it is,
  where it came from, or which version it follows.
- **A2 — standing/review metadata with no authority that changes it after insert.**
  `knowledge_authority`, `knowledge_health`, `steward_actor_type`, `steward_actor_id`,
  `effective_from`, `effective_until`, `review_cadence`, `next_review_at`,
  `freshness_evaluated_at`, `deprecated_at`, `version`, `lifecycle_status`, `deleted_at`,
  `deleted_by`, `deleted_by_type`. No released writer updates these (repository census). Several are
  security-relevant: `effective_from/until` and `next_review_at` decide whether a version is in
  force, and the canonical reader filters `deleted_at is null` — so an unowned in-place change could
  silently withdraw ratified Knowledge, bypassing retraction's "refuses ratified" rule. A future
  review/freshness authority must release its column by its own migration.

**C — unclear.** None. Every column's post-creation ownership is decided by repository evidence.

## Authorities, unchanged

- **Ratification** writes only its five columns plus update attribution; proven against real
  PostgreSQL with the real Governance authority. The trigger decides nothing about who may ratify.
- **Retraction** moves `knowledge_lifecycle_status` to `retired` and stamps `retired_at`; content
  survives. Retraction is not deletion.
- **Supersession** inserts a new version row (`knowledge_version + 1`, `supersedes` = prior) and
  moves `knowledge_facts.active_knowledge_node_id` through the existing compare-and-swap; the prior
  row is byte-identical afterwards.

The trigger is not an authority. It holds no Governance, EAI, Agent, Action Authorization,
Execution or provider reachability; the function reads only `OLD`/`NEW`.

## Legacy writer containment

`persistence/supabase-postgres-adapter.ts` (unrouted; `storage-manager.ts` resolves every
collection to memory) still contains in-place `update knowledge_nodes … set statement = …`, a
soft-delete `set lifecycle_status`, and `delete from knowledge_nodes`. Its own statements, read from
its source and sent straight to PostgreSQL, are refused with `23001`; through the adapter every
mutating path (`update`, `archive`, `delete`, `save`, `clear`) fails while the row stays unchanged.
A no-op `restore` of an already-active row still succeeds (no column changes). The adapter was not
redesigned or deleted.

DELETE census: no production authority deletes a Knowledge version. The only `delete from
knowledge_nodes` statements are the dead adapter's and two test cleanups (now replaced by tenant
quarantine). No `TRUNCATE` exists anywhere.

## Historical truth

Rows are **PROTECTED FROM SCI-2A INSTALLATION FORWARD**. For rows that existed before the migration
ran, Hebun cannot prove they were unchanged before protection existed. SCI-2A does not claim
historical immutability.

**Installation boundary.** The Drizzle ledger (`drizzle.__drizzle_migrations`) records *that* the
migration is applied (row 72, its hash) but its `created_at` is the journal's authoring time, not
the time it ran. The database therefore holds no installation timestamp, and SCI-2A adds none. The
boundary is the ceremony evidence under *Production acceptance*: after 2026-10-06T17:08:04Z. Note for SCI-2B: `created_at` is written by the inserter,
so `created_at < installation` is not a sound per-row discriminator on its own.

## Evidence (local, disposable PostgreSQL 14; L3 baseline `90e661d7` 882/67 → head 885/67/952, identical failure set and first errors)

- `tests/sci2a-flow/version-immutability-postgres.ts` — real writers: insert; ORM-shaped and
  reordered-jsonb no-op updates pass; 36 protected mutations (incl. NULL ↔ value) refused naming the
  column; mixed lifecycle+content update refused; DELETE/TRUNCATE (incl. cascade) refused;
  supersede + fact CAS; ratification; retraction; legacy adapter refused; tenant isolation; zero
  network calls.
- `tests/sci2a-flow/bite-proofs-postgres.ts` — 9 defects caught (statement/provenance/tenant_id/
  supersedes unprotected; DELETE trigger dropped; ratification/retraction columns frozen).
- `tests/sci2a-flow/migration-shape-and-firewall.ts` — 4 statements, no DDL/data change, snapshot
  unchanged, no table read, not `SECURITY DEFINER`.
- Adapted: `tests/k3-flow/supersession-postgres.ts` (a lineage rewrite is now refused; cycle
  detection proven on the one cycle still constructible, a self-referencing insert),
  `tests/persistence/postgres-knowledge-nodes-integration.ts` (legacy mutations/deletes refused).

## Production acceptance (2026-10-06, read-only)

Target: cluster `7675444875863894887`, database `neondb`, PostgreSQL 18.6. Applied once through
`platform:migrate` from the release worktree, Director-confirmed at a TTY.

- **First attempt, not applied.** The ceremony took its backup
  (`hebun_production_pre_migration_20261006-122953.dump`) and then lost its connection while waiting
  at the confirmation prompt (`Connection terminated unexpectedly`). The confirmation was never
  read and nothing was applied. A read-only re-check confirmed this before the retry: ledger 71,
  no function, no triggers, every count and digest identical, no migration advisory lock held.
- **Second attempt: SUCCESS.** Backup `hebun_production_pre_migration_20261006-170804.dump`
  (747 268 bytes, 802 entries, `pg_restore -l` OK); ledger 71 → 72; release digest
  `0fea5966f15de3a95ace25715c5463e3`; the ceremony's own organizational comparison: unchanged.

| Check | Before | After |
|---|---|---|
| Ledger rows | 71, tail `0dceaf8f…` (`20261004073713`) | 72, tail hash `cd511647ae6c5c04e573d451f244960c75b73fa0b17fe5967b72dda25a4c189d` = migration file SHA-256 |
| `knowledge_nodes_guard_version_immutability` | absent | present; body identical to the shipped migration |
| Triggers on `knowledge_nodes` | none | `…_update` (BEFORE UPDATE, row), `…_delete` (BEFORE DELETE, row), `…_truncate` (BEFORE TRUNCATE, statement); all enabled |
| `knowledge_nodes` by tenant | 6 + 2 = 8 | identical |
| `knowledge_facts` by tenant | 5 + 2 = 7 | identical |
| `md5(string_agg(to_jsonb(row)::text, '' order by id))` nodes / facts | `b090fe87…` / `dda76ece…` | identical |
| Organizational counts (13 tables, incl. decision_records 59, audit_log 213) | recorded | identical |

No production row was updated, deleted or truncated to demonstrate refusal; the negative proof is
the real-PostgreSQL suite above. No provider call. No application code depends on the invariant;
the release commit carries migration, tests and documentation only. Pushing `main` triggers the
usual Vercel production build; this phase did not inspect or rely on it.

**Installation boundary.** Production protection begins at the ceremony's second run: after its
backup at **2026-10-06T17:08:04Z** and before the SUCCESS report. The ledger row's `created_at`
(`1791285492234` → 2026-10-06T11:18:12Z) is the migration's authoring time, six hours earlier —
the exact discrepancy this document warns about.

## Rollback

Removes the protection only; no Knowledge data is touched because none was rewritten.

```sql
DROP TRIGGER "knowledge_nodes_version_immutable_truncate" ON "public"."knowledge_nodes";
DROP TRIGGER "knowledge_nodes_version_immutable_delete" ON "public"."knowledge_nodes";
DROP TRIGGER "knowledge_nodes_version_immutable_update" ON "public"."knowledge_nodes";
DROP FUNCTION "public"."knowledge_nodes_guard_version_immutability"();
```

The ledger row stays unless separately removed; a released checkout would then see a converged
ledger without the objects. Forward-fix is preferred; rollback is its own Director gate.

## What SCI-2A does not establish

Source-file integrity; provenance admissibility (SCI-0 §16 prerequisite 2); a per-version digest
checked at read; any guarantee for rows before installation; integrity of the B columns themselves
(ratification and lifecycle values remain owned and guarded by their application authorities —
a stray SQL could still rewrite them); prevention of a self-referencing supersession insert.

## Remaining (SCI-2B / Director)

Whether pre-SCI-2A ratified versions may ground Agent B-level reasoning; how the evaluator sees
the installation boundary; provenance-derived admissibility. WF-3 remains BLOCKED-BY-SCI.
