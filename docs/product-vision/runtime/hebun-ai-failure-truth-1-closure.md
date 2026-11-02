# AI-FAILURE-TRUTH-1 · A failure record claims only what the failure proves · closure record · VERIFIED

Package 1 of the Director's six-package development plan. **This package is NOT closed.** It is
verified in a disposable copy and nothing more: the change is one local commit on
`feat/ai-failure-truth-1`, it is not pushed, it is not on `main`, it is not deployed, and production was
not observed.
No state below `VERIFIED` is claimed, and none above it.

Unchanged by this package: GATE-D stays BLOCKED (`GATE-D-PROVIDER-RECONCILIATION-1`), the Research Agent
stays passive, the tenant dispatch cap behaves as before, and historical records are not rewritten.

## What changed

- **Closed failure codes.** New `provider-unreachable`, `output-bound-exceeded`, `transport-call-limit`,
  `provider-billing`, `provider-rate-limited`, `provider-request-rejected`.
  `invalid-configuration` and `rate-limited` become historical: rows hold them, no released path raises
  them.
- **One table decides dispatch.** `MODEL_DISPATCH_FACTS` is total over the code union: `not-sent` (no
  `fetch` attempted), `receipt-unknown` (attempted, or the code cannot say), `provider-responded` (an HTTP
  response came back). None of these means the work completed. `dispatchStateForFailure` replaces the two
  `PRE_DISPATCH_FAILURE_CODES` lists, so only a code raised before `fetch` may say `not-dispatched`.
- **Classification reads closed values only.** HTTP status and whether `error.type` equals
  `billing_error`. Provider free text is never read, returned, stored or logged. An unreadable or stalled
  error body falls back to the status, bounded at 2 seconds.
- **Historical rows stay as written.** `not-dispatched` rows holding a historical code are counted as
  `Dispatch unverified` on the agent outcome and evaluation surfaces.
- **`modelFallback.dispatch`.** The `provider-failed` fallback carries the table's value. The preparation
  surface says what the code proves.
- **One closed log line.** `modelFailureLogLine`: code and dispatch fact, no tenant, prompt or provider text.

No migration: the only schema-file change is a comment. 14 source files, 13 existing test files and
`tests/ai-failure-truth-1/` changed.

## Client boundary (reviewed at the CA2 repair)

`dispatch` crosses to the browser on two paths: `toPreparationClientResult` (preparation and assignment
results) and `askHebyAction` (the whole response). It is safe on both because it is a pure function of
`code`, which already crossed, so it adds no information. The only producer is the server `catch` in
`model-answer.server.ts`, which reads neither the error message nor a provider body. A synthetic check
over all 18 codes found only the three enum values, a frozen table and exactly the keys `kind`, `code`,
`dispatch`. `modelFallback` is not written by `persistExchange`.

## Verification, in order

1. **First candidate suite** (superseded): 1129 PASS, 4 not passing. Regression repairs followed, so it is
   not evidence for the final code.
2. **Regression tests** on the repaired code: `cgo9-hebun-preparation/bite-proofs` 7 mutations, 0 void;
   `google-capability-scope-repair-1/scope-composition` 17 checks.
3. **Final full suite**, one run, not repeated: **1131 PASS, 2 FAIL, 0 BLOCKED, 0 NOT RUN** of 1133, exit 1,
   about 26 minutes, no watchdog stop, minimum free disk 16.87 GiB, memory pressure never critical. Code hash
   `87ed5a85c767d0fc`, equal between worktree and disposable copy before and after.
4. **Mutations M1–M8** on the final code: 8/8 KILLED, 0 survived; unmutated controls passed.
   M1 billing claimed not-sent · M2 4xx back to the old code · M3 any error type is billing · M4 historical
   code proves not-sent · M5 boundary refusal claimed sent · M6 fetch failure old code · M7 unverified rows
   hidden · M8 billing sentence says not known.
5. **CA2 repair** (below): three CA2 suites PASS, T1–T12 PASS, `tsc --noEmit` and `eslint` PASS.

