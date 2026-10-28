# B1-LIVE-BUDGET-1 · closure record · DEPLOYED — the live-call budget renews per window and names its own refusal

**Scope, stated first.** Authorized by the Director on 2026-10-28 ("B1 LIVE MODEL BUDGET RELIABILITY"), after the
read-only B1 audit confirmed that the per-process live-call budget never renewed. Approach A (fixed window) + C
(own error code) on top of D (AP-3 unchanged). No persistence, service, quota authority, Governance mechanism,
table or migration; no provider, model or production call. Released by fast-forward `1306c85b..2f9e240e` on
2026-10-28 and deployed (§5); production behaviour not observed.

## 1 · Root cause

`createLiveSpendBudget` (R2G, `12625a7d`) counted grants for the life of the process: once an instance spent
`HEBUN_MODEL_LIVE_CALL_BUDGET` (absent in production, so the default 8 — env name listing, 2026-10-28) it refused
every further live call for every tenant on that instance until recycled. The refusal raised `rate-limited`, the
provider-429 code, so the two were indistinguishable to operators, to origination provenance and to the
preparation surface, which said "whether the provider received it is not known" for a call that never left.

## 2 · Phase 0 — safety preconditions (read at `1306c85b`)

| Question | Finding |
|---|---|
| R2G no-reset contract | `tests/r2g-flow/firewall.ts`: no `reset`/`clear`/test hatch in the budget's code, no timer, no table, a closed export list. Kept; only the export list gains the window constant |
| AP-3 coverage | Every live egress admits through `admitAiDispatch` before dispatch: Claude in `heby-model-generation.server.ts` (all Claude callers — Heby answer, preparation, origination, AI plan — reach the transport only through it); image in `request-media-generation.server.ts` (admission l.388, generate l.446); video in `async-generation-lifecycle.server.ts` before `dispatch` |
| Live path without AP-3 | None found. The relevance judge calls `transport.send` directly but is unwired (`knowledge-retrieval/grounding.ts`: "Pure. Not wired"; no route imports it) and the live transport refuses structured output. Video `poll` reads provider status without a budget unit; whether a poll is billed is UNVERIFIED |
| Purpose of the process budget | A burst bound inside one instance (R2G header); total and cross-instance spend are AP-3's (50 model / 5 media per tenant per UTC day) |
| Does a window weaken it | No. Per window the bound is unchanged (N); across one boundary at most 2N; idle windows never accumulate; the daily per-tenant ceiling is AP-3's and untouched |

## 3 · What changed

**Phase C — `0db689f9`.**

| File | Change |
|---|---|
| `src/features/heby-model/model-error.ts` | `ModelConnectivityErrorCode` gains `budget-exhausted` (not retryable) |
| `src/features/heby-model-live/live-spend-budget.server.ts` | `liveBudgetExhaustedError` raises `budget-exhausted`; message unchanged |
| `src/features/agent-origination/originate-action.server.ts`, `originate-work-state.server.ts` | `budget-exhausted` is a pre-dispatch code (`not-dispatched`, nothing spent) |
| `src/components/operations-preparation/prepare-with-hebun.tsx` | For `budget-exhausted`: "Hebun reached its short-term limit on live model calls, so the model was not asked. Try again in a minute. No revision was written." Every other provider failure keeps the released sentence |
| `tests/b1-live-budget/classification.ts` | New, C1–C6 |
| `tests/r2g-flow/bounds-and-spend.ts`, `tests/ap3-dispatch-safety-cap/cap-postgres.ts` (M4) | **Pins changed on purpose**: they asserted the old code `rate-limited` for a budget refusal; the behaviour they prove (no fetch, no evidence, no cap charge) is unchanged |

Provider 429 stays `rate-limited`; the per-instance one-call cap stays `rate-limited`.

**Phase A — `943833e5`.**

| File | Change |
|---|---|
| `src/features/heby-model-live/live-spend-budget.server.ts` | `LIVE_CALL_BUDGET_WINDOW_MS = 60_000`. `createLiveSpendBudget(limit, { windowMs?, now? })` keeps one count per epoch-aligned window; the clock is read only in `attempt()`; only a later window renews; an invalid window never renews; an invalid limit is still 0. Singleton, default limit 8, max 100 unchanged. No new export besides the constant |
| `tests/b1-live-budget/window.ts` | New, W1–W9 |
| `tests/r2g-flow/firewall.ts` | **Pin changed on purpose**: the closed export list adds `LIVE_CALL_BUDGET_WINDOW_MS` ("four functions and four constants"). The no-reset, no-timer, no-table and non-authority assertions are unchanged |

Claude, OpenAI image and Higgsfield video still draw on the one process budget (W8). AP-3 is unchanged.

## 4 · Verification (V3)

V3: a provider spend boundary shared by three providers, and the model error contract. Full suite justification
written before the run (2026-10-28T15:02:58Z): the change touches a provider/execution boundary, no prior
full-suite result existed for the candidate.

