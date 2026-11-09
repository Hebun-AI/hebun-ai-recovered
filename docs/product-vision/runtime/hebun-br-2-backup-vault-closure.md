# BR-2 — Encrypted backups, retention, verified restore, media snapshot

Package 4, after BR-1. It closes discovery gaps 1 (no scheduled database backup), 2 (no encryption
before anything leaves the host), 4 (no retention), and the tooling half of 5/6 (no media backup or
restore). Everything is built and proven on synthetic data and disposable local resources. Nothing
has run against production, nothing is scheduled, nothing is uploaded, and the VPS is unchanged.
Operating commands: `hebun-backup-recovery-runbook.md`.

## What changed

- `apps/dashboard/scripts/lib/backup-vault.ts` (new): the `.hbk` vault format. It holds:
  - AES-256-GCM with a fresh 96-bit nonce and the header as AAD;
  - a fail-closed decrypt: output goes to `.part` and is renamed only after the tag AND the plaintext
    SHA-256 verify;
  - a key file that must be regular, owner-only, 32 bytes and never overwritten;
  - files at 0600 and created directories at 0700;
  - an 8 GiB free-space floor;
  - GFS retention (last 3, plus 7 daily, 4 weekly and 6 monthly). Retention verifies every kept file
    before deleting anything and never prunes the newest file.
- `apps/dashboard/scripts/lib/database-backup.ts` (new): `backupDatabase` takes a
  `createValidatedBackup` dump, seals it, reads it back to authenticate it, deletes the plaintext and
  optionally prunes. `restoreFromVault` authenticates the file, then hands it to BR-1's
  `restoreArchive` (loopback only).
- `apps/dashboard/scripts/backup-vault.ts` (new): the operator CLI, with commands `init-key`,
  `backup-db`, `seal`, `verify`, `open`, `prune` and `restore-db`.
  - Connection strings are read from an environment variable named by a flag.
  - Output is one JSON line without URL or content.
- `infra/media-store-vps/hebun_media_backup.py` (new): media `snapshot`, `verify` and `restore`.
  - Standard library only; works on 3.9+.
  - Restore extracts member by member with strict names and no links into private staging. Staging is
    renamed into place only when every object matches the manifest. Restore never merges into an
    existing root.
- `apps/dashboard/tests/prodmig-flow/boundaries-and-firewall.ts`: `scripts/lib/database-backup.ts` is
  added to the named-import allowlist. It may take only the existing read-only/backup helpers.
- Runbook `hebun-backup-recovery-runbook.md`, including the BR-0 list of Neon Console values.

## What is proven

**Vault** (`tests/br2-backup-vault/vault.ts`):
- A 3 MiB round trip is byte-exact. The key, vault and output files are 0600 and created directories
  are 0700.
- These are refused with nothing left behind: a ciphertext, tag or header byte (header edit kept as
  valid JSON), truncation, extension, magic, empty file, wrong key, and an authentic file whose sealed
  digest is wrong.
- A key file at 0644, short or symlinked is refused, and a key is never overwritten.
- The disk floor refuses before writing.
- Retention: 14 of 240 files kept, and the newest is always kept. Applied pruning deleted exactly the
  planned 20 and nothing foreign, and refused while a kept file was broken.

**Database** (`tests/br2-backup-vault/database-backup-postgres.ts`, disposable PG 18.6, 3 synthetic
tenants):
- The backup sealed 494 KB in about 300 ms and left no plaintext.
- Restore from the vault matched the source with zero differences.
- A tampered file, the wrong key and the wrong kind are rejected before `pg_restore`; their targets
  stay empty.
- The disk floor and an unreachable server refuse and add nothing to the vault.
- A second backup with retention pruned the first.
- 5 databases are dropped and scratch is removed; the test proves both.

**Media**:
- `test_hebun_media_backup.py`: 16 tests OK on Python 3.9.6 and 3.13.9. They cover:
  - exact restore, with 0440 files and 0700 directories;
  - `.tmp-` skipped;
  - symlinks and foreign names refused at snapshot;
  - a corrupted object byte, truncation, a missing manifest, a missing object, an unlisted extra
    object, a tampered manifest digest, path traversal, absolute paths, symlink members, duplicates,
    an existing target and the disk floor all refused, with no staging left.
- `tests/br2-backup-vault/media-backup-chain.ts`: snapshot → seal → open → verify → restore, 6
  objects byte-exact. A tampered sealed snapshot is refused before the media tool runs.

**CLI**: smoke-tested on disposable databases.
- `init-key`, `backup-db`, `verify`, a `prune` dry run and `restore-db` all ran; restore brought back
  100 of 100 rows.
- The URL appeared 0 times in the output. A usage error exits 2 and a refusal exits 1.

**Mutations** (isolated detached worktree): 13 of 14 bit.
- Removing AAD, keeping the part file on failure, skipping the digest check, pruning without verify,
  0644 files, ignoring the key mode, dropping the newest from retention, keeping plaintext after
  backup, skipping the restore kind check, and four media-tool mutations (no manifest set check, loose
  member names, keeping staging, following symlinks) each fail a test.
- The firewall rejects `database-backup.ts` importing `applyPendingMigrations`, and fails without the
  allowlist entry.

