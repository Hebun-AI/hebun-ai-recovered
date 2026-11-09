# BR-1 — Restore drill on synthetic data

Package 4's first step (`hebun-backup-restore-readiness-discovery.md`, gap 3: no restore was ever
performed). A backup was validated only by `pg_restore -l`, which reads the archive's table of
contents and restores nothing. BR-1 performs a real restore and compares the result with the source.

By Director instruction the drill runs on **synthetic data only**: a disposable PostgreSQL 18.6
cluster, the canonical migrations, three synthetic tenants. The discovery's variant — restoring an
existing production ceremony dump — is not done here (BR1-PROD-DUMP-DRILL-1).

## What changed

- `apps/dashboard/scripts/lib/restore-drill.ts` (new): `restoreArchive` loads an archive into an
  EMPTY loopback database (`pg_restore --single-transaction --exit-on-error --no-owner
  --no-privileges`), refusing a non-loopback URL before any tool runs and refusing below a free-space
  floor (default 3 GiB). `snapshotDatabase` reads the migration ledger, a schema digest (columns,
  constraints, indexes in `public` and `drizzle`), the exact row count of every table, the tenant
  count and foreign-key validation; `compareSnapshots` lists every difference. It imports nothing from
  the migration mechanics; the password, if any, reaches `pg_restore` only through its environment.
- `apps/dashboard/scripts/lib/production-migration.ts`: `createValidatedBackup` runs `pg_dump` under
  a 077 umask, so a dump is born 0600, and creates a new backup directory 0700. Before this, most
  historical dumps were 0644. **This changes the production ceremony's backup path** (file mode only;
  the dump's content and validation are unchanged).
- `apps/dashboard/tests/br1-restore-drill/restore-drill-postgres.ts` (new): the drill end to end.

## What is proven

- P1: a dump taken by `createValidatedBackup` (494 KB, 862 TOC entries, mode 0600) restores into an
  empty database with zero differences: 83 migrations, 83 tables, 3 tenants, 244 foreign keys all
  present and validated. Restore time 251–287 ms on this synthetic dump.
- N1 a truncated archive is refused (`restore-failed`); N2 a missing ledger row (`ledger`) and a
  dropped ledger table (`ledger-absent`) are detected; N3 a tenant count of 4 against 3 is detected;
  N4 below the floor nothing runs (`disk-below-floor`); N5 a non-loopback target throws; N6 a dropped
  unique index and a dropped CHECK are detected as schema drift.
- Mutations: removing the umask (M1), ignoring the schema digest (M2) and ignoring the tenant count
  (M3) each make the drill fail.
- Cleanup: every database the run creates (9) is proven absent from `pg_database` afterwards and the
  scratch directory removed, also after a real failing run.

## What is not proven

- No production dump has been restored; restore time on production-sized data is not measured.
- Row CONTENT is not compared, only counts; an edited row would pass.
- A CHECK constraint is compared by name and columns, not by expression: pg_dump/restore re-deparses
  five CHECK expressions into equivalent but different text, so expression text cannot be compared
  directly. A dropped CHECK is caught; a changed expression is not.
- The full suite on this commit is run on the pull request after this record is written; its result
  is reported there, not here.

## Closure Contract (v1)

- Phase: BR-1
- Owner: apps/dashboard/scripts/lib/restore-drill.ts (restore drill) and createValidatedBackup in apps/dashboard/scripts/lib/production-migration.ts (backup file mode)
- Reached state: VERIFIED
- Implementation commit: THIS COMMIT
- Verification level: V3 — the change touches the production ceremony's backup path, which holds tenant data; full suite justified on the pull request because a shared ceremony module changed and the new drill enters the full suite
- Verification evidence: locally, tests/br1-restore-drill/restore-drill-postgres.ts PASS (P1, N1–N6, cleanup proven); mutations M1, M2, M3 each exit 1; prodmig-flow backup-tls, bite-proofs (24/24 bit), boundaries-and-firewall, canonical-prefix-postgres, server-version-gate PASS; development-continuity closure-contract, workflow-firewall, agent-id-0-1-acceptance read-seam-and-truth, relevance1 boundaries PASS; tsc --noEmit 0, eslint 0, git diff --check clean
- Test environment: isolated worktree in the session scratchpad from a1a56f41, macOS Darwin 25.2.0, Node 24.16.0, disposable PostgreSQL 18.6 cluster at 127.0.0.1:55432 (initdb -E UTF8 --locale=C) stopped and deleted after use; free disk 24–27 GiB over a 5-minute preflight; no production access, no production dump, no credential, no network beyond loopback
- Deployment evidence: N/A — not deployed
- Production acceptance evidence: N/A — synthetic data only by Director instruction (BR1-PROD-DUMP-DRILL-1)
- Deferred risks: BR1-PROD-DUMP-DRILL-1 (DEFERRED); BR1-COMPARE-DEPTH-1 (DEFERRED)
- Director approvals: PACKAGE 4 / BR-1 IMPLEMENTATION, implement and local validation on synthetic data, 2026-11-09; BR-1 COMMIT + PUSH + PR + CI, single commit, pull request, quick and targeted, one full-suite label cycle, 2026-11-09; merge and deployment NOT approved

### Deferred risk detail

- **BR1-PROD-DUMP-DRILL-1 (DEFERRED).** The drill has never restored a production ceremony dump, so
  production restore time (the first real RTO) is unmeasured. Acceptance dependency: a Director
  decision naming the dump file the drill may read, run locally with contents never printed.
- **BR1-COMPARE-DEPTH-1 (DEFERRED).** The comparison checks row counts, not row content, and CHECK
  constraints by name and columns, not expression. Acceptance dependency: a Director decision whether
  a per-table content digest and a normalized CHECK comparison are worth their cost.

## Weekly three questions

1. **What did we learn?** pg_dump/restore does not round-trip CHECK expression text, so a byte-exact
   schema digest reports drift on a perfect restore; and a redundant safety (umask plus chmod) hides
   each half from its own test — one of them had to go before the mutation could fail.
2. **How does this improve Turkish Rug House?** A backup of TRH's data is now proven to restore, not
   only to list, and every new ceremony dump of it is readable by its owner only.
3. **How does this become part of Hebun AI?** The restore drill is a reusable seam: BR-1 production
   dump drill, BR-5 paired restore and any later backup design measure against it.