**The total is not a single run.** The evidence is 1131 PASS from the full suite plus 2 files that passed
afterwards in a targeted run. No single run has reported 1133 PASS (`AFT1-FULL-SUITE-COMPOSITE-1`).

## CA2 regression

The final suite's two failures were regressions of this package, not baseline noise: both passed on
unchanged `2c1b43a1` (`bite-proofs` 10 mutations) and in the first candidate run.

- `ca2-preparation-failure-legibility/fallback-postgres.ts:194` pinned the old fallback shape with an exact
  `deepEqual`, so the new `dispatch` field failed F1.
- `ca2-preparation-failure-legibility/bite-proofs.ts:37` searched for the old source text in mutation B2.
  This second pin was hidden: the suite stopped at its baseline step, before any mutation.

**Repair: test expectations only, one line in each file. Production code did not change.** The exact
`deepEqual` stays and now names `dispatch: "receipt-unknown"`. No assertion was loosened. Because F1 stopped
the suite, F2–S1 and `assertClientSafe` had not run on the candidate until this repair.

After the repair, in the disposable copy with diff hash `fbce064ec887ef6c` equal to the worktree:
`surface-and-firewall` PASS; `fallback-postgres` PASS; `bite-proofs` PASS, 10/10 bit; `failure-truth` T1–T12
PASS. Removing `dispatch` and writing a wrong enum value were each caught at F1 in one-off mutations, then
restored. Two earlier attempts ran no test (exit 127, a `PATH` error of the runner) and are not evidence.

`next build` passed on the final source before the repair (exit 0). The repair touched tests only, and
`tsc --noEmit` covers tests.

## Synthetic ambient database safety: what it proves

`r3w-flow/ambient-database-safety` passed in the final suite. Its earlier failure was `3D000`, a missing
database. The Director approved an empty synthetic `hebun_r1` on the session's disposable cluster:
83 migrations, ledger digest `3f114ef305ce39c580ba0282103b26b7`, 82 public tables, 0 rows, no fake ledger
row. Ledger and digest were unchanged after all tests.

**Limit.** This proves the test passes against an empty stand-in with a real migration history. It is not a
run against the canonical `hebun_r1`, and it proves nothing about any real database's data.
`OR2-R3W-AMBIENT-DB-BLOCKED-1` therefore stays DEFERRED.

## Not done

- No push, merge or deploy. The only commit is the local one that adds this record.
- No production observation: no real provider failure has been classified, and no production surface has
  shown these sentences or the `Dispatch unverified` figure. All provider behaviour here is a scripted fetch.
- No paid model call, migration, credential or billing change, retry, or Research Agent activation.

## Closure Contract (v1)

- Phase: AI-FAILURE-TRUTH-1
- Owner: features/heby-model (failure codes and dispatch facts) + features/heby-model-live (classification)
- Reached state: VERIFIED
- Implementation commit: THIS COMMIT
- Verification level: V3 — provider and execution boundary, with a changed client-bound contract; no schema, authority or tenant behaviour change
- Verification evidence: final full suite `node scripts/run-tests.mjs` on a disposable detached copy of 2c1b43a1 plus the candidate diff: 1131 PASS, 2 FAIL, 0 BLOCKED, 0 NOT RUN, exit 1; both FAIL classified REGRESSION and repaired in test expectations only, production code unchanged; after the repair `surface-and-firewall` exit 0, `fallback-postgres` exit 0, `bite-proofs` exit 0 with 10 mutations bit, `failure-truth` T1–T12 exit 0; M1–M8 8/8 KILLED on the final code; `tsc --noEmit` exit 0; `eslint` on both changed tests exit 0; `next build` exit 0 before the repair. 1133 PASS was never reported by a single run.
- Test environment: disposable copy outside the repository, HEAD 2c1b43a1; disposable PostgreSQL 18 at 127.0.0.1:55432 only, system_identifier 7703319182503336424, created in the implementation session, identity re-measured before each run, no foreign clients; synthetic empty `hebun_r1` as above; macOS Darwin 25.2.0, Node 24.16.0; logs retained locally, not in the repository
- Deployment evidence: N/A — not deployed
- Production acceptance evidence: N/A — production was not observed; no real provider failure has been measured
- Deferred risks: AFT1-CA2-PIN-REGRESSION-1 (CLOSED); AFT1-FULL-SUITE-COMPOSITE-1 (DEFERRED); AFT1-PROD-OBSERVATION-1 (DEFERRED); AFT1-CREDIT-400-UNSPECIFIC-1 (DEFERRED); AFT1-DISPATCH-BITE-1 (DEFERRED); OR2-R3W-AMBIENT-DB-BLOCKED-1 (DEFERRED); EHO-1-RED-SUITE-BASELINE-1 (DEFERRED); GATE-D-PROVIDER-RECONCILIATION-1 (BLOCKED)
- Director approvals: scope, 2026-11-01 ("MASTER ROADMAP APPROVAL & PHASE 0 CONTROL"); implementation, 2026-11-02 ("IMPLEMENTATION GO"); final validation on the disposable cluster, 2026-11-02 ("OPTION A APPROVED, STRICTLY SCOPED"); test-expectation repair, 2026-11-02 ("LIMITED REPAIR GO"); this record, 2026-11-02 ("DOCUMENTATION-ONLY GO"); one local commit, 2026-11-02 ("CONDITIONAL LOCAL COMMIT GO"). No push, merge, deploy, production observation or closure has been approved.

