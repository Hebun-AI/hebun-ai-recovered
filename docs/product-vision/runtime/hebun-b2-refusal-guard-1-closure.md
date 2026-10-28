# B2-REFUSAL-GUARD-1 · closure record · VERIFIED — a provider refusal is never filed as a prepared draft

**Scope, stated first.** Authorized by the Director on 2026-10-28 ("AGENT AUDIT RECONCILIATION & FIRST FIX"), after
the read-only Agent System Readiness Audit at `0cb525f9` listed it as B2. One refusal added to the preparation seam,
beside OUTPUT-INTEGRITY-1's. No model or provider was called; no Work, Governance, mandate or artifact record changed;
no new lifecycle, status, table or migration. Not pushed, not deployed.

## 1 · Root cause

`prepareWorkArtifact` refused only an explicit `stop_reason: max_tokens` (OUTPUT-INTEGRITY-1). The provider's
`refusal` was classified (`classifyProviderStopReason`, AOR-1a) and written to the diagnosis line, but nothing acted
on it: a reply the provider ended with `refusal` whose text passed the response validator was filed as a
review-ready draft. Measured on the unchanged source: the new case T11 failed `artifacts +0` with an actual `1`.

## 2 · What changed (`95bd5874`)

| File | Change |
|---|---|
| `apps/dashboard/src/features/work-artifacts/prepare-work-artifact.server.ts` | `PreparationRefusal` gains `model-refused`; directly after the `max_tokens` guard (unchanged) and before either writer, `answer.modelStopReason === "refusal"` returns it |
| `apps/dashboard/src/components/operations-preparation/prepare-with-hebun.tsx` | Wording for `model-refused`, ending in the shared post-invocation sentence: no prepared work was written, any model call stays in its message record |
| `apps/dashboard/tests/output-integrity-1/truncation-postgres.ts` | T11: refusal → `model-refused`, artifacts +0, revisions +0, message record kept, for an operational plan and a content draft; T12: the guard sits after the model-origin check and before both writers, and its wording says nothing was filed |
| `apps/dashboard/tests/aor-1a/diagnosis-postgres.ts` | **Pin changed on purpose.** D2 asserted the defect ("a refusal is recorded, never blocking the filing", artifacts +1). It now asserts `not-prepared` / `model-refused` and artifacts +0; the diagnosis line still records `stopReason: refusal`. The reason is written in the test beside D2 |
| `apps/dashboard/tests/cgo9-hebun-preparation/surface-and-firewall.ts` | The pinned post-invocation set adds `model-refused` (the pin changes with the union it pins) |

Unchanged by construction: the `max_tokens` guard line and its T2/T5/T6/T7 cases; the message row (written by the
answer flow before the seam decides); `assignWorkDraft` / `reviseWorkDraft`, which pass any refusal through as
`not-prepared`; Governance, Work, mandate and artifact authorities (T8 asserts no request, permit or work change in
every case).

## 3 · Verification (V2)

V2: the shared preparation seam and its two callers. Full suite not run: the change is one refusal before the writers.

| Check | Result (2026-10-28) |
|---|---|
| Baseline, unchanged source `0cb525f9`: `truncation-postgres.ts` as published | PASS T1–T10 |
| Red, unchanged source: new T11 | FAIL `T11: artifacts +0` (actual 1) — the defect reproduced |
| Candidate `95bd5874`: output-integrity-1 truncation (T1–T12); aor-1a diagnosis-postgres (D1–D6) and diagnosis-contract; cgo9 surface-and-firewall and preflight-and-provenance-postgres; ca2 surface-and-firewall and fallback-postgres; content-agent-2 surface-and-firewall; agent-execution-1 assignment-postgres; agent-execution-2 specialist-delegation-postgres; heby-workflow-1 revision-postgres | 11/11 PASS · 0 REGRESSION, 0 PRE-EXISTING, 0 BLOCKED |
| `tsc --noEmit`, `eslint` on the five files, `git diff --check`, `npm run build` | exit 0 |

Not run: the 48-suite seam census OUTPUT-INTEGRITY-1 ran on baseline and candidate, a baseline run of the ten
other suites, and a mutation copy (T12 is the source-order check; T11 red on the unchanged source is the bite).
Recorded as B2-SUITE-COVERAGE-1.

