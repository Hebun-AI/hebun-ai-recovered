# SCAN-FAILURE-LEGIBILITY-1 · An unreadable register says why · closure record · VERIFIED

Package 2 of the Director's six-package plan (production observability). **Verified, not deployed, not
production-accepted.** The implementation is one commit on `feat/scan-failure-legibility-1`; it is not on
`main` and production has not run it.

## The problem

The three hourly scans (`/api/observation/scan`, `/api/machine-delivery/scan`,
`/api/standing-issuance/scan`) answer 503 when their runtime register cannot be read. Each reader turned
every failure into `persistence-unavailable`, so the one `cron-scan-unsuccessful` line
(OPERATIONAL-OBSERVABILITY-V1) said that a tick failed and never why. The 503 of 2026-11-01 20:00:18Z
on the observation scan is the case: its cause is UNAVAILABLE. Vercel kept roughly 15 hours of runtime
log at the time of measurement, and nothing told anyone a tick had failed or had not run.

## What changed

- **One closed cause.** `classifyPersistenceFailure` returns `not-configured | connection |
  authentication | query | unknown`. It reads only a string `code` on the error or its `cause` chain
  (at most four levels): a Node errno from a closed set, or a SQLSTATE class — `28` authentication;
  `08`, `3D`, `53`, `57`, `58` connection; any other well-formed SQLSTATE query. No database handle is
  `not-configured`. Anything else, including `pg-pool`'s codeless connect timeout, is `unknown`.
  Message, stack, SQL and parameters are never read: `DrizzleQueryError` carries the SQL and its
  parameters in its message.
- **Carried, not exposed.** The three `…ForRuntime` readers return the cause on their `unavailable`
  variant; the three scan contracts pass it through; each route hands it to the warning line.
  **Status codes and response bodies are unchanged**: 503 still answers `{ status, reason }`.
- **The line.** `{ event: "cron-scan-unsuccessful", scan, status: "unavailable", cause }`. The helper
  re-closes the value through a table total over the cause union, so anything else is written as
  `unknown`. Its imports stay type-only.
- **`scripts/ops/scan-tick-report.mts`.** A local, read-only report. It reads `vercel logs --json` on
  stdin and prints one line per hourly tick: `OK`, `NOTED`, `ATTENTION` or `UNAVAILABLE`. It writes no
  file, opens no network connection, sends no notification, and is not a CI step or cron job.
  - `ATTENTION`: the same scan's tick failed twice in a row (non-200 or an `unavailable` line), an
    expected tick is missing, a non-scan 5xx, `fatal`, or `provider-billing`.
  - `NOTED`: a single failed tick, a `model-request-failed` line, or a tick that answered 200 with
    refused or failed candidates. The last never escalates, so a disarmed delivery does not alarm hourly.
  - The `pg` SSL-mode notice on a 200 tick is counted as known noise and raises nothing.
  - **Missing evidence is never a healthy tick.** An hour is judged only if all three scans appear in its
    tick window, or the input spans the whole window. Otherwise it is `UNAVAILABLE`, never `missing`.
  - Output carries hours, closed words and counts only; values outside the closed sets print as `other`.

No migration, schema, env, dependency, route, cron or provider change.

## Verification (V2)

V2: a shared seam — three machine ingresses and their register readers — changed; no write path,
authority, schema or provider boundary changed. Tenant impact: the readers' tenant scoping and the
routes' bodies are unchanged; the cause is a closed word with no tenant content.

| Step | Result |
|---|---|
| Baseline at `7ea190bc`, disposable copy | 37 affected test files: 37 PASS |
| Candidate, worktree | 32 affected non-mutating files + 3 new: 35/35 PASS |
| Candidate, disposable copy | 5 source-mutating files PASS after one pin repair (below); new bite-proofs 7/7 bit |
| Static | `tsc --noEmit` 0; `eslint` on changed files 0; `npm run build` 0; `git diff --check` clean |

**Pins.** Five existing tests pinned the old shape and were updated in the same commit, each with a
comment: `operational-observability-v1/scan-warning.ts` (line now carries `cause`),
`operational-observability-v1/delivery-attention.ts` (helper imports 3 → 4, still type-only),
`rung2-machine-delivery-trigger/scan-and-ingress.ts` and `trh25-observation-trigger/trigger-postgres.ts`
(`unavailable` result carries `cause`). `trh25-observation-trigger/bite-proofs.ts` T10 went red as a
REGRESSION: its find-string named the old return line, so the mutation could not apply. The anchor now
names the new line; the replacement and the expected failure are unchanged, and T10 bit again
(11 mutations bit, 0 void). No assertion was loosened.

**New tests** (`tests/scan-failure-legibility-1/`):
- `classifier-and-contracts.ts`: every SQLSTATE class and errno, nested `DrizzleQueryError`, bounded
  and cyclic cause chains, codeless timeouts and message-shaped codes → `unknown`; the three scans carry
  each cause; a bogus cause is written as `unknown`. Leak negatives: a tenant id in query parameters, a
  SQL fragment and a password-failure message never reach the result or the line. Source pins: the
  classifier has no `.message`, `.stack`, `.query`, `.params`, `console.` or import.
- `routes-postgres.ts`, real Postgres, all three routes: refused port → `connection`; database that does
  not exist (3D000) → `connection`; empty unmigrated database (42P01) → `query`. Each answers 503 with a
  byte-identical body and one line. A migrated empty database answers 200 with no line; 401 writes none.
