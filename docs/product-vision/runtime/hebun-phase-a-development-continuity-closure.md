# PHASE A — Development Continuity · closure record · DEPLOYED

The first closure record written under `docs/MASTER-ROADMAP.md` §16.1, and the first one the
continuity test validates. The change was implemented, verified, committed as `97cc7a83`, pushed to
`main` by the Director and deployed to Production by the existing Vercel integration (§8). It is not
production-accepted: Phase A changes no runtime behaviour, so there is nothing in production to accept.
The record was first committed with that same commit and named it `THIS COMMIT` (§16.1 rule 4); this
later documentation change writes the real hash, as rule 4 requires.

## 1 · What was wrong, measured

Measured read-only on 2026-10-12 against published `main` `7437280e` (production deployment of the same
commit: GitHub deployment `6999968257`, environment Production, state `success`).

- The roadmap fell behind releases three times and was repaired by bulk catch-up each time
  (`098d49e`, `dd20b62d`, then AP-1 `4d5d509b`). Twenty-one later commits and more than ten phases
  appear nowhere in it.
- Five releases have no closure record (`71c8a034`, `c6c6a54d`, `d40f6c59`, `a091d79b`, `9e839e1f`).
- Deferred risks have no owner. Of the five issues raised about the Content Agent's Instagram
  publication, three are recorded nowhere.
- The primary working tree is 190 commits behind `origin/main` and holds 103 uncommitted lines of
  `learnings.md`, because `hebun-loop.md` pointed every session at that single copy.
- Test levels "L1–L3" were used by four closure records and defined only in machine-local memory, under
  a name the roadmap already gives to the Era I milestones `L1`–`L4` (§10, §17).
- No rule was checked by anything. There is no CI.

## 2 · What changed

| File | Authority | Change |
|---|---|---|
| `CLAUDE.md` | Permanent instructions | "Faz Sözleşmesi": truth-recovery order, local vs remote vs production, V0–V3, closure rule, memory not authoritative. `learnings.md` is written in the phase's own worktree. |
| `hebun-loop.md` | Director Loop | Orient, Plan, Persist and Close steps point at the contract; `learnings_file` is the worktree's own copy. |
| `docs/MASTER-ROADMAP.md` | Phase lifecycle and navigation | §16.1 Closure Contract v1 (states reconciled with §16 and §9, evidence rules, deferred-risk lifecycle, exact enforcement); §21 Phase Closure Index; §22 Deferred Risk Index. Additions only. |
| `apps/dashboard/tests/development-continuity/closure-contract.ts` | Existing test runner | Validates the repository against §16.1 and proves every check bites on disposable fixtures. |
| this file | Closure evidence | Phase A's own record. |
| `learnings.md` | Engineering lessons | One appended entry, in this worktree. |

No runtime code, schema, migration, provider connection, Governance authority or production state was
touched.

## 3 · Decisions

- **States are not new.** The six reached states are §16's Verified / Released / Deployed /
  production-accepted plus §9's `DESIGN ONLY` and `IMPLEMENTED`. The Director's "DESIGNED" is §9's
  `DESIGN ONLY`; "TESTED" is §16's "Verified".
- **Legacy boundary = census, not git, not a list.** A git boundary fails open under shallow clones,
  worktrees and detached HEADs. A 164-name list is a second copy of the tree. A count plus a SHA-256 of
  the sorted paths needs no git, is two constants, and fails closed on a new unmarked record, a deletion,
  a rename or a move. The census guards the **set** of legacy records, not their content. This record
  owns the pinned values, which change only through the §16.1 legacy-maintenance procedure:

  Legacy census: 164 records, sha256 754f7b397a6594b4e65f4a500373016db9dbe859e7c245e1cb97432f10d7d48b
- **§22 copies, never sets.** The detail record owns the disposition; the test fails if the index
  disagrees with it.
- **V0–V3, not L0–L3.** `L1`–`L4` are Era I milestones.

## 4 · Acceptance matrix