**Regression**:
- 37 suites that scan `scripts/`, `scripts/lib` or `infra/media-store-vps` pass.
- In the isolated worktree, `prodmig-flow/bite-proofs` reported 24 mutations bit and
  `media-vps-storage/bite-proofs` reported 16 bites.
- `tsc --noEmit` 0, `eslint` 0 on the changed files, `git diff --check` clean.

## What is not proven

- The post-seal read-back in `backupDatabase` is not pinned by a test (mutation M8 survived). A bad
  seal cannot be produced through the public path; it is a second check behind the format's own.
- No production run: the schedule is not installed, no off-site upload exists, and the media tool is
  not on the VPS (BR2-SCHEDULE-1, BR2-OFFSITE-1, BR2-MEDIA-VPS-1).
- The key has no recorded escrow (BR2-KEY-ESCROW-1).
- The full suite has not run on this change. It is V3, and the full suite runs on the pull request.

## Closure Contract (v1)

- Phase: BR-2
- Owner: apps/dashboard/scripts/lib/backup-vault.ts (vault format, key, retention), apps/dashboard/scripts/lib/database-backup.ts (scheduled database backup and verified restore), apps/dashboard/scripts/backup-vault.ts (operator CLI), infra/media-store-vps/hebun_media_backup.py (media snapshot and restore), docs/product-vision/runtime/hebun-backup-recovery-runbook.md
- Reached state: VERIFIED
- Implementation commit: THIS COMMIT
- Verification level: V3 — the change builds a path that will read the production database and hold tenant data at rest, and adds a named importer to the migration-module firewall; full suite justified on the pull request for that reason
- Verification evidence: locally, tests/br2-backup-vault/vault.ts PASS, database-backup-postgres.ts PASS, media-backup-chain.ts PASS (python unittest 16 OK); infra test_hebun_media_backup.py 16 OK on Python 3.9.6 and 3.13.9; mutations 13/14 bit (M8 post-seal read-back survived, recorded); firewall negative checks 2/2; 37 affected suites PASS; prodmig-flow bite-proofs 24/24 and media-vps-storage bite-proofs 16 bites in an isolated worktree; CLI smoke on disposable databases; tsc --noEmit 0, eslint 0, git diff --check clean
- Test environment: isolated worktree in the session scratchpad from 8b0b5373 plus an isolated detached mutation worktree, macOS Darwin 25.2.0, Node 24.16.0, Python 3.9.6 and 3.13.9, disposable PostgreSQL 18.6 cluster at 127.0.0.1:55432 (initdb -E UTF8 --locale=C, system_identifier proven) stopped and deleted after use; 21 GiB free; no production access, no real dump, no tenant data, no credential, no network beyond loopback
- Deployment evidence: N/A — not deployed
- Production acceptance evidence: N/A — synthetic data only; schedule, off-site upload and VPS deployment not authorized
- Deferred risks: BR2-SCHEDULE-1 (DEFERRED); BR2-OFFSITE-1 (DEFERRED); BR2-MEDIA-VPS-1 (DEFERRED); BR2-KEY-ESCROW-1 (DEFERRED); BR2-SEAL-READBACK-PIN-1 (DEFERRED)
- Director approvals: PACKAGE 4 / CONTINUE DEVELOPMENT, local implementation and targeted validation, 2026-11-09; BR-2 CONTINUATION, commit, push and one draft pull request, 2026-11-09; merge, full suite, schedule installation, off-site upload, VPS deployment NOT approved

### Deferred risk detail

- **BR2-SCHEDULE-1 (DEFERRED).** `backup-db` is a schedulable unit with a launchd template in the
  runbook, but it is not installed, and no production backup has run through it. Acceptance
  dependency: a Director decision to install it with `DATABASE_URL` available to launchd, then a
  first production run read back with `verify`.
- **BR2-OFFSITE-1 (DEFERRED).** Sealed files stay on the backup host, and one disk is not a backup.
  Acceptance dependency: a Director decision on provider, location and cost, then an upload of
  `.hbk` files only.
- **BR2-MEDIA-VPS-1 (DEFERRED).** `hebun_media_backup.py` is not deployed and no production media
  snapshot exists. Acceptance dependency: a Director-approved VPS deployment and a first snapshot,
  verified after sealing.
- **BR2-KEY-ESCROW-1 (DEFERRED).** Losing the vault key loses every backup sealed with it.
  Acceptance dependency: a Director decision on where the second copy lives, recorded by key id only.
- **BR2-SEAL-READBACK-PIN-1 (DEFERRED).** Mutation M8 (removing the post-seal decrypt in
  `backupDatabase`) survives, because the public path cannot produce a bad seal. Acceptance
  dependency: a fault-injection seam, if the Director judges it worth its cost.

## Weekly three questions

1. **What did we learn?** GCM releases plaintext before it authenticates, so fail-closed means
   writing to a part file and renaming only after `final()` and the digest. And a digest check behind
   an authenticated header can be tested only by forging a file with the key, which the test holds.
2. **How does this improve Turkish Rug House?** TRH's database and media can now be backed up so that
   a stolen copy is unreadable and a damaged copy is refused before it is restored.
3. **How does this become part of Hebun AI?** One vault format and one runbook serve every tenant's
   backups. Schedule, off-site copy and paired restore (BR-5) build on this format.
