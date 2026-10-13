# EAI-WORK-PLANNING-CEREMONY-1 · Controlled Agent Reasoning phase 6, Gate A · closure record · VERIFIED

The existing tenant external-AI data-use ceremony can now grant and revoke `work-planning ×
operational-record`. No new authorization mechanism: the same CLI, the same released writer, the
same Governance decision. Implemented and tested against disposable PostgreSQL 18 databases only.
**No tenant was granted anything, no production migration ran, nothing was pushed or deployed, no
provider was called.**

## 1 · Baseline (measured 2026-10-13, Phase 0 of the Phase 6 brief)

- `origin/main` `64ffae70`; production deployment `dpl_J6wo4XGH32cpf22UNr9qfskimcPi` READY at
  `64ffae70` (www and apex). Branch `docs/heby-ai-planning-phase1` at `a27e5ad4`, clean, not pushed.
- Production, read-only (`default_transaction_read_only=on`, counts and ids only): ledger 76, newest
  hash equal to the local L-1b file; purpose CHECK the four earlier purposes; zero `work-planning`
  scopes; attestation `ffb0c160` revision 1 active, `model_ids [claude-haiku-4-5-20251001]`; Hebun
  (`f625b683`) in force at authorization revision 3 (`b2de774d`: assistance ×3, agent-origination ×3);
  `claude` Director control on, `machine-internal-execution` off. `HEBUN_MODEL_ID` is a Vercel
  *sensitive* variable and cannot be read back; the production model is evidenced by the EAI audit
  records instead (`claude-haiku-4-5-20251001`, last call 2026-10-12).

## 2 · The extension

`scripts/eai-authorize-tenant-external-ai-data-use.ts` and `scripts/lib/tenant-data-use-scopes.ts`:

| Change | Behaviour |
|---|---|
| `--work-planning` | A third closed purpose switch. The pair is read off the recorded policy and must be exactly `operational-record` (`EXPECTED_DATA_CLASSES`). |
| one purpose per run | `--agent-origination` with `--work-planning` is refused before anything is read. |
| grant | A new revision holding the UNION of what is in force and `work-planning × operational-record` (`nextRevisionScopes`, unchanged). |
| `--revoke` with a purpose switch | A new revision holding what is in force MINUS that purpose (`revisionScopesWithout`). Every other purpose stays. Refused with no purpose, with `--withdraw`, when the purpose is not in force, and when it is the only purpose (that is a withdrawal). Its own typed phrase: `REVOKE EXTERNAL AI DATA USE`. |
| `--withdraw` | Unchanged: removes everything. |

Not changed: the writer, the reader, the composer, the policy, the attestation, the membership
lookup, the TTY and `NODE_ENV=production` refusals, the dry run by default, the typed phrase, the
read-only SQL. Still no flag carries a scope, purpose, class or attestation as a value.

## 3 · Tests

**New:** `tests/eai-work-planning-purpose/ceremony-postgres.ts` runs the **real CLI** on a
pseudo-terminal (`script(1)`; the ceremony refuses a pipe by design) against a disposable
PostgreSQL 18 with the reviewed attestation admitted by the real ceremony library and two
Governance organizations:

| Requirement | Proved |
|---|---|
| Explicit tenant selection | `--tenant` slug resolved server-side; the grant lands on A only; B stays `absent`; no other tenant holds a `work-planning` row |
| Trusted operator identity | a person with no membership in the named organization, or no membership at all, is refused; the writer still decides Governance |
| Exact purpose and class | dry run shows `added work-planning × operational-record`, the six pairs in force `kept`; a `--purpose=` value is refused |
| Exact provider scope | `anthropic/messages`, the attestation in force, inside its bounds |
| Revocation | `--revoke` restores exactly the six earlier pairs, in order; work-planning → `tenant-not-authorized`; origination still `authorized`. `--withdraw` → everything `tenant-withdrawn` |
| Audit | one Governance session per write; every revision names its decision |
| Wrong tenant | refused, nothing written |
| Missing attestation | a withdrawn attestation stops the disclosure (`platform-unknown`) and refuses the ceremony before any write |
| Assistance unchanged | `assistance × conversation` authorized; `assistance × operational-record` `platform-unknown` |
| No write on refusal | eight refusals and a dry run leave authorizations, scopes and Governance sessions unchanged |

**Changed:** `tests/external-ai-data-use-tenant-ceremony/ceremony-boundary.ts` pins the eight flags,
the three-way purpose switch, the two-switch refusal, the `work-planning` cell and the revoke branch.

**Bite-proofs** (applied by md5, the suite exits 1, restored by `cmp`): C1 revoke drops every
purpose; C2 a grant replaces what is in force; C3 two purpose switches accepted; C4 `--work-planning`
resolves to assistance.

## 4 · Rollback risk: measured, not inferred

A probe ran the **released `64ffae70` reader** (a detached worktree) against a disposable database
written by this branch:

| State | `64ffae70` reader |
|---|---|
| assistance only | `read` |
| + `work-planning × operational-record` | **`unavailable`** |
| `work-planning` revoked (`--revoke`) | `read`, the three assistance pairs |