| # | Scenario | Expected behaviour | Owner | Enforcement | Known limitation |
|---|---|---|---|---|---|
| 1 | New session recovery | Recovery order read from `CLAUDE.md` | `CLAUDE.md` | Documented; executed read-only in three trees | Trees older than this contract never read it (CONTINUITY-STALE-PRIMARY-TREE-1) |
| 2 | Stale local `main` / stale instructions | `git diff --quiet "$B" -- CLAUDE.md hebun-loop.md docs/MASTER-ROADMAP.md` flags it; consequential mutation stops; current text read with `git show` | `CLAUDE.md` | Documented; executed (primary flagged, current worktree clean); not automatic | Same as 1 |
| 3 | Concurrent worktrees | Lessons and closure in the phase branch; no foreign writes | `CLAUDE.md`, loop | Documented; test reads only its own tree | Appends in two branches may conflict textually |
| 4 | Missing closure | Phase not reported complete | `CLAUDE.md`, §16.1 | Documented | Test cannot see a phase with no file at all |
| 5 | Missing roadmap entry | Rejected | §16.1 | Test: `ROADMAP_POINTER_MISSING` | — |
| 6 | Missing mandatory evidence | Rejected | §16.1 | Test: `MISSING_FIELD`, `VERIFICATION_EVIDENCE_REQUIRED` | — |
| 7 | False production claim | Rejected | §16.1 | Test: `PRODUCTION_EVIDENCE_REQUIRED`, `CLAIM_EXCEEDS_STATE` | Truth of evidence is a Director judgement |
| 8 | Risk without a valid source | Rejected | §16.1, §22 | Test: `RISK_DETAIL_MISSING`, `RISK_DETAIL_LACKS_ID`, `DEFERRED_RISK_NOT_INDEXED` | — |
| 9 | Closure without marker | Rejected | §16.1 | Test: `LEGACY_CENSUS_CHANGED` | A closure not named `*-closure.md` is outside scope |
| 9a | Legacy record renamed, moved or removed | Rejected | §16.1, §18 rule 3 | Test: `LEGACY_CENSUS_CHANGED` | Content edits to a legacy record are not detected (census guards the set) |
| 9b | Legitimate legacy maintenance | Accepted only when an approved contract record states the new census | §16.1 | Test: `LEGACY_CENSUS_UNRECORDED` | The test proves the change is recorded, not that it was approved |
| 10 | Legacy compatibility | Unchanged, unchecked fields | §18 rule 3 | Test: legacy-only fixture passes, census pinned | — |
| 11 | Design-only closure | Valid with `N/A` commit | §16.1 | Test: valid shape | — |
| 12 | Implemented, not deployed | Valid; deployment `N/A` | §16.1 | Test: valid shape | — |
| 13 | Documentation-only change | V0 checks only | `CLAUDE.md` | Documented | — |
| 14 | Release with valid evidence | Valid | §16.1 | Test: released and production-accepted shapes | — |
| 15 | Runner fails correctly | Non-zero exit, failing name printed | `scripts/run-tests.mjs` | Measured (§5) | — |
| 16 | Git history missing | Unaffected | test | No git used | — |
| 17 | Conflicting roadmap status | Rejected | §16.1, §21 | Test: `ROADMAP_STATE_MISMATCH`, `ROADMAP_PHASE_MISMATCH` | — |
| 18 | Director release gates | Unchanged | `CLAUDE.md` | Human-approved | A record documents approvals, never grants them |

## 5 · Verification

Recorded in the contract below; each line is a command that ran, with its exit code.

## 6 · Deferred risks

- **CONTINUITY-STALE-PRIMARY-TREE-1 (DEFERRED).** A session uses the `CLAUDE.md` of the tree it opened in,
  and a running session does not reload it. The staleness check in `CLAUDE.md` step 1 therefore protects
  only trees that already contain it. Measured: the check, run read-only, flags the primary tree
  (`e96dd365`; roadmap 383 lines behind) and passes an up-to-date worktree (`7437280e`). But the primary
  tree and all 114 existing worktrees predate this contract, so a session opened in any of them never
  reads the check. Every worktree created from `main` after Phase A is released carries it. Bringing the
  primary tree forward touches another session's uncommitted work and is Phase B, behind a Director
  decision.
- **CONTINUITY-NO-CI-1 (DEFERRED).** The continuity test runs only when the test runner runs. Nothing
  runs it automatically; the Vercel build type-checks it but does not execute it. Adding CI is a new
  integration and a Director decision.
- **CONTINUITY-CODE-DEFERRED-SCAN-1 (DEFERRED).** Deferred risks written only in code comments (for
  example `deferred: CONTENT-PUBLICATION-CROSS-REVISION-DUPLICATE-1`) are not scanned. Scanning them now
  would fail on historical risks that are not yet indexed; registering those is Phase B.