- `tick-report.ts`: healthy, single and consecutive failures, missing tick, outcome-level refusals, SSL
  noise on 200 and not on 503, non-scan 5xx, fatal, model failures and `provider-billing`, empty,
  truncated and cut input, output minimization, parsing, CLI exit codes.
- `bite-proofs.ts`, disposable copy only: S1 classifier stops following `cause`; S2 line writes the cause
  it was handed; S3 a reader drops classification; S4 a route puts `cause` in the body; S5 a missing tick
  is healthy; S6 uncovered hours are judged; S7 SSL noise on a failed tick. 7/7 bit, files restored
  byte-identically.

The script was also run on saved production logs: the deployed hours read `OK`, the 2026-11-01 20:00Z
tick reads `failed(status=503,cause=none)` (the line predates this change), and uncovered hours read
`UNAVAILABLE`.

The committed content equals the tested content, except one trailing blank line removed from
`classify-persistence-failure.ts` at commit (`git diff --cached --check`); `classifier-and-contracts`
reran PASS after it.

## Not done

- No push, deploy or production observation. No organic `cause` line has been seen.
- No notification channel. Vercel Alerts and Observability Plus were not enabled; their cost was not
  confirmed.
- Not in scope: the SSL-mode connection-string setting (a production env change) and `/operations`
  React #418 (`MEDIA3-ADMITTED-AT-HYDRATION-1`).

## Closure Contract (v1)

- Phase: SCAN-FAILURE-LEGIBILITY-1
- Owner: apps/dashboard/src/features/cron-scan-warning (cause classification and the warning line) with the three `…ForRuntime` register readers, the three scan triggers and routes, and scripts/ops/scan-tick-report.mts; authorities, permits, providers, schema and response bodies unchanged
- Reached state: VERIFIED
- Implementation commit: 1a2999332fef14764963c9f1fef1f794862b268f
- Verification level: V2 — a shared seam of three machine ingresses and their readers; read path and log line only, no write path, authority, schema or provider boundary changed
- Verification evidence: baseline 37/37 PASS at 7ea190bc; candidate 35/35 non-mutating PASS; 5 source-mutating files PASS after the T10 anchor repair (11 bit, 0 void); new bite-proofs 7/7 bit; routes-postgres refused port → connection, 3D000 → connection, 42P01 → query, healthy and 401 silent, bodies byte-identical; tsc --noEmit 0; eslint 0; npm run build 0; git diff --check clean; full suite not run (V2)
- Test environment: worktree `.claude/worktrees/scan-failure-legibility-1` and two disposable detached copies of 7ea190bc in the session scratchpad; PostgreSQL 18.6 cluster created by this session at 127.0.0.1:55440, system_identifier 7703522872323487222, test databases dropped, cluster stopped after use; macOS Darwin 25.2.0, Node 24.16.0; no provider, no model, no production access
- Deployment evidence: N/A — not deployed
- Production acceptance evidence: N/A — not deployed; no organic cause line observed
- Deferred risks: SFL1-CAUSE-PROD-1 (DEFERRED); SFL1-LOG-RETENTION-1 (DEFERRED); SFL1-NOTIFY-CHANNEL-1 (DEFERRED)
- Director approvals: read-only discovery, 2026-11-02 ("PACKAGE 2 DISCOVERY GO"); plan, 2026-11-02 ("PACKAGE 2 PLANNING GO"); implementation with the three-scan scope, structured codes only and no pg-pool message match, 2026-11-02 ("LIMITED IMPLEMENTATION GO"); local commit 1a299933, 2026-11-02 ("LOCAL COMMIT GO"); release preflight, 2026-11-02 ("READ-ONLY RELEASE PREFLIGHT GO"); this record and release strategy A, 2026-11-02 ("DOCUMENTATION GO"). Push and deployment NOT approved.

### Deferred risk detail

- **SFL1-CAUSE-PROD-1 (DEFERRED).** No production line with a `cause` has been observed. Acceptance
  dependency: a deployment of this change and an organically unsuccessful tick read from the runtime log;
  no failure is induced. Until then the cause path is proven locally only.
- **SFL1-LOG-RETENTION-1 (DEFERRED).** Vercel runtime-log retention is not known exactly. On 2026-11-02
  the oldest reachable line was 2026-11-01 22:00:18 +03, and `--since 3d/7d/30d` and explicit older
  windows returned no line. Evidence older than about 15 hours may be gone, which is why the report
  answers `UNAVAILABLE` for uncovered hours. Acceptance dependency: a Director decision on longer
  retention (paid) or on a cadence for running the report.
- **SFL1-NOTIFY-CHANNEL-1 (DEFERRED).** The report detects; nothing notifies. Acceptance dependency: a
  Director decision on a channel (for example Vercel Alerts, after its cost is confirmed) or on who runs
  the report and when.

## Weekly three questions

1. **What did we learn?** A bite-proof's find-string pinned the exact line this change had to edit, for
   the second package running; changing a shared return shape means grepping mutation anchors too.
2. **How does this improve Turkish Rug House?** A missed observation or delivery tick can be told
   apart from a quiet hour, and its cause read without guessing. This takes effect once released.
3. **How does this become part of Hebun AI?** Failure causes are closed words chosen from structured
   codes, never free text — the same doctrine as Package 1's dispatch facts, now on the persistence side.