**Test environment.** Worktree `.claude/worktrees/refusal-guard-1` on branch `fix/refusal-guard-1` from `0cb525f9`
(`npm ci`, published lockfile; six install scripts not run by npm's allow-scripts, build and tests unaffected);
macOS Darwin 25.2.0, Node 24.16.0; PostgreSQL 18 initialised by this session (`initdb --locale=C -E UTF8`, TCP only)
on 127.0.0.1:56471, `system_identifier` 7701707793223160617, via `HEBUN_TEST_ADMIN_DATABASE_URL`; model faked at the
transport; no production database, no provider.

## Closure Contract (v1)

- Phase: B2-REFUSAL-GUARD-1
- Owner: apps/dashboard/src/features/work-artifacts/prepare-work-artifact.server.ts (preparation seam); refusal wording in prepare-with-hebun.tsx
- Reached state: VERIFIED
- Implementation commit: 95bd5874b31619e8d2a1a470675c573117f7bf71 — on branch fix/refusal-guard-1, not on main
- Verification level: V2 — shared preparation seam and both callers (assign, revise); targeted suites only, see B2-SUITE-COVERAGE-1
- Verification evidence: 2026-10-28, baseline truncation-postgres T1–T10 PASS on 0cb525f9; T11 FAIL on 0cb525f9 (artifacts 1, expected 0); candidate 11/11 suites PASS; tsc, eslint, git diff --check, npm run build exit 0
- Test environment: worktree .claude/worktrees/refusal-guard-1 (branch fix/refusal-guard-1, npm ci); macOS Darwin 25.2.0, Node 24.16.0; PostgreSQL 18 on 127.0.0.1:56471, system_identifier 7701707793223160617, via HEBUN_TEST_ADMIN_DATABASE_URL; model faked at the transport; no production database, no provider
- Deployment evidence: N/A — not deployed
- Production acceptance evidence: N/A — not released or deployed
- Deferred risks: B2-NOT-RELEASED-1 (DEFERRED); B2-SUITE-COVERAGE-1 (DEFERRED); B2-PROD-UNVERIFIED-1 (DEFERRED)
- Director approvals: read-only audit, 2026-10-28 ("AGENT CAPABILITY, ARCHITECTURE & FAILURE AUDIT"); fix, targeted tests and commit on an isolated branch, 2026-10-28 ("AGENT AUDIT RECONCILIATION & FIRST FIX"); release preparation and this record, no push or deploy, 2026-10-28 ("REFUSAL GUARD RELEASE PREPARATION")

### Deferred risk detail

- **B2-NOT-RELEASED-1 (DEFERRED).** `95bd5874` is on `fix/refusal-guard-1` only; production still files a refusal.
  Acceptance dependency: a Director push gate (push to `main` is a production deploy), with the remote HEAD re-read
  and the candidate proven its descendant.
- **B2-SUITE-COVERAGE-1 (DEFERRED).** Eleven suites ran on the candidate; OUTPUT-INTEGRITY-1's 48-suite seam census
  was not rerun on baseline and candidate. Acceptance dependency: that census, in a disposable copy, before release —
  or a Director acceptance of the targeted set.
- **B2-PROD-UNVERIFIED-1 (DEFERRED).** No production preparation has been refused as `model-refused`, and the wording
  has not rendered in production. Acceptance dependency: an organic refusal read back after deployment; it is not
  provoked on purpose.

**Not resolved here.** AE2-DECLINED-DRAFT-FILED-1 stays DEFERRED with AGENT-EXECUTION-2: the declines it observed
were ordinary prose ending `end_turn`, which this guard does not catch. When this phase is released, that row's
dependency text ("`stop_reason: "refusal"` is not read on the answer path") becomes stale for the preparation path
and is updated in the same documentation change.

**Weekly three.** *Learned:* AOR-1a recorded the provider's refusal and a test pinned "never blocking the filing" —
a diagnosis that is only logged is a decision not to act, and its pin must change with the decision. *Turkish Rug
House:* a declined caption can no longer reach review looking like a draft. *Hebun AI:* every specialist shares the
seam, so each inherits the refusal floor with no per-agent code.
