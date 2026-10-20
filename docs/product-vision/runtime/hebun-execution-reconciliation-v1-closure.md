# EXECUTION-RECONCILIATION-V1 · closure record · PRODUCTION-ACCEPTED

The Execution Ledger on `/approvals` now presents its attention list as a read-only **Needs
Reconciliation** view. Every `unknown` or `pending` execution attempt states why it is listed, its age
measured from the ledger read's own instant, its request, permit, attempt and adapter references, and
— where the provider returned no reference — the explicit line "Provider operation reference:
unavailable". Every candidate carries "Do not repeat this operation until its external outcome has
been checked."

It extends GOVERNED-EXECUTION-1's ledger and nothing else. It adds no table, no migration, no SQL
statement, no server action, no control, no permission, no background job and no provider call.
Execution state, permits, Governance and audit keep their owners. `EXECUTION_RETRY_POLICY.automaticRetries`
stays `0`.

## 1 · What was released

| Commit | Content |
|---|---|
| `3cb94b11` | `feat(execution): show why each attempt needs reconciliation`. `contracts.ts` (`EXECUTION_IN_FLIGHT_WINDOW_MS`, `reconciliationReasonFor`, `RECONCILIATION_WORDING`, title "Needs Reconciliation"), `execution-ledger-projection.server.ts` (`readAt` only), `execution-ledger.tsx` (reason, age, request ref, unavailable provider ref), `approvals/page.tsx` (passes `readAt`), `tests/ge1-ledger/surface-rendering.ts` (new required prop, scenario 9), new `tests/execution-reconciliation-v1/reconciliation.ts`. |
| `510db473` | `fix(execution): keep reconciliation wording advisory` — architecture safety review: no stopped-execution claim, no reassurance on in-flight `pending`, "Do not repeat" on every candidate. |
| `32b18dee` | `fix(execution): name the 3-minute pending mark an attention threshold` — release review wording. |

On `main`: fast-forward `5330d868 → 32b18dee`, pushed by the Director; `origin/main` read as
`32b18dee` on 2026-10-20.

**Classification (pure, `contracts.ts`).** List membership is unchanged and state-only
(`UNRECONCILED_ATTEMPT_STATUSES` = `pending`, `unknown`, read by the existing DB predicate). The reason
only says WHY a row is there:

| Status | Reason | Wording (summary) |
|---|---|---|
| `unknown` | `outcome-unknown` | Outcome requires verification; provider outcome is not confirmed |
| `pending`, older than 180 s | `pending-past-execution-window` | Outcome requires verification after 3 minutes, "this list's attention threshold, not a deadline"; does not mean execution stopped; the provider may still have completed it |
| `pending`, 180 s or younger, or unreadable start | `pending-may-be-in-flight` | May still be in progress; outcome not yet known |
| `accepted`, `failed`, `refused` | none | Never a candidate, at any age |

**Why 180 s.** The only writer of an attempt is `executeAuthorizedAction`, called only by the
`/approvals` server action. It commits `pending` in the spend transaction and terminalizes the row in
the same invocation; no worker, cron, `after()` or retry resumes it. `/approvals` declares
`maxDuration = 180`; a test pins the constant to it. It is an attention threshold, not proof that
execution stopped: the host enforces the bound, and an action can run under another route's function.

## 2 · Verification (V2)

V2: one shared seam (the execution ledger projection and its surface) changed; no write path, grant,
schema or provider boundary changed. Tenant/authorization impact reviewed in writing (architecture
safety review, 2026-10-20): no new audience, no new field beyond `requestId` (already sent to client
components on the same page), no new path.

| Item | Measured |
|---|---|
| Static checks at `32b18dee` | `tsc --noEmit -p .` 0; `eslint` on changed source and tests 0; `git diff --check` clean; `npm run build` 0 |
| Phase tests at `32b18dee` | `tests/execution-reconciliation-v1/reconciliation.ts` PASS (reason ⇔ attention for every status and age, window pinned to `/approvals` `maxDuration`, two SELECTs and zero insert/update/delete/transaction/execute, no tenant ⇒ store not resolved); `tests/ge1-ledger/surface-rendering.ts` PASS; `tests/ge1-ledger/ledger-read-firewall.ts` PASS; `tests/e2-4-attention-observation/firewall.ts` PASS |
| Tenant isolation (Postgres) at `3cb94b11` | `tests/r3b-flow/execution-postgres.ts` (second tenant sees no attempts), `esa-external-send-arming/arming-postgres.ts`, `r2h-flow/control-source-postgres.ts`, `r3b-flow/arming-durability.ts`, `r5-1-flow/ceremony-postgres.ts` — 5/5 PASS. Reused for `32b18dee`: reader and projection SQL unchanged since. |
| Source-mutating tests | `ge1-ledger/bite-proofs.ts`, `r3b-flow/boundaries-and-firewall.ts` PASS at `510db473`; `g4-flow/possession-and-firewall.ts` PASS at `3cb94b11`; each in a disposable detached worktree. Negative controls: window drift and "fresh pending called stale" both caught. |
| Pre-existing | `tests/heby-product-ux-1/production-ux-fixes.ts` red ("Hebyis") on unchanged `5330d868` — not a regression. |

## 3 · Production release and acceptance