| Check | Result (2026-10-28) |
|---|---|
| Baseline `1306c85b`, 30 affected suites (R2G, AP-3 config/prepay and cap-postgres, R2/R2D transport and generation, APF-3, APF-5, AP-4b provenance, WF-1, CA-2, EAI B2/history/record, AI plan, grounded conversation, HPIB, SCI-1, RELEVANCE-2A, MEDIA-1/2A/5, IMAGE→VIDEO, MV-6, MV-7 locate) | 30/30 PASS |
| Red on unchanged source | C1 FAIL (`rate-limited` where `budget-exhausted` expected); W2 FAIL (no renewal at the boundary) — the two defects reproduced |
| Candidate C (`0db689f9`) | 31/31 PASS (30 + classification) after the M4 pin; tsc, eslint exit 0 |
| Candidate A (`943833e5`) | 32/32 PASS (+ window); tsc, eslint, git diff --check, npm run build exit 0 |
| Full suite, candidate `943833e5`, disposable detached copy, sequential | 1114 PASS / 2 FAIL / 1116 · 0 REGRESSION · 1 BLOCKED · 1 VOID resolved |
| `tests/r3w-flow/ambient-database-safety.ts` | BLOCKED — canonical `hebun_r1` at :55432 unreachable; not a pass (existing OR2-R3W-AMBIENT-DB-BLOCKED-1) |
| `tests/hlr-human-legibility/bite-proofs.ts` | First run VOID (H5 defending suite timed out at 600 s under mutation). Sequential rerun in disposable copies: baseline `1306c85b` PASS (14 s), candidate `943833e5` PASS (12 s); trees clean after |

Covered negative scenarios: limit within a window (W1, C1), renewal only at the boundary (W2), boundary ceiling 2N
(W3), clock moving back (W4), invalid limit and window never unlimited (W5, W6), 429 vs exhaustion (C2), cap refusal
leaves the budget untouched (AP-3 cap-postgres), failed provider call spends its unit (W7), shared Claude/image/video
budget (W8, structural), restarted process starts empty and no caller can empty a running one (W9), AP-3 bypass
attempts (AP-3 and EAI suites in the full run).

**Test environment.** Worktree `.claude/worktrees/live-budget-window-1` on branch `fix/live-budget-window-1` from
`1306c85b` (`npm ci`, published lockfile); full suite and HLR reruns in disposable detached copies under the session
scratchpad; macOS Darwin 25.2.0, Node 24.16.0; PostgreSQL 18 initialised by this session on 127.0.0.1:56471,
`system_identifier` 7701707793223160617, via `HEBUN_TEST_ADMIN_DATABASE_URL`, `DATABASE_URL` unset; no provider,
no production database.

## States, kept apart

| State | Reached | Evidence |
|---|---|---|
| IMPLEMENTED | yes | `0db689f9`, `943833e5` |
| LOCALLY VERIFIED | yes | §4 |
| DEPLOYED | yes | `dpl_3TEhdDPcx9hnyxGGWYyUuLaZH1gX` READY, aliases in §5 |
| PRODUCTION BEHAVIOUR VERIFIED | **no** | no live exhaustion or renewal observed; none provoked (B1-PROD-UNVERIFIED-1) |

## 5 · Release and deployment (2026-10-28)

Preflight: remote `main` `1306c85b` (the expected base); candidate `2f9e240e` = `0db689f9` + `943833e5` + `2f9e240e`,
fast-forward, clean tree, `CLAUDE.md` unchanged against remote, diff limited to the 13 files of §3 and this record;
test and build evidence belongs to `943833e5`, and `2f9e240e` changes documentation only. Production before release:
`dpl_D928Y2DQLnwZ5x9mee5WdKeUJphX` on `1306c85b`, READY; `HEBUN_MODEL_LIVE_CALL_BUDGET` and the AP-3 cap variables
absent in Production (names only, values not read), so the defaults apply. Remote HEAD re-read immediately before a
plain push; no force.

| Check | Observed |
|---|---|
| GitHub `main` after push | `2f9e240efc5b3c4349cd4b230dc892a65f06ca23` |
| Deployment | `dpl_3TEhdDPcx9hnyxGGWYyUuLaZH1gX`, target production, READY, `githubCommitSha` `2f9e240e…`, ref `main` (`/v13/deployments`) |
| Aliases | `www.hebuntech.com`, `hebuntech.com`, `hebun-ai-recovered.vercel.app` → `dpl_3TEhdDPcx9hnyxGGWYyUuLaZH1gX` (`/v4/aliases`) |
| Unauthenticated smoke | `/` 200, `/login` 200; `/operations`, `/heby`, `/agents` 307 → `/login`; apex 308 → `www` |

No model call, media generation or artifact was made in production.

## Closure Contract (v1)

