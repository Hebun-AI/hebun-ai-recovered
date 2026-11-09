# CI-QUALITY-GATES-1 — Package 3 closure

Pull request checks for `apps/dashboard` on GitHub Actions, enforced on `main` by the ruleset
`HEBUN-MAIN-QUALITY-GATE`: `quick` and `targeted` on every pull request update, and the full suite on
a disposable PostgreSQL when the `full-suite` label is added. Package 3 also repaired the regressions
the first CI runs exposed (M2-R1…R10E) and the bite-proof child hang (candidate A: each defended suite
is bundled with esbuild 0.25.12 after its mutation reaches disk and runs on plain node, no loader).

Released through PR #1 as merge commit `22cb7617` (parents `26a672c4`, `bfc7103d`) and deployed to
production. Production acceptance of the runtime fixes is **not** proven; see CIQG1-PROD-ACCEPTANCE-1.

## What is proven

- Run 42555614610 (full-suite, head `bfc7103d`): 1142 passed, 0 failed, 2 excluded, 0 not run,
  1144 total; `TIMED OUT` 0; tree unchanged after the suite.
- Run 42541663782 (ci, head `bfc7103d`): quick and targeted SUCCESS.
- The two exclusions are the ones already in `apps/dashboard/scripts/ci/suite-exclusions.json`;
  none was added.
- A check reported by a `labeled` event satisfies the ruleset's required status check: PR #1 moved
  from `BLOCKED` to `CLEAN` once full-suite reported on `bfc7103d`. The note in `full-suite.yml`
  that this "is not yet proven" is answered here; the workflow comment itself is left unchanged.
- Previous full-suite at `af0b905d` (run 42527472169): 0 timeouts, one deterministic failure — the
  membership dependency guard rejected the new `esbuild` devDependency — fixed in `bfc7103d`. The
  guard still rejects any other added dependency and any esbuild version other than `0.25.12`
  (four negative mutations, each failing on its own assertion).
- The development-continuity test now runs automatically: it is a step of the required `quick` check
  (`.github/workflows/ci.yml`, "Development continuity"), and `main` accepts changes only through a
  pull request with that check green. CONTINUITY-NO-CI-1 is therefore closed by this phase, and the
  "no CI" sentences in §16.1, `CLAUDE.md` and the continuity test header are corrected in this change.

## What is not proven

- No production measurement of the runtime fixes: lost Postgres connection handling (`920efe90`),
  drizzle-wrapped unique violations as duplicates (`7ea56a2e`, `7349134a`), media v2 source
  cancellation (`3f312434`). The read-only smoke below shows the deployment serves; it does not
  exercise these paths.
- The VPS media store does not run `e8d63a4a` (bounded chunked drain for early v2 refusals). That
  change is in `infra/media-store-vps/` on `main` only; no VPS deployment was made.

## Closure Contract (v1)