## 7 · Not done here (Phase B)

Roadmap catch-up for the phases missing since AP-1; closure records for the five releases without one;
a record for the Content Agent's Instagram publication; indexing historical deferred risks; the primary
tree's stranded `learnings.md` lines and stale `main`; `MEMORY.md` compaction; worktree cleanup.

## 8 · Release

| Evidence | Value | Source |
|---|---|---|
| Implementation commit | `97cc7a838b034542315450aca2735f96a1634d86` (parent `7437280e`) | git |
| Push | 2026-10-12T11:00:20Z, `7437280e → 97cc7a83` on `main`, by `hebuntech` from the Director's terminal | GitHub branch activity |
| Remote `main` after push | `97cc7a838b034542315450aca2735f96a1634d86` | `git ls-remote` |
| Production deployment | GitHub deployment `7012484419`, environment Production, sha `97cc7a83`, created by `vercel[bot]` 2026-10-12T11:04:32Z | GitHub Deployments API |
| Deployment status | `success`, 2026-10-12T11:04:33Z | GitHub deployment statuses |
| Vercel commit status | `Vercel` = `success` ("Deployment has completed"), combined `success` | GitHub commit status |
| Superseded | No: `7012484419` was the newest Production deployment when this record was written | GitHub Deployments API |

The Vercel API itself was not reachable from this machine's connector, so Vercel's own `dpl_` identifier
was not read directly; the evidence above is what Vercel reported to GitHub.

## Closure Contract (v1)

- Phase: PHASE-A-DEVELOPMENT-CONTINUITY
- Owner: CLAUDE.md + hebun-loop.md + docs/MASTER-ROADMAP.md §16.1/§21/§22 + apps/dashboard/tests/development-continuity
- Reached state: DEPLOYED
- Implementation commit: 97cc7a838b034542315450aca2735f96a1634d86
- Verification level: V1 — documentation plus one new test file; no runtime, schema, provider or authority change
- Verification evidence: `npx tsc --noEmit` exit 0; `npx eslint tests/development-continuity/closure-contract.ts` exit 0; `git diff --check` exit 0; roadmap diff additions only (0 deleted); `node --import tsx tests/development-continuity/closure-contract.ts` exit 0 (repository valid, 5 valid shapes pass, 24 defects each rejected by its own code, 11 legacy-maintenance fixtures behave as §16.1 requires); eight maintenance scenarios on disposable copies of the real docs, one process each: unchanged 0, renamed 1, moved 1, removed 1, new unmarked 1, new valid contract 0, new invalid contract 1, legitimate maintenance 0 (unrecorded census 1); `scripts/run-tests.mjs` on a copy with a moved legacy record → `FAILED tests/development-continuity/closure-contract.ts (exit 1)`, runner exit 1; on a valid copy → `1 passed`, runner exit 0; staleness check executed read-only: primary tree flagged, current worktree clean; before their lines existed this record was rejected for PENDING evidence (`VERIFICATION_EVIDENCE_REQUIRED`) and for an unstated census (`LEGACY_CENSUS_UNRECORDED`)
- Test environment: worktree `.claude/worktrees/phase-a-continuity` at 7437280e plus uncommitted Phase A changes; macOS (Darwin 25.2.0); Node v24.16.0; tsx from the shared `apps/dashboard/node_modules` (dependency set equal to 7437280e); no database, network or credentials
- Deployment evidence: GitHub deployment 7012484419, environment Production, sha 97cc7a838b034542315450aca2735f96a1634d86, status success 2026-10-12T11:04:33Z; Vercel commit status success (§8)
- Production acceptance evidence: N/A — no runtime behaviour to accept
- Deferred risks: CONTINUITY-STALE-PRIMARY-TREE-1 (DEFERRED); CONTINUITY-NO-CI-1 (DEFERRED); CONTINUITY-CODE-DEFERRED-SCAN-1 (DEFERRED)
- Director approvals: Phase A implementation approved 2026-10-12; final acceptance reviewed 2026-10-12; one local commit of the six Phase A files approved 2026-10-12; push of 97cc7a83 to main and its automatic Production deployment approved 2026-10-12, push executed by the Director from the terminal; this documentation commit approved 2026-10-12, its push NOT approved
