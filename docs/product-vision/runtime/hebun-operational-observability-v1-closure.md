# OPERATIONAL-OBSERVABILITY-V1 · closure record · DEPLOYED

Two read-only visibility additions, through existing boundaries:

1. **Scheduled scan warning line.** The three cron routes (`/api/observation/scan`,
   `/api/machine-delivery/scan`, `/api/standing-issuance/scan`) write at most one structured
   `console.warn` line per tick when the register is unavailable or any outcome is unsuccessful.
   Before this, a tick in which every candidate was refused or threw answered HTTP 200 and the
   breakdown lived only in an unlogged response body.
2. **Scheduled delivery timing on `/approvals`.** An active, agent-proposed `record-work` permit in
   the approvals panel states one of: awaiting scheduled delivery, attention required, automatic
   delivery not enabled, or delivery timing unknown.

No table, migration, SQL statement, cron, worker, retry, provider call, server action or control was
added. The triggers' doctrine — a scan persists nothing — is unchanged.

## 1 · What was released

| Commit | Content |
|---|---|
| `ce331883` | `feat(operations): surface unsuccessful scans and overdue machine delivery`. 10 files, +613 / −1: new `src/features/cron-scan-warning/warn-unsuccessful-scan.ts`; one call per route in the three `scan/route.ts`; `delivery-legibility.ts` (`MACHINE_DELIVERY_SCAN_INTERVAL_MINUTES`, `MACHINE_DELIVERY_ATTENTION_WINDOW_MS`, `deriveMachineDeliveryAttention`, `MACHINE_DELIVERY_ATTENTION_WORDING`); `action-authorizations.tsx` (`PermitRow` optional `evaluatedAt`); `approvals-dashboard.tsx` (passes `evaluatedAt`); 3 test files under `tests/operational-observability-v1/`. |

On `main`: fast-forward `4fdb5841 → ce331883`; `origin/main` read as `ce331883` on 2026-10-20.

**Log line contract.** Keys are the scan name, the tick status, `considered`, and per-status counts
taken only from closed tables that are total over each trigger's outcome union (a new status fails to
compile). No reason word (several are free strings), no tenant, permit, authorization or invocation
id, no payload, no secret. Healthy and empty ticks and 401s write nothing. Status codes and response
bodies are unchanged.

**Timing classification.** Window = two intervals of the delivery cron (`vercel.json`
`0 * * * *` → 120 min), pinned by a test. Measured from the page's server read instant. `not-enabled`
is never overdue; missing arming state or read instant is "timing unknown". Consumed, expired,
revoked, human-proposed and non-`record-work` permits get no line. Wording denies that a delivery was
attempted or failed. Only the approvals panel passes `evaluatedAt`; other permit lists are unchanged.

**Reused seams, unchanged.** The three triggers' outcome types; `readActionPermits` (tenant-scoped);
`derivePermitDeliveryBand`; the page's existing `resolveMachineExecutionReachability` read. The
cross-tenant `list*ForRuntime` readers are not reachable from the UI graph (firewall test).

## 2 · Verification (V2)

V2: a shared seam (three machine ingresses and the permit surface) changed; no write path, grant,
schema or provider boundary changed. Tenant and authorization impact reviewed in the discovery and
implementation reports (2026-10-20).

| Item | Measured |
|---|---|
| Baseline at `4fdb5841` | 71 tests touching the changed files: 61 PASS, 9 source-mutating excluded, 1 PRE-EXISTING red (`heby-product-ux-1/production-ux-fixes.ts`, "Hebyis") |
| After, at `ce331883` | 64 PASS (61 + 3 new), same 1 PRE-EXISTING red, 0 REGRESSION. Two pins (`rung15` band expression, `rung2-act-path` no `outcomes:` key) went red during implementation and were satisfied by changing the new code, not the pins |
| New tests | `scan-warning.ts` (one line per unsuccessful tick, none on success/empty/401, redaction, table totality, real routes 503 body unchanged); `delivery-attention.ts` (four states, window pinned to `vercel.json`, wording, rendered row, no new button, UI-graph firewall); `routes-postgres.ts` (empty migrated DB: three routes 200, body shape unchanged, no warning, no row count changed) |
| Tenant isolation | `r3a-flow/authorization-postgres.ts`, `r3a1-flow/proposal-postgres.ts`, `pbga1-purpose-bound-act/purpose-postgres.ts` PASS |
| Source-mutating tests | 9/9 PASS in a disposable detached worktree at `ce331883`. Negative controls: window drift, outcome leaked into the line, healthy tick warned — all caught |
| Static | `tsc --noEmit` 0; scoped `eslint` 0; `git diff --check` clean; `npm run build` 0 |

## 3 · Production release and acceptance

