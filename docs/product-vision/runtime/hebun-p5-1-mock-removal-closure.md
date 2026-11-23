# P5-1 — Mock agent, workflow and orchestration surfaces deleted

First slice of the P5 commercial scope (`docs/product-vision/runtime/hebun-p5-scope-design-gate.md`),
Director decision D7: mock surfaces are deleted, not hidden. Released by PR #22, merge `b6957e2d`.

## What changed

- Deleted `features/agents/mock.ts`, `features/workflows/mock.ts` and the simulation chain that
  consumed them: `features/orchestration`, `components/orchestration`, `features/planning` (except
  `types.ts`, still a type-only input of `workflow-runtime`), `components/planning`,
  `features/execution`, `features/offline-execution`, `components/offline-execution`, and the route
  `/director/offline-execution` with its two navigation entries.
- The agent and workflow CRUD adapters start empty. No compiled-in record seeds either store.
- The organization projection no longer reads seeded departments. The workflow projection receives no
  generated plan (`buildPlan` already accepts `undefined`). Execution shadow-read compares only an
  injected memory summary; no in-memory execution runtime exists to read.
- `/hr`, `/finance`, `/legal` lost their "seeded definitions" agent cards, and `/finance` its Finance
  Workflows block. Their own illustrative KPIs are outside P5 and keep their legacy notice.
- System Details lost the Planning, Orchestration and Offline Execution widgets.

Out of scope and unchanged: the other 16 `mock.ts` modules (hr, finance, legal, approvals,
architecture, director, organization and others), the mock-surface gate, and every route not listed
above.

## What is proven

- **Acceptance criterion 1.** The value-import closure of the three P5-1 roots
  (`features/agents/mock`, `features/workflows/mock`, `features/orchestration`) over `src` is 0 files
  and 0 routes. Before the change it was 78 files and 7 routes.
- **Acceptance criterion 2.** No listed surface renders a record-less agent count. The demo-shell
  `active-agents` count is pinned at 0 (`mock-surface-gating`).
- **Acceptance criterion 3.** `/agents` reads only the CRUD store, which now starts empty. Durable
  agents keep their own path and are unchanged.
- **Test pins moved in the same change, each with its reason:**
  - anti-shrink mock floors 18 → 16 (`mock-surface-gating`, `truth1`, `stage1-knowledge`);
  - route count 138 → 137 (`cmdb2`);
  - "load-bearing mock retained" assertions inverted to "retired" (`operations-legacy`, `phase-25c`,
    `phase-25d`, `trh12`);
  - the dashboard-evidence "other producer unaffected" check now compares against the agent store.
- **Durable-authority boundary kept, not dropped.** TRH-12's "no mock definition reaches the durable
  authority" is restated on the CRUD adapter. No security, tenant or authorization assertion was
  weakened.
- **Test fixtures.** Engine suites that classify seeded records now load test-owned records from
  `tests/helpers/crud-fixtures.ts`. Nothing in `src` imports that file.

## What is not proven

- Signed-in rendering of `/hr`, `/finance`, `/legal` and `/agents` in production was not observed.
  Unauthenticated, `/hr` redirects to `/login` (307), as before.
- The first full-suite run on `63b153be` timed out once in `l4-live-map/bite-proofs` (defending suite
  over 300 s). Locally on the same change it passed in 4 s with 16/16 mutations bitten, and the
  second full-suite run passed. The timeout is unexplained.

## Closure Contract (v1)

- Phase: P5-1-MOCK-REMOVAL
- Owner: P5 commercial scope design gate (`docs/product-vision/runtime/hebun-p5-scope-design-gate.md`), slice P5-1
- Reached state: DEPLOYED
- Implementation commit: 87276cf30cc05f9841bfdff1404daef5a6cd1203 (feature 63b153be plus test-fixture fix; released on main by merge b6957e2daa4fbae453714fe1f4540da14e8f8cae)
- Verification level: V2 — shared seams (agent and workflow CRUD adapters, organization and workflow projections, execution shadow-read) feed many suites; every consuming suite was run. The full suite ran on the pull request as the required merge check.
- Verification evidence: tsc --noEmit 0 errors; eslint clean on changed files; next build exit 0; 97 affected suites without regression and 6 bite-proofs green in a disposable worktree (local); full-suite run 45151299906 on 87276cf3: 1180 passed, 0 failed, 2 excluded (manifest: r3w-flow/ambient-database-safety BLOCKED, plan-step-idempotency-1/bite-proofs PRE-EXISTING); quick, targeted and Vercel checks passed on PR #22
- Test environment: local macOS worktree, Node 24, no local PostgreSQL (7 Postgres suites BLOCKED locally with ECONNREFUSED, also red on unchanged main); GitHub Actions full-suite with disposable PostgreSQL
- Deployment evidence: GitHub deployment record for b6957e2d, environment Production, state success, created 2026-11-23T10:46:02Z, environment URL hebun-ai-recovered-8tjyo0tma-hebuntechs-projects.vercel.app; www.hebuntech.com / and /login 200, /hr 307 to /login without a session
- Production acceptance evidence: N/A — signed-in rendering of the changed routes was not observed; P5 production acceptance is P5-9
- Deferred risks: P5-1-SIGNED-IN-RENDER-1 (DEFERRED); P5-1-L4-BITE-PROOF-TIMEOUT-1 (DEFERRED)
- Director approvals: P5 design gate decisions D1–D7, 2026-11-20; PR #21 merge, 2026-11-23; P5-1 start, commit, PR #22 and merge on green checks (production deploy), 2026-11-23; this closure record, 2026-11-23

### Deferred risk detail

- **P5-1-SIGNED-IN-RENDER-1 (DEFERRED).** Nobody has looked at `/hr`, `/finance`, `/legal` and
  `/agents` in production with a signed-in session since the merge. Acceptance dependency: one
  signed-in read on the TRH tenant, done during P5-9 or earlier, confirming no seeded agent card or
  Finance Workflows block renders and `/director/offline-execution` is gone.
- **P5-1-L4-BITE-PROOF-TIMEOUT-1 (DEFERRED).** `l4-live-map/bite-proofs` timed out once in CI (defending
  suite over 300 s) on `63b153be`. It passed locally on the same tree in 4 s and on the next CI run. A
  second timeout on any pull request reopens it as a CI reliability item. Acceptance dependency: none
  for P5.

## Weekly three questions

1. **What did we learn?** Deleting a mock root reaches far past its importers: anti-shrink floors,
   route counts, "retained" assertions and demo-shell counts all pinned it. Compute the value-import
   closure first, then search the tests for the path, its consumers and its counts. A suite that needs a
   seeded record should own a fixture, not rely on the product to seed one.
2. **How does this improve Turkish Rug House?** TRH's people no longer meet 36 invented agents or a fake
   orchestration pipeline next to the one real agent they run. What they see about agents is what Hebun
   holds.
3. **How does this become part of Hebun AI?** The agent templates (P5-3) and the per-agent activity view
   (P5-6) now build on a store that holds only real records, so nothing a customer sets up is mixed with
   fixtures.
