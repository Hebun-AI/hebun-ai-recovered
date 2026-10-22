# SH1-PG-CEREMONY-TLS-1 · closure record · VERIFIED (local) · production acceptance PENDING

The production migration ceremony's backup (`pg_dump`, libpq) now reaches a remote target only with
verified TLS. Before this change libpq received `sslmode=require` (encrypted, but neither certificate
chain nor host name checked, since no root file is configured) or whatever weaker mode the URL named.
The ceremony's own `pg.Client` already verified fully; only the libpq connection did not.

## 1 · What was implemented

| Commit | Content |
|---|---|
| `fb87d622` (branch `fix/sh1-pg-ceremony-tls-1`), integrated here as THIS COMMIT on top of the SECURITY-HARDENING-1 records `adfc140d` → `38e8e597` → `dccdf564` | `scripts/lib/production-migration.ts`: a remote target always gets `PGSSLMODE=verify-full` and `PGSSLROOTCERT=system`; a URL naming any weaker mode is refused as backup refusal `tls-unverified` before any tool runs; the remote `pg_dump` child no longer inherits `PG*`, `SSL_CERT_FILE` or `SSL_CERT_DIR`. Loopback rehearsals are unchanged. New `tests/prodmig-flow/backup-tls.ts`; bite-proofs M19–M24; the `canonical-prefix-postgres.ts` pin that let a remote `sslmode=disable` win is changed on purpose. |

**Authorities reused, unchanged.** Possession (`production-possession.ts`), posture and locality
(`ceremony-preflight.ts`), the canonical prefix proof, the advisory lock, the server-version gate and the
backup-before-prompt order in `platform-migrate.ts`. No runtime connection, `DATABASE_URL`, schema,
migration or `src/` change. The same TLS contract also governs the `--stage backup` paths of
`mv7-production-acceptance.ts` and `i2v-production-acceptance.ts`, which call `createValidatedBackup`.

**Operational consequence.** A ceremony connection string that still says `sslmode=require` (Neon's
default) now refuses the backup with `tls-unverified`; it must say `sslmode=verify-full` or name no mode.
The refusal happens before the confirmation prompt, so nothing is migrated.

## 2 · Verification (V3, targeted)

V3 because it is a security and execution boundary of the migration ceremony. The full suite was not
re-run: the integration changes only the four files above plus documentation, so the full-suite evidence
of SECURITY-HARDENING-1 at `a6ba1dae` (1067 PASS / 2 FAIL of 1069, 0 REGRESSION) is reused for everything
outside `tests/prodmig-flow/`, and the prodmig suites were run directly.

| Check | Result |
|---|---|
| `tsc --noEmit` | 0 |
| `eslint` on the four changed files | 0 |
| `tests/prodmig-flow/backup-tls.ts` | OK |
| `tests/prodmig-flow/boundaries-and-firewall.ts` | OK |
| Bite-proofs M19–M24 (applied one at a time against `backup-tls.ts` in a scratch copy; source restored, suite OK after) | 6 of 6 bite |
| `tests/prodmig-flow/canonical-prefix-postgres.ts`, `server-version-gate.ts`, and the full bite-proof harness M1–M18 | BLOCKED — they need disposable Postgres databases; no database connection was authorized for this consolidation. The changed `canonical-prefix-postgres.ts` assertions are the pure, database-free section 6 |
| Development continuity (`tests/development-continuity/closure-contract.ts`) | see contract |
| `git diff --check` | clean |

**What this does not prove.** No real TLS handshake was made. The tests prove the environment the code
hands to `pg_dump`, read back from a recording stub. A successful node-postgres connection is not
evidence either: `pg` uses Node's bundled roots, libpq uses the linked OpenSSL's `cert.pem`.

## Closure Contract (v1)

- Phase: SH1-PG-CEREMONY-TLS-1
- Owner: apps/dashboard/scripts/lib/production-migration.ts (libpqEnvFor, libpqChildEnv, createValidatedBackup) under the production migration authority of scripts/platform-migrate.ts
- Reached state: VERIFIED
- Implementation commit: THIS COMMIT — integrates fb87d622 onto dccdf564 on local branch integrate/sh1-final-consolidation, not pushed
- Verification level: V3 — security boundary of the migration ceremony backup; targeted suites, full-suite evidence of a6ba1dae reused because only tests/prodmig-flow and scripts/lib/production-migration.ts changed
- Verification evidence: tsc 0; eslint 0 on the four changed files; backup-tls OK; boundaries-and-firewall OK; bite-proofs M19–M24 6/6 bite; canonical-prefix-postgres, server-version-gate and bite-proofs M1–M18 BLOCKED (no database authorized); development continuity PASS; git diff --check clean
- Test environment: worktree `.claude/worktrees/sh1-final-consolidation` and a scratch copy of apps/dashboard for the bite-proofs; macOS (Darwin 25.2.0); Node 24.16.0 with tsx; no database, no network, no provider
- Deployment evidence: N/A — not deployed
- Production acceptance evidence: N/A — not deployed; no real libpq handshake with the provider was made
- Deferred risks: SH1-PG-TLS-ACCEPTANCE-1 (DEFERRED); SH1-PG-TLS-CEREMONY-ENV-1 (DEFERRED); SH1-PG-SSLMODE-1 (DEFERRED)
- Director approvals: read-only release readiness and acceptance design (2026-10-22); one isolated local consolidation of adfc140d, 38e8e597, dccdf564 and fb87d622 with minimal documentation and one local commit (2026-10-22); push, deployment, database connection, migration and production environment change NOT approved

### Deferred risk detail

- **SH1-PG-TLS-ACCEPTANCE-1 (DEFERRED).** The real libpq security contract against the provider is
  unmeasured. Closes on a Director-authorized acceptance: the chosen `pg_dump` (Homebrew
  `postgresql@18`, linked to openssl@4 whose `cert.pem` is the `ca-certificates` bundle) succeeds with
  `verify-full` + `system` roots, and fails on a wrong root and on a host-name mismatch, followed by the
  first real ceremony backup through `createValidatedBackup`. Until then the migration backup path is
  not production-accepted.
- **SH1-PG-TLS-CEREMONY-ENV-1 (DEFERRED).** Whether `apps/dashboard/.env.ceremony.local` names
  `sslmode=verify-full` (or no mode) is unmeasured. Closes by a value-free check through `libpqEnvFor`
  before the next ceremony; changing the file is a Director-gated local secret change.