| Gate | Time (UTC) | Measured |
|---|---|---|
| Release | 2026-10-20 | `git push` `4fdb5841..ce331883 -> main` (fast-forward, no force); `origin/main` read as `ce3318834605096b4fed43c1761fc4e4c01dab49` |
| Deploy | 14:53:06Z → Ready 14:54:31Z | `dpl_569EgBfcovMo1uEFpGGL2iKGW3Gc`, target production, `githubCommitSha` `ce3318834605096b4fed43c1761fc4e4c01dab49`, ref `main`, source `git` (Vercel API `/v13/deployments`). Aliases `www.hebuntech.com`, `hebuntech.com`, `hebun-ai-recovered.vercel.app`. Status READY. |
| Smoke | 14:54:57Z | `/` 200, `/login` 200, signed-out `/approvals` 307 → `/login`. Each of the three scan routes: no header 401 `Unauthorized`, invalid bearer 401 `Unauthorized`. No authorized scan was invoked. |
| Authenticated UI (this session) | 2026-10-20 | **BLOCKED.** The built-in browser held no Hebun session (`/approvals` → `/login`); this session does not enter production credentials. |
| Authenticated UI (Director, partial) | 2026-10-20 | Director's signed-in production screenshots, relayed in chat; not held by this session. `/approvals` renders; existing `record-work` permits are visible; the selected `record-work` permit is CONSUMED and shows **no** delivery timing line — correct, since a consumed permit is outside the timing line's eligibility (`deriveMachineDeliveryAttention` returns `null`); other visible permits are consumed or are requests awaiting authorization; the Execution Ledger renders. **No eligible active, unconsumed agent-originated `record-work` permit was present**, so the positive path (any of the four timing states) was not observed. |
| Cron warning line | 2026-10-20 | **Not observed.** No unsuccessful tick was induced and the runtime log was not read for one. |

## 4 · Not verified

- **A production warning line** (OBS-V1-CRON-LOG-PROD-1). No unsuccessful tick was observed in
  production, and none was induced. The line is proven locally only.
- **Positive-path timing line in production** (OBS-V1-AUTH-UI-1). The Director observed the signed-in
  page and the correct absence of the line on a consumed permit; no eligible permit existed, so none of
  the four timing states was seen rendered in production.
- **Standing issuance on screen.** No tenant-scoped reader of issuable requests exists; only the log
  line covers it.
- **Why a permit was not delivered** stays in the runtime log; the product shows only the effect.

## Closure Contract (v1)

- Phase: OPERATIONAL-OBSERVABILITY-V1
- Owner: apps/dashboard/src/features/cron-scan-warning (log line) and src/features/action-authorization/delivery-legibility.ts (timing classification) with the three scan routes and the approvals permit row; triggers, Action Authorization permits, machine execution, Governance, audit and providers unchanged
- Reached state: DEPLOYED
- Implementation commit: ce3318834605096b4fed43c1761fc4e4c01dab49 — released on `main` (fast-forward from 4fdb5841)
- Verification level: V2 — three machine ingresses and the shared permit surface; read-only, no write path, grant, schema or provider boundary changed
- Verification evidence: tsc --noEmit 0; scoped eslint 0; npm run build 0; 64 PASS / 0 REGRESSION over the 71-file affected set plus 3 new tests (1 PRE-EXISTING red); 9/9 source-mutating tests PASS in a disposable worktree; 3 negative controls caught
- Test environment: worktree `.claude/worktrees/operational-observability-v1`; macOS (Darwin 25.2.0); Node 24.16.0 with tsx; PostgreSQL 18 session-created initdb cluster at 127.0.0.1:55432 (UTF8), stopped after use; no provider, no model
- Deployment evidence: dpl_569EgBfcovMo1uEFpGGL2iKGW3Gc READY production at ce3318834605096b4fed43c1761fc4e4c01dab49 (githubCommitSha, ref main, source git), created 2026-10-20T14:53:06Z, ready 14:54:31Z, aliases www.hebuntech.com and hebuntech.com; smoke `/` 200, `/login` 200, signed-out `/approvals` 307, three scan routes 401 without and with an invalid bearer
- Production acceptance evidence: N/A — partial only: Director's signed-in screenshots show `/approvals` and the Execution Ledger rendering and no timing line on a consumed permit (section 3); the positive timing path and a production warning line were not observed (OBS-V1-AUTH-UI-1, OBS-V1-CRON-LOG-PROD-1)
- Deferred risks: OBS-V1-AUTH-UI-1 (DEFERRED); OBS-V1-CRON-LOG-PROD-1 (DEFERRED); OBS-V1-ISSUANCE-SURFACE-1 (DEFERRED)
- Director approvals: read-only discovery 2026-10-20; narrow implementation, focused tests and local commit ce331883 2026-10-20; release verification, fast-forward push of ce331883, production deployment verification, read-only smoke and local closure documentation 2026-10-20; Director's partial authenticated production evidence recorded 2026-10-20; push of this documentation commit NOT approved

### Deferred risk detail

- **OBS-V1-AUTH-UI-1 (DEFERRED).** Narrowed 2026-10-20: the signed-in page and the negative path (no
  line on a consumed permit) were observed by the Director. Still open: a timing state rendered for an
  active, unconsumed agent-proposed `record-work` permit. Acceptance dependency: a signed-in read while
  such a permit exists organically; no permit is created to force it.
- **OBS-V1-CRON-LOG-PROD-1 (DEFERRED).** No production warning line observed. Acceptance dependency:
  an organically unsuccessful tick read from the Vercel runtime log (for example while machine
  delivery is disarmed and an agent-proposed permit is active); no failure is induced.
- **OBS-V1-ISSUANCE-SURFACE-1 (DEFERRED).** Standing issuance has log visibility only. Acceptance
  dependency: a Director decision on a tenant-scoped reader of issuable requests.

**Lesson.** Operational visibility for a trigger that by design persists nothing comes from two
places only: a redacted log line for the tick, and the authoritative rows' own state on screen. Any
in-product "why" needs a separately decided record, not a trigger that remembers.
