# Package 4 — Backup & Restore Readiness · DISCOVERY (read-only)

Measured at `main` `22cb7617`, 2026-11-09, from repository text only. No database, VPS, Vercel or
provider was contacted; nothing here is a measurement of production. Where the repository is silent
the answer is `UNAVAILABLE`, never assumed. This is a discovery record, not a closure record.

## Current reality

| Area | State | Evidence |
|---|---|---|
| Production PostgreSQL | Neon `neondb`, PG 18.6, sysid 7675444875863894887; region UNAVAILABLE | `docs/MASTER-ROADMAP.md` (production ledger), `hebun-ap1-plurality-foundation.md` |
| Provider PITR / history retention | UNAVAILABLE — never recorded or confirmed | no mention in repo |
| Database backups | Only around production migration ceremonies: `createValidatedBackup` runs `pg_dump --format=custom` over `sslmode=verify-full`, never overwrites, writes to `~/Developer/hebun-backups` on the Director's machine | `apps/dashboard/scripts/lib/production-migration.ts` (`BACKUP_ROOT`, `createValidatedBackup`) |
| Backup frequency / retention | None scheduled; no retention or rotation rule | — |
| Restore procedure | ABSENT. Validation is `pg_restore -l` (lists the archive, restores nothing); no runbook; no restore ever run | `tests/prodmig-flow/backup-tls.ts` ("NO RESTORE") |
| Media objects (VPS) | `/var/lib/hebun-media` on one Hostinger VPS; write-once, SHA-256 per object; **not backed up**, Hostinger daily backup off | `infra/media-store-vps/README.md` "Backup truth" |
| Rows ↔ files | Per read: size + SHA-256 must match the `media_assets` row, else `integrity-mismatch` / `object-absent`. No bulk reconciliation, no scrub | `read-media-assets.server.ts` |
| RPO / RTO | ABSENT — no target anywhere | — |
| Backup security | In transit: verify-full TLS, password via env not argv. At rest: unencrypted dumps on one laptop, no off-site copy | `production-migration.ts`, `backup-tls.ts` |
| Roadmap | §13.1: "no backup, restore or failover path exists anywhere today"; §22 has no backup/DR row | `docs/MASTER-ROADMAP.md` §13.1, §22 |

## Real gaps

1. Data loss between migration ceremonies is unbounded: no scheduled database backup.
2. Neon PITR window, plan and region are unconfirmed.
3. No dump has ever been restored; a backup is unproven until it is.
4. Dumps are unencrypted, single-copy, on one laptop, with no retention.
5. Media bytes have no backup at all; one VPS disk loss loses every object.
6. No sweep finds rows without files or files without rows.
7. No RPO/RTO, so no backup design can be judged sufficient.
8. Database and media are not captured at a paired point in time; restoring one alone yields
   `object-absent` rows or untracked files.
9. SH1-PG-TLS-ACCEPTANCE-1 (verify-full against the provider) is still DEFERRED.

## First package — smallest safe step

**BR-1 Restore drill.** A local script that restores an existing ceremony dump into a disposable
PostgreSQL 18.6 cluster, checks it (migration ledger rows equal the dump's, table row counts, tenant
count), records elapsed time as the first measured RTO, and drops the cluster. Why this first:

- It turns gap 3 from unknown to measured, and every later backup design depends on it.
- No production access: it reads a dump already on disk; no credential, no network, no provider.
- No schema, migration or runtime change; nothing deploys.
- Its failure modes are local (disk: the drill refuses below a free-space floor, ENOSPC precedent).

Director decisions needed before BR-1 code: which dump file it may read (it holds production
tenant data, so it stays local and its contents are never printed), and the free-space floor.

## Later candidates (each its own gate, not scheduled)

- BR-0: read-only confirmation of Neon plan, PITR window and region from the provider console;
  record RPO/RTO targets as a Director decision.
- BR-2: media reconciliation report (rows vs objects, digest scrub), read-only on the VPS.
- BR-3: scheduled encrypted off-site database backup (new integration and cost — Director gate).
- BR-4: media backup (Hostinger backup or off-site copy — cost and data-location gate).
- BR-5: paired DB + media restore drill.