| Gate | Time (UTC) | Measured |
|---|---|---|
| Release | 2026-10-20 | Director push `5330d868..32b18dee -> main`; `origin/main` read as `32b18deea11636a0d901534c7a55b9ec691ffd2c` by this session |
| Deploy | 13:42:38Z → Ready 13:44:15Z | `dpl_9kfPQJ4XU87kdH7HtWuWZANtsU3Q`, target production, `githubCommitSha` `32b18deea11636a0d901534c7a55b9ec691ffd2c`, ref `main`, source `git` (Vercel API `/v13/deployments`). Aliases `www.hebuntech.com`, `hebuntech.com`, `hebun-ai-recovered.vercel.app`. Status READY. |
| Smoke | 13:45:36Z | `/` 200, `/login` 200, signed-out `/approvals` 307 → `/login` |
| Authenticated UI (this session) | 2026-10-20 | **BLOCKED.** The built-in browser held no Hebun session (`/approvals` → `/login`), and this session does not enter production credentials. Nothing was observed signed in by this session. |
| Director acceptance | 2026-10-20 | The Director, signed in, opened production `/approvals` and verified it by screenshot: the Execution Ledger renders; the "Needs Reconciliation" section is visible with attention count 0; an existing `accepted` execution record renders, with provider acceptance distinguished from message delivery; no new automatic execution control is visible. **Provenance:** Director's observation and screenshot, relayed in chat 2026-10-20; this session did not hold the screenshot or open production data. |

## 4 · Not verified

- **`unknown` and `pending` rendering in production** (EXEC-RECON-V1-AUTH-UI-1): the Director observed
  attention count 0, so no candidate row, reason line, age, "Do not repeat" line or "Provider operation
  reference: unavailable" line was seen in production. These states are proven by local
  server-rendering tests only. No production record was created to force them.
- **Host enforcement of `maxDuration`** (EXEC-RECON-V1-WINDOW-BOUND-1): not measured. The 180 s mark is
  worded as an attention threshold for that reason.
- **Real provider:** none contacted in any phase of this work.

## Closure Contract (v1)

- Phase: EXECUTION-RECONCILIATION-V1
- Owner: apps/dashboard/src/features/action-execution (contracts.ts classification and wording, execution-ledger-projection.server.ts read instant) with components/decision-workspace/execution-ledger.tsx; action-execution lifecycle, Action Authorization permits, Governance, audit and provider adapters unchanged
- Reached state: PRODUCTION-ACCEPTED
- Implementation commit: 3cb94b11, 510db473, 32b18dee — released on `main` (fast-forward from 5330d868)
- Verification level: V2 — the shared execution ledger projection and its surface; read-only, no write path, grant, schema or provider boundary changed
- Verification evidence: tsc --noEmit 0; eslint on changed files 0; npm run build 0; tests/execution-reconciliation-v1/reconciliation.ts PASS; tests/ge1-ledger/surface-rendering.ts PASS; tests/ge1-ledger/ledger-read-firewall.ts PASS; tests/e2-4-attention-observation/firewall.ts PASS; 5 Postgres tests PASS at 3cb94b11 (readers unchanged since); bite-proofs PASS in disposable worktrees
- Test environment: worktree `.claude/worktrees/execution-reconciliation-v1`; macOS (Darwin 25.2.0); Node 24.16.0 with tsx; PostgreSQL 18 session-created initdb cluster at 127.0.0.1:55432 (UTF8, builtin C.UTF-8), stopped after use; no provider, no model
- Deployment evidence: dpl_9kfPQJ4XU87kdH7HtWuWZANtsU3Q READY production at 32b18deea11636a0d901534c7a55b9ec691ffd2c (githubCommitSha, ref main, source git), created 2026-10-20T13:42:38Z, ready 13:44:15Z, aliases www.hebuntech.com and hebuntech.com; smoke `/` 200, `/login` 200, signed-out `/approvals` 307
- Production acceptance evidence: Director signed-in verification of production `/approvals` by screenshot, 2026-10-20 — Execution Ledger renders, Needs Reconciliation section visible with attention count 0, an existing accepted record renders with provider acceptance distinguished from delivery, no new automatic execution control; scoped to the observed states (unknown and pending production rendering not observed, EXEC-RECON-V1-AUTH-UI-1)
- Deferred risks: EXEC-RECON-V1-AUTH-UI-1 (DEFERRED); EXEC-RECON-V1-WINDOW-BOUND-1 (DEFERRED)
- Director approvals: implementation, focused testing and local commit 3cb94b11 (2026-10-20); architecture safety review and corrective commit 510db473 (2026-10-20); release, push and production deployment authorized 2026-10-20 — the push was performed by the Director (`5330d868..32b18dee`); closure documentation and one local documentation commit 2026-10-20; production acceptance for the observed states recorded from the Director's verification 2026-10-20; push of the documentation commit NOT approved

### Deferred risk detail

- **EXEC-RECON-V1-AUTH-UI-1 (DEFERRED).** Narrowed 2026-10-20: signed-in rendering of the ledger, the
  section, the empty attention state and an `accepted` row was verified by the Director. Still open:
  production rendering of an `unknown` or `pending` candidate. Acceptance dependency: a signed-in read
  of `/approvals` while such an attempt exists organically; no record is fabricated to force it.
- **EXEC-RECON-V1-WINDOW-BOUND-1 (DEFERRED).** The 180 s threshold mirrors `/approvals`
  `maxDuration`; host enforcement is not measured and a server action can execute under another route's
  function. Non-blocking: the wording claims an attention threshold only. Acceptance dependency: a
  Director decision to either measure the bound or leave it advisory.

**Existing contract, not a new risk.** `/approvals` is readable by every authenticated member of the
tenant; consequential controls are gated in their server actions. This phase widened neither.

**Lesson.** Execution reconciliation stays a read-only visibility capability unless a separately
authorized reconciliation lifecycle is designed. An aged `pending` attempt is an attention candidate,
not evidence of failure.