### Deferred risk detail

- **AFT1-CA2-PIN-REGRESSION-1 (CLOSED).** Two CA2 pins broke on the new `dispatch` field. Fixed in test
  expectations only; three CA2 suites pass. Detail above.
- **AFT1-FULL-SUITE-COMPOSITE-1 (DEFERRED).** The final evidence is 1131 from one full run plus 2 targeted
  files, so no single run proves all 1133 together. Only two test files changed after that run. A rerun needs
  a Director decision and at least 15.2 GiB free.
- **AFT1-PROD-OBSERVATION-1 (DEFERRED).** Every result is synthetic. Production acceptance needs a release, a
  deployment record and a measured production failure or a Director-defined read. Anthropic readiness itself
  stays blocked by GATE-D.
- **AFT1-CREDIT-400-UNSPECIFIC-1 (DEFERRED).** A credit refusal delivered as HTTP 400 without
  `error.type: billing_error` becomes `provider-request-rejected`, by decision: free text decides nothing. The
  record is true but does not name billing. The transport's real response to an exhausted balance after this
  change is unmeasured.
- **AFT1-DISPATCH-BITE-1 (DEFERRED).** Removing `dispatch` was caught once, in one-off mutations. `bite-proofs`
  carries no permanent mutation for it; F1 and a source pin in `failure-truth` hold it. Left out to keep the
  repair to the smallest change.
- **OR2-R3W-AMBIENT-DB-BLOCKED-1 (DEFERRED).** Owned by ORGANIZATION-READINESS-2. Synthetic evidence only; see
  the limit above.
- **EHO-1-RED-SUITE-BASELINE-1 (DEFERRED).** Owned by EAI-HISTORY-ORIGIN-1. Not closed here: a red-free single
  run was not recorded.
- **GATE-D-PROVIDER-RECONCILIATION-1 (BLOCKED).** Owned by HEBY-AI-PLAN-PRODUCTION-ACCEPTANCE-1. Unchanged.

Also recorded: `contracts.ts` says `dispatch` is absent on records made before this package, but `modelFallback`
is not persisted. A comment only; left alone under the no-code rule of this documentation step. Production's
deployed SHA was not measured for this record: UNAVAILABLE.

## Weekly three questions

1. **What did we learn?** An exact pin and a bite-proof's find-string are both contracts, and the second can
   stay hidden behind the first failure.
2. **How does this improve Turkish Rug House?** A failed AI preparation will say what is known: not sent,
   unknown, or the provider refused. This takes effect only once released.
3. **How does this become part of Hebun AI?** One total table turns failure codes into dispatch facts, so a new
   code fails to compile rather than being filed as not sent.