- Phase: CI-QUALITY-GATES-1
- Owner: .github/workflows/ci.yml and full-suite.yml, apps/dashboard/scripts/run-tests.mjs with scripts/ci/suite-exclusions.json, apps/dashboard/tests/helpers/defended-suite-run.ts, and the GitHub ruleset HEBUN-MAIN-QUALITY-GATE on main; plus the M2 repairs in their own modules (Knowledge create, mandate/standing observation/work artifacts duplicate classification, Postgres connection loss, media v2 refusal and source cancellation)
- Reached state: DEPLOYED
- Implementation commit: bfc7103dbebfd5684b86b9665252a2e6aa9246e2 (head of 8c78bb3c..bfc7103d, 19 commits), released by merge commit 22cb7617e91f002a71a7829bfbaab09a5d869f65
- Verification level: V3 — release and execution boundary: the merge gate on main, a shared test-execution seam every bite-proof uses, and runtime fixes in media storage and Postgres connection handling; full suite justified because the phase's claim is the full suite itself
- Verification evidence: GitHub Actions run 42555614610 full-suite SUCCESS, 1142 passed / 0 failed / 2 excluded / 0 not run / 1144, TIMED OUT 0, tree unchanged; run 42541663782 quick SUCCESS and targeted SUCCESS on bfc7103d; locally on bfc7103d: tsc --noEmit 0, eslint 0, git diff --check clean, defended-suite self-test ok, TB1 12/12 bit, live-map 51/51 bit, dependency guard PASS with 4/4 negative mutations failing
- Test environment: GitHub-hosted ubuntu-24.04, Node 24.16.0, postgres:18.6 service container on 127.0.0.1:55432 (pinned by digest), contents: read, no secret; local isolated worktree in the session scratchpad on macOS Darwin 25.2.0, Node 24.16.0, disposable PostgreSQL 18.6 cluster at 127.0.0.1:55432 stopped after use; no production access
- Deployment evidence: Vercel production deployment dpl_HH3AqZDus5c9EBX23XSF4cJWEJJt (GitHub deployment 7647028082, sha 22cb7617, state success, 2026-11-09T04:28:29Z), `vercel inspect`: target production, status Ready, aliases www.hebuntech.com and hebuntech.com; read-only smoke: www / 200, /login 200, /agents and /approvals 307 to /login, apex 308 to www; previous production dpl_tN5tCL21FqZ5CzetZn8BnFZG5ZK5 (26a672c4, Ready) is the rollback reference
- Production acceptance evidence: N/A — no production measurement of the runtime fixes; smoke shows serving only (CIQG1-PROD-ACCEPTANCE-1)
- Deferred risks: CONTINUITY-NO-CI-1 (CLOSED); CIQG1-PROD-ACCEPTANCE-1 (DEFERRED); CIQG1-VPS-MEDIA-DRIFT-1 (DEFERRED); CIQG1-HANG-ROOT-CAUSE-1 (DEFERRED); CIQG1-FULL-SUITE-PER-SHA-1 (DEFERRED)
- Director approvals: CONTROLLED HANG FIX, isolated prototype only, 2026-11-08; CANDIDATE A IMPLEMENTATION, implement, validate, commit and feature push, 2026-11-08; AUTHENTICATION RECOVERY, controlled GitHub account switch and single push of af0b905d, 2026-11-08; FULL-SUITE TRIGGER, temporary account switch and single label cycle, 2026-11-08; DEPENDENCY GUARD FIX, implement, commit and feature push of bfc7103d, 2026-11-09; PACKAGE 3 FINAL VERIFICATION, single label cycle, 2026-11-09; CLOSURE PREPARATION and PATH A (merge first, closure after), 2026-11-09; PRODUCTION RELEASE, merge commit of PR #1 and the automatic Vercel production deployment, 2026-11-09; PACKAGE 3 RELEASE COMPLETE with this record and the "no CI" text correction, 2026-11-09; earlier M1–M2-R9H approvals as given in their own sessions; VPS deployment NOT approved

### Deferred risk detail

- **CONTINUITY-NO-CI-1 (CLOSED).** Registered by PHASE-A-DEVELOPMENT-CONTINUITY: nothing ran the
  continuity test automatically. Now the required `quick` check runs it on every pull request to
  `main`, and the ruleset admits no change to `main` without that pull request and check. It still
  cannot judge whether evidence is true; that stays the Director's.
- **CIQG1-PROD-ACCEPTANCE-1 (DEFERRED).** The runtime fixes are deployed but not measured in
  production. Acceptance dependency: an organic production observation of at least one fixed path
  (for example a duplicate Knowledge create answered as a duplicate rather than a 500, read from the
  runtime log); no failure is induced in production.
- **CIQG1-VPS-MEDIA-DRIFT-1 (DEFERRED).** `main` carries `e8d63a4a` in
  `infra/media-store-vps/hebun_media_store.py`; the VPS runs the earlier version. The dashboard client
  change is wire-compatible with the running server, so nothing breaks, but repository and VPS differ.
  Acceptance dependency: a Director-approved VPS deployment with its own verification.
- **CIQG1-HANG-ROOT-CAUSE-1 (DEFERRED).** Under the tsx loader, CI bite-proof children slept in futex
  with cpuMs 0 and never printed. Candidate A removes the loader from the child; the root cause inside
  the loader path was not identified. Evidence that A holds: 0 timeouts in two consecutive full runs
  (af0b905d, bfc7103d). Acceptance dependency: further full runs without a timeout; a timeout reopens
  this with the watchdog's closed hang report.
- **CIQG1-FULL-SUITE-PER-SHA-1 (DEFERRED).** The ruleset requires full-suite on the head commit with
  strict status checks, and the check starts only from a label. Every new commit on a pull request,
  documentation included, needs a new label cycle and about 50 minutes before merge. Acceptance
  dependency: a Director decision whether to keep this, or change the trigger or the rule.
- **Note on HW1-PSI-BITE-FLAKE-1** (owned by its exclusion entry, not by this phase): its reassess
  condition — "no later than the decision to make the CI suite a required check" — is now reached.

## Weekly three questions

1. **What did we learn?** A new dependency breaks every test that pins the dependency list; the guard
   was found only by the full suite, because local validation ran targeted suites alone.
2. **How does this improve Turkish Rug House?** Nothing reaches TRH's production without the full
   suite green on the exact commit, and the deployed fixes keep a lost database connection or a
   duplicate write from turning into a crash or a 500 on its paths.
3. **How does this become part of Hebun AI?** `main` has an enforced merge gate for the first time,
   and bite-proofs can no longer hang a run silently: a stuck child is stopped and described.