`unavailable` makes the composer refuse **every** model call for that tenant: assistance, origination
and AI planning. It fails closed, so nothing leaks, but Heby loses its model for that organization.

Consequences for release:

- **Rollback floor.** Once any tenant holds `work-planning`, no deployment older than `a27e5ad4` may
  serve production. That includes Vercel *Instant Rollback* to `dpl_J6wo4XGH…`.
- **Safe rollback procedure.** First run `--work-planning --revoke` for every tenant that holds it,
  then roll back. Proved above.
- **Order.** Grant only after the code that knows the purpose is serving production and observed
  healthy, so the rollback need is settled before the grant.
- **Not done.** Making the reader skip unknown purposes would protect future additions but not a
  rollback to `64ffae70`, which already has the strict reader. It also changes a security reader's
  fail-closed rule, so it is left as a Director decision (RELEASE-ROLLBACK-FLOOR-1).

## 5 · Regression

Run sequentially against PostgreSQL 18 at 127.0.0.1:5432, `node scripts/run-tests.mjs`, on
`a27e5ad4` plus this change: **978 pass / 47 fail**, against the clean `ef48cb4a` baseline's 977 / 46.

- The 46 baseline failures fail on both trees with the same first error line (compared mechanically).
- **One failure was new, and it was genuine:** `google-capability-scope-repair-1/scope-composition`
  pins `src/db` against `4059a176` with `git diff`, which ignores untracked files. During the Phase 5
  full run migration 77 was still uncommitted, so the pin passed; once `a27e5ad4` committed it, the
  pin failed. **The Phase 5 record's "no suite fails only on the change" was therefore incomplete.**
  Fixed in its own commit, `6d7acbd0`, by allowing the migration-77 files exactly as L-1b's were
  allowed; the suite passes alone.
- After both commits, the seven suites that read git state (`ge1-ledger`, `r7-1-flow`, `sia1`,
  `sia2`, `sia31` bite-proofs, `development-continuity`, `google-capability-scope-repair-1`) were
  re-run on the committed tree: six pass; `r7-1-flow/boundaries-and-firewall` fails exactly as on the `ef48cb4a` baseline (same first error, a stale list of later migrations it does not own).
- The new ceremony suite, the migration suite and the ceremony boundary pass in the full run.
- `hebun_test_*` stayed at 167 before and after; no `42501`.
- `tsc --noEmit` exit 0; `eslint` exit 0 on the four touched files.

## Closure Contract (v1)

- Phase: EAI-WORK-PLANNING-CEREMONY-1
- Owner: apps/dashboard/scripts/eai-authorize-tenant-external-ai-data-use.ts and scripts/lib/tenant-data-use-scopes.ts
- Reached state: VERIFIED
- Implementation commit: 2daf4544
- Verification level: V3 — a tenant authorization ceremony that writes Governance decisions and EAI scopes. Run end to end on PostgreSQL 18 with bite-proofs, the old-code rollback probe and the full suite.
- Verification evidence: tests/eai-work-planning-purpose/ceremony-postgres.ts exit 0 (real CLI on a pseudo-terminal, disposable PostgreSQL 18); four bite-proofs exit 1 (applied by md5, restored by cmp); rollback probe with the released 64ffae70 reader: read → unavailable with a work-planning scope → read after --revoke; full suite on a27e5ad4 + this change 978 / 47 vs ef48cb4a 977 / 46, the one change-only failure a genuine git-diff pin fixed in 6d7acbd0 and re-run; the seven git-state suites re-run on the committed tree (six pass, r7-1-flow baseline-red with the same first error); hebun_test_* 167 before and after, no 42501; tsc --noEmit exit 0; eslint exit 0 on touched files; development-continuity closure-contract exit 0
- Test environment: worktree `.claude/worktrees/heby-ai-planning-phase1` at a27e5ad4 plus this change; detached `64ffae70` worktree in the session scratchpad for the rollback probe (removed after); macOS (Darwin 25.2.0); tsx from the shared `apps/dashboard/node_modules`; PostgreSQL 18.0 at 127.0.0.1:5432 through `HEBUN_TEST_ADMIN_DATABASE_URL`; `script(1)` pseudo-terminal; no provider, no credential; production read only, as counts and ids
- Deployment evidence: N/A — not deployed
- Production acceptance evidence: N/A — no tenant granted, migration 77 not applied to production
- Deferred risks: EAI-WORK-PLANNING-CEREMONY-1 (CLOSED); RELEASE-ROLLBACK-FLOOR-1 (DEFERRED); AI-PLAN-TITLE-PII-1 (DEFERRED); AI-PLAN-INDIRECT-PROFILING-1 (DEFERRED); AI-PLAN-RUNTIME-BROWSER-1 (DEFERRED)
- Director approvals: the ceremony extension, its tests and a separate local commit (GATE A — DIRECTOR DECISION, 2026-10-13); the pin fix 6d7acbd0 is a test-only correction this record discloses; push, deploy, production migration, tenant grant and any provider call NOT approved