- Phase: B1-LIVE-BUDGET-1
- Owner: apps/dashboard/src/features/heby-model-live/live-spend-budget.server.ts (per-process burst bound); model error contract in heby-model/model-error.ts; AP-3 unchanged
- Reached state: DEPLOYED
- Implementation commit: 0db689f9758626b5c1e397cfb8c67706fd6aa71a, 943833e55917aa7159acbf8866fcc2a034c5d048 — on main via fast-forward 1306c85b..2f9e240e
- Verification level: V3 — provider spend boundary shared by Claude, image and video, and the model error contract; full suite run with its justification recorded first
- Verification evidence: 2026-10-28, baseline 30/30 PASS on 1306c85b; C1 and W2 FAIL on the unchanged source; candidate 32/32 targeted PASS; full suite on 943833e5 1114/1116 with 0 REGRESSION, r3w ambient BLOCKED, HLR bite-proofs VOID then PASS on sequential rerun on baseline and candidate; tsc, eslint, git diff --check, npm run build exit 0
- Test environment: worktree .claude/worktrees/live-budget-window-1 (npm ci); disposable detached copies for the full suite and reruns; macOS Darwin 25.2.0, Node 24.16.0; PostgreSQL 18 on 127.0.0.1:56471, system_identifier 7701707793223160617, via HEBUN_TEST_ADMIN_DATABASE_URL; no provider, no production database
- Deployment evidence: 2026-10-28, dpl_3TEhdDPcx9hnyxGGWYyUuLaZH1gX, githubCommitSha 2f9e240efc5b3c4349cd4b230dc892a65f06ca23 (main), target production, READY; www.hebuntech.com, hebuntech.com, hebun-ai-recovered.vercel.app aliased; smoke / 200, /login 200, /operations /heby /agents 307 → /login, apex 308 → www
- Production acceptance evidence: N/A — not production-accepted; no live budget exhaustion or renewal observed, none provoked (B1-PROD-UNVERIFIED-1)
- Deferred risks: B1-NOT-RELEASED-1 (CLOSED); B1-PROD-UNVERIFIED-1 (DEFERRED); B1-BOUNDARY-BURST-1 (DEFERRED); B1-EXHAUSTION-NOT-AUDITED-1 (DEFERRED); B1-PREPAY-UNIT-LOSS-1 (DEFERRED); B1-429-PREDISPATCH-1 (DEFERRED)
- Director approvals: read-only B1 audit, 2026-10-28 ("B1 LIVE MODEL BUDGET AUDIT & RELIABILITY PLAN"); A + C on D, implementation, tests and commits on an isolated branch, no push or deploy, 2026-10-28 ("B1 LIVE MODEL BUDGET RELIABILITY"); release of 0db689f9 + 943833e5 + 2f9e240e with the fixed 60 s window and its 2N boundary burst accepted, AP-3 kept, no new audit action, 429 origination classification deferred to a separate change, no full-suite rerun, 2026-10-28 ("B1 CONTROLLED PRODUCTION RELEASE")

### Deferred risk detail

- **B1-NOT-RELEASED-1 (CLOSED).** Released by the Director-approved fast-forward `1306c85b..2f9e240e` and deployed as
  `dpl_3TEhdDPcx9hnyxGGWYyUuLaZH1gX` (§5).
- **B1-PROD-UNVERIFIED-1 (DEFERRED).** No production exhaustion or renewal has been observed, and none will be provoked.
  Acceptance dependency: an organic `budget-exhausted` read back after deployment, or a Director-approved read.
- **B1-BOUNDARY-BURST-1 (DEFERRED).** A fixed window admits up to 2N (16 at the default) within a span shorter than a
  window across one boundary. Bounded per tenant per day by AP-3. Accepted as non-blocking by the Director on
  2026-10-28 ("B1 CONTROLLED PRODUCTION RELEASE"); stays recorded.
- **B1-EXHAUSTION-NOT-AUDITED-1 (DEFERRED).** A process-budget refusal writes no row (an AP-3 cap refusal does), so
  exhaustion is visible only in the answer's note and origination's `failure_code`. The Director decided on
  2026-10-28 that no audit action is added in this release; stays recorded.
- **B1-PREPAY-UNIT-LOSS-1 (DEFERRED).** If AP-3 admits and the process unit is prepaid but the evidence write then
  throws, the transaction rolls back and the in-memory unit is not returned. Now lost for one window, not for the
  process lifetime. Conservative direction; recorded, not fixed.
- **B1-429-PREDISPATCH-1 (DEFERRED).** Origination lists `rate-limited` as pre-dispatch, so a provider 429 — which did
  reach the provider — is recorded `not-dispatched` (pinned by `agent-proposal-4b/provenance-postgres.ts`). The
  per-instance cap shares that code. Unchanged here by Director instruction to keep `rate-limited` for 429.
  Deferred by the Director on 2026-10-28 to a separate change: give the instance cap its own code and move 429 to
  dispatched.

**Weekly three.** *Learned:* a safety limit with no renewal is an outage with a delay — and a limit that borrows the
provider's error code hides which side refused. *Turkish Rug House:* a busy content day can no longer leave TRH's
drafting on deterministic answers until a redeploy. *Hebun AI:* every agent and both media providers share one burst
bound that now recovers by itself, while AP-3 stays the durable ceiling.
