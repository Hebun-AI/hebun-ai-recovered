# ENTERPRISE-OPERATIONS-1 · closure record · PRODUCTION-ACCEPTED (scoped)

**Scope, stated first.** The governed organizational work loop (Command → Heby → Approvals → executed
internal act → work register) is released in production deployment `dpl_EQfFX6okMJsqeqjJ2uw9G3Gvc3go` and
was walked signed in, read-only, as the tenant **Hebun AI** (`f625b683…`) in a session the Director opened
(no credential entered by this session; nothing approved, executed, revoked, created or modified). It is
accepted on exactly what that walk observed (section 4). **Not observed:** a Heby action that throws, any
refusal message, and the `Authorized · not yet executed`, expired and revoked permit wordings — no such
permit existed in the tenant. Those stay UNVERIFIED (`EO1-PROD-UNOBSERVED-STATES-1`). §16.1 keeps the state
one of six and puts the qualifier in the evidence text.

## 1 · Problem

The server side of the loop was consistent: tenant from the session, Governance checked at approve,
revoke and every spend, single-spend enforced by a conditional update and unique indexes. The loop broke
between surfaces:

- the work register (`/director/work`), where every executed `record-work` and `set-work-declared-state`
  permit lands, was reachable from no navigation row and no link, while Command's work region said
  "Progress lives in Operations" and linked `/operations`, which neither lists nor records work;
- every server-action call in the Heby conversation hook was `try/finally` with no `catch`, so an action
  that threw left its "in progress" placeholder on screen for good (`AI-PLAN-UI-THROW-1` was one of
  seven such sites); the agent-availability check and the work-state proposal had the same gap;
- an executed internal permit named the work register without linking it; internal-act, approve,
  refuse and revoke refusals on `/approvals` were bare codes;
- `/approvals` said "Operations runs the authorized work" — execution happens on `/approvals`;
- `/command/intent`, linked from Command as "What do you want your organization to do?", takes no input,
  said "No language model connected" and "One action kind has a connected execution runtime" while its
  own model counts six;
- the work-state chooser labelled every ineligible agent "not responsible for this work domain"
  (`AP5-WORKSTATE-REASON-COPY-1`);
- an expired permit read "Permit expired" under "Approved" with no word on whether it could still run
  (`PERMIT-EXPIRED-STATUS-1`).

## 2 · What was released

| Commit | Content |
|---|---|
| `f5d0a282` | `feat(operations): connect the governed work loop end to end`. 21 files, +692 / −50: `work-in-motion.tsx` (link `/director/work`), `action-authorizations.tsx` (work-register link on a spent internal permit, worded refusals, expired/revoked outcome sentences), `execution-refusal-wording.ts` (every internal-act, decision, revocation and work-register refusal), `approvals-dashboard.tsx` and `approvals-dashboard/model.ts` (worded bulk refusals; permit status per state), `decision-handoff-boundary.tsx`, `director-intent.tsx`, `use-heby-conversation.ts` (catch at every action), `heby-origination-affordance.tsx`, `heby-my-requests.tsx`, `heby-work-state-affordance.tsx`, `heby-work-state-selection.tsx` (next-step and back links, interruption handling, real chooser reason), `work-register.tsx`, `agent-outcome-observation.tsx` (Decisions link, no control), `origination-availability` contracts and reader (per-agent mandate admission), two new tests under `tests/enterprise-operations-1/`, two extended tests, two `learnings.md` lines |

On `main`: fast-forward `2e904e00 → f5d0a282` (GitHub `2e904e00..f5d0a282 -> main`); remote HEAD re-read
immediately before the push and proven to be the release commit's parent.

**Unchanged:** schema and migrations, dependencies, configuration, authentication and session (no file
under `src/app/login`, `src/middleware.ts` or `src/features/auth-runtime` changed), Governance authority,
permit issuance, consumption and stored lifecycle, executors, writers, providers, arming, Heby model
paths. Links and words only, plus one bounded read: the work-state chooser reads each in-service agent's
current mandate through the released reader to name why it is ineligible; the preflight and the spend
still decide.

**Not released: `WORK-UPDATE-LOGIN-QUERY-LOSS-1`.** A `?next=` return path (closed allow-list, internal
paths only, per-path lookup keys, re-validated at middleware, page and action; six bite-proofs caught)
was implemented and then reverted: the full suite rejected it on `tests/d1-flow/boundaries-and-firewall.ts`,
which pins the login form to exactly `email` and `password`. That is a security assertion and is not
widened without a named Director exception, and carrying the same client input past it by another channel
was refused. The risk is `BLOCKED` below.

## 3 · Verification (V2)

V2: shared Approvals, Heby and Command surfaces and one shared origination read; no authority, tenant,
lifecycle, schema, provider or execution boundary changed in the released content. A full suite was run
because the candidate briefly touched sign-in (V3 then), and the reconciliation is recorded.

| Item | Measured |
|---|---|
| Baseline (detached worktree at `2e904e00`, session-owned PostgreSQL) | 1081 PASS / 2 FAIL / 1083: `r3w-flow/ambient-database-safety.ts` BLOCKED (canonical `hebun_r1` at :55432 unreachable); `plan-step-idempotency-1/bite-proofs.ts` red |
| New tests | `tests/enterprise-operations-1/workflow-handoffs.ts` (mount, render and stale-claim negatives for Command, Approvals, Director Intent, PermitRow, Agents; every refusal vocabulary parsed and worded; every hook `finally` preceded by a `catch`) and `permits-and-next-steps.ts` (permit status per state, never worded executable when not; lifecycle next step; work-item back link) PASS |
| Real-Postgres tests extended | `heby-verified-work-outcomes/work-outcomes-postgres.ts`: on rows produced by propose → approve → execute, the next step leads to `/director/work`, the executed item is on the register, the expired permit reads "Authorization expired · cannot be executed" and its stored status stays `active`. `work-update-agent-selection-1/selection-postgres.ts`: pin updated in the same change — Atlas (mandate `record-work` only) is `ineligible: kind-outside-mandate` |
| Bite-proofs (disposable copies) | 12/12 for the handoffs and 5/5 for permits and next steps caught (plus 6/6 for the reverted return path) |
| Full suite on the candidate including the return path | 1082 PASS / 3 FAIL / 1085: `d1-flow/boundaries-and-firewall.ts` REGRESSION from the return path (reverted; PASS on the released content); `plan-step-idempotency-1/bite-proofs.ts` PRE-EXISTING — same first assertion in baseline and change under suite load, PASS standalone in both; `r3w-flow/ambient-database-safety.ts` BLOCKED, not a pass |
| Released content | the reverted login files byte-identical to `2e904e00`; 15 suites touching sign-in and the changed surfaces re-run PASS; `tsc --noEmit` exit 0; `eslint` on changed files exit 0; `npm run build` exit 0; `git diff --check` clean |
| Local mounted-route render | worktree dev server without database: `/command` → "Open work register" clicked → `/director/work` rendered; `/command/intent` "Tell Heby what you want" → `/heby`, "6 consequential action kinds have a connected execution runtime"; `/approvals` Operations row corrected and work-register row present (inside the collapsed boundary disclosure); no console errors |

## 4 · Production release

| Gate | Time | Measured |
|---|---|---|
| Release | 2026-10-25 ~09:59Z | `origin/main` = `f5d0a282f72fd90eb5e26c0d6fd5d80b04997cc5`, parent `2e904e00` (`git ls-remote`, re-read after push) |
| Deploy | created 2026-10-25 10:00:20Z | `dpl_EQfFX6okMJsqeqjJ2uw9G3Gvc3go`, target production, Ready (`vercel inspect`); the only deployment listed by `vercel ls --meta githubCommitSha=f5d0a282…` |
| Aliases | 2026-10-25 | `www.hebuntech.com`, `hebuntech.com` on `dpl_EQfF…` (`vercel inspect`, `vercel alias ls`); apex 308 → www |
| HTTP boundary | 2026-10-25 | `/command`, `/heby`, `/approvals`, `/director/work`, `/command/intent`, `/agents` 307 → `/login` signed out; `/login` 200 |
| Runtime logs | release to ~10:05Z | 25 lines sampled: the only error-level record is the known pg sslmode deprecation warning; no error, fatal or 5xx |
| Signed-in view | 2026-10-25 | Built-in browser, a session the Director signed in themselves, tenant Hebun AI; served HTML carried `dpl_EQfFX6okMJsqeqjJ2uw9G3Gvc3go` |
| Director scoped acceptance | 2026-10-25 | PRODUCTION-ACCEPTED — scoped, on exactly the evidence in this record |

**What the signed-in walk showed (read from page text; only links and read-only panels opened).**

| Step | Route · component | Observed | Verdict |
|---|---|---|---|
| Command | `/command` · `WorkInMotion` | "5 work in motion", three items with "Declared by a human", "+2 more in the work register", link "Open work register" → `/director/work`; "Progress lives in Operations" absent | VERIFIED |
| Work register | `/director/work` · `WorkRegisterPanel` | reached by clicking that link; five in-service items, each with "Ask Heby to propose a state change" → `/heby?workItem=…` | VERIFIED |
| Heby with a work item | `/heby?workItem=5ba33201…` · `HebyWorkStateSelection` | "AP-5 two-agent origination acceptance check · currently planned"; chooser lists "Engineering Agent — its mandate does not include work state changes" (disabled) and "Heby" (selectable); "Back to the work register" → `/director/work` — the exact case AP5-WORKSTATE-REASON-COPY-1 recorded | VERIFIED |
| Heby · Your requests | `/heby` · `HebyMyRequests` | ten requests read; pending ones link "Open Approvals" → `/approvals`; executed record-work ones link "Open the work register" → `/director/work`; rejected ones carry no link | VERIFIED |
| Approvals | `/approvals` · `ApprovalsDashboard`, `PermitRow`, `DecisionHandoffAndBoundary` | caption "Accepted reviews / permits in any state"; seven permits "Executed · authorization spent"; no "Permit active/expired/consumed/revoked" text; inspector permit row "Open the work register"; boundary Operations row "It does not execute: an authorized act runs only from its permit…" and work-register row present; "Operations runs the authorized work" absent | VERIFIED |
| Director Intent | `/command/intent` · `DirectorIntent` | "Tell Heby what you want" → `/heby`; "6 consequential action kinds have a connected execution runtime"; "never authorizes"; no stale claim | VERIFIED |
| Agents | `/agents` · `AgentOutcomeObservationSurface` | "Pending proposals are decided, and live authorizations executed or revoked, in Decisions." with link → `/approvals` | VERIFIED |
| Console | all routes above | React error #418 (hydration text mismatch) reproduced on `/approvals`; attributed to `PermitRow`'s `expires {new Date(…).toLocaleString()}` (server UTC vs browser Europe/Istanbul: rendered "10/17/2026, 10:21:11 PM"), a line unchanged since `2e904e00` — PRE-EXISTING, not introduced here (`APPROVALS-EXPIRY-HYDRATION-1`). The console buffer did not reset on in-app navigation, so per-route attribution beyond `/approvals` is not claimed | PRE-EXISTING |

**Found during the walk, not changed by it.** One executed request reads "The authorization was used, but no
delivery attempt is recorded, so no effect can be claimed." and carries no link: `INTERNAL_ACTION_KINDS` in
`heby-origination-affordance.tsx` lists `record-work` and `place-human-in-department` but not
`set-work-declared-state`, so an executed work-state change is described as an external act
(`EO1-WORKSTATE-LIFECYCLE-WORDING-1`). Pre-existing since WORK-UPDATE V1; the work itself is correct and on the
register. Not repaired here by Director instruction (no development reopened).

This session wrote nothing to production data, Governance, providers or credentials.

## 5 · Not verified in production

- **Unobserved states (EO1-PROD-UNOBSERVED-STATES-1).** A Heby action that throws (the interruption block),
  any worded refusal on `/approvals` or in Heby, and the `Authorized · not yet executed`, expired and revoked
  permit wordings were not seen: none occurred, none was provoked, and the tenant held no such permit. They
  are proven by structure, bite-proofs, render tests and real-Postgres tests only.
- Other organizations were not viewed; isolation is the released session resolution, unchanged here.

## Closure Contract (v1)

- Phase: ENTERPRISE-OPERATIONS-1
- Owner: apps/dashboard customer surfaces of the governed work loop — command-work, decision-workspace (PermitRow, refusal wording, handoff boundary), approvals-dashboard, director-intent, the Heby conversation hook and its affordances, organizational-work register panel, agents outcome surface, and the origination-availability chooser read; Governance, action authorization, governed internal executors, Organizational Work writers, authentication and session unchanged
- Reached state: PRODUCTION-ACCEPTED
- Implementation commit: f5d0a282f72fd90eb5e26c0d6fd5d80b04997cc5 — released on `main` (fast-forward from 2e904e00)
- Verification level: V2 — shared Approvals, Heby and Command surfaces and one shared origination read; full suite run once because the candidate briefly touched sign-in, reconciled in section 3
- Verification evidence: at f5d0a282, 2026-10-25: tests/enterprise-operations-1/workflow-handoffs.ts and permits-and-next-steps.ts exit 0 PASS; heby-verified-work-outcomes/work-outcomes-postgres.ts and work-update-agent-selection-1/selection-postgres.ts exit 0 PASS against a session-owned database; bite-proofs 17/17 caught; tsc exit 0, eslint exit 0, npm run build exit 0, git diff --check clean; full suite on the candidate with the return path 1082 PASS / 3 FAIL / 1085 against baseline 1081 PASS / 2 FAIL / 1083 — d1-flow REGRESSION removed by reverting the return path (PASS on released content), plan-step-idempotency-1/bite-proofs.ts PRE-EXISTING (identical first assertion, PASS standalone in both trees), r3w-flow/ambient-database-safety.ts BLOCKED (not a pass); 15 suites touching sign-in and the changed surfaces re-run PASS on the released content
- Test environment: worktree `.claude/worktrees/enterprise-operations-1` at 2e904e00 then f5d0a282; disposable detached worktrees for baseline, candidate suites and bite-proofs (removed); macOS (Darwin 25.2.0); Node 24.16.0 with tsx; Next 16.3.8; session-owned PostgreSQL 18 at 127.0.0.1:55447 (own initdb, system_identifier 7700520261864430448) via HEBUN_TEST_ADMIN_DATABASE_URL; local dev server without environment; no production database, no provider, no model
- Deployment evidence: dpl_EQfFX6okMJsqeqjJ2uw9G3Gvc3go READY production, created 2026-10-25T10:00:20Z by the git integration, the only deployment for githubCommitSha f5d0a282, aliases www.hebuntech.com and hebuntech.com
- Production acceptance evidence: SCOPED — (a) measured read-only: remote main f5d0a282, deployment Ready and aliased, served dpl marker on the signed-in pages, six loop routes 307 to /login signed out, sampled logs show only the known pg sslmode warning; (b) signed-in read-only walk as tenant Hebun AI (f625b683): /command Work in motion links /director/work and the click reached the register (5 items); /heby?workItem chooser shows "Engineering Agent — its mandate does not include work state changes" and Back to the work register; Your requests links pending to /approvals and executed record-work to /director/work; /approvals shows the new caption, seven "Executed · authorization spent" permits, the work-register link and the corrected boundary; /command/intent hands off to /heby with the counted runtimes; /agents links Decisions; React #418 on /approvals PRE-EXISTING (APPROVALS-EXPIRY-HYDRATION-1); nothing approved, executed, revoked, created or modified; (c) Director-authorized scoped acceptance 2026-10-25. Thrown-action, refusal, active, expired and revoked permit states UNVERIFIED (section 5)
- Deferred risks: AI-PLAN-UI-THROW-1 (CLOSED); AP5-WORKSTATE-REASON-COPY-1 (CLOSED); PERMIT-EXPIRED-STATUS-1 (CLOSED); OR1-ARMING-COPY-1 (CLOSED); WORK-UPDATE-LOGIN-QUERY-LOSS-1 (BLOCKED); EO1-PROD-SIGNED-IN-1 (CLOSED); EO1-PROD-UNOBSERVED-STATES-1 (DEFERRED); EO1-WORKSTATE-LIFECYCLE-WORDING-1 (DEFERRED); APPROVALS-EXPIRY-HYDRATION-1 (DEFERRED)
- Director approvals: ENTERPRISE-OPERATIONS-1 implementation mandate 2026-10-25; completion pass and one local implementation commit 2026-10-25; controlled release — fast-forward push of f5d0a282 with its automatic production deployment and read-only verification 2026-10-25 (push executed by this session); WORK-UPDATE-LOGIN-QUERY-LOSS-1 kept BLOCKED by Director instruction; signed-in read-only production acceptance in a Director-opened session, PRODUCTION-ACCEPTED — scoped, and one local documentation-only commit 2026-10-25; push of this documentation NOT approved

### Deferred risk detail

- **AI-PLAN-UI-THROW-1 (CLOSED).** Fixed at its root in `f5d0a282`: every awaited server action in the
  Heby hook has a `catch` that replaces the placeholder with an unavailable block, and the AI plan's names
  `/plan` as the model-free alternative. Pinned structurally and by bite-proof. Production render of a
  thrown action is not observed (EO1-PROD-UNOBSERVED-STATES-1).
- **AP5-WORKSTATE-REASON-COPY-1 (CLOSED).** The chooser says "its mandate does not include work state
  changes" when the kind is outside the mandate, "not responsible for this work domain" only when the
  domain is, and "eligibility could not be confirmed" when the mandate was unreadable. Proven on real rows.
- **PERMIT-EXPIRED-STATUS-1 (CLOSED).** Presentation only, as the Director directed: the queue and the
  permit row say whether a permit can still run (active / expired / revoked / spent / unknown); the
  reader's own derived state is used, nothing re-derives expiry, and the stored lifecycle is untouched
  (proven: an expired permit's stored status remains `active`). Permits still count under "Approved",
  now captioned "permits in any state".
- **OR1-ARMING-COPY-1 (CLOSED).** Resolved in `658762a5` (PRODUCT-INTEGRATION-1) and observed in production
  on `dpl_wB8NvLRUmvAGStyFD4UiAN1o1zeF`: "Arming is a platform operator ceremony; it is not available in
  the app today." Recorded closed here, where the index is next touched.
- **WORK-UPDATE-LOGIN-QUERY-LOSS-1 (BLOCKED).** Measured: the middleware drops path and query, and a
  single-membership sign-in lands on `/command` (not Heby, as the original record said). A safe return
  path was built and bite-proofed but needs a third login form field, which the D1 security pin forbids.
  Blocks its own resolution until a Director exception names `tests/d1-flow/boundaries-and-firewall.ts`
  and its pattern (`formData.get` reads exactly `email`, `password`) to admit one validated, non-authority
  `next` field with its own negative control; the forged-identity list stays unchanged.
- **EO1-PROD-SIGNED-IN-1 (CLOSED).** Its dependency — a read-only signed-in walk of `/command` → `/heby` →
  `/approvals` → `/director/work`, executing nothing — was met on 2026-10-25 (section 4).
- **EO1-PROD-UNOBSERVED-STATES-1 (DEFERRED).** Thrown-action, refusal, active, expired and revoked permit
  wordings not observed in production. Acceptance dependency: a read-only observation when such a state
  occurs naturally (no state is to be provoked by a real act for acceptance).
- **EO1-WORKSTATE-LIFECYCLE-WORDING-1 (DEFERRED).** An executed `set-work-declared-state` request is worded
  as an external act with no effect claimed and no register link, because `INTERNAL_ACTION_KINDS` omits it.
  Pre-existing; legibility only. Acceptance dependency: a Director-selected fix adding the kind (and its own
  wording) to the lifecycle description and its next step.
- **APPROVALS-EXPIRY-HYDRATION-1 (DEFERRED).** `/approvals` raises React #418: the permit expiry is formatted
  with the runtime's locale and time zone on the server and again in the browser. Pre-existing; the page
  recovers by client rendering. Acceptance dependency: a Director-selected fix rendering the expiry in one
  stated time zone (as other surfaces already do with `toUTCString` / "UTC").

**Behaviour change, intended.** A customer can follow work from Command to the register, from a Heby
request to where it is decided and where its outcome lives, and from an executed permit to the work it
produced; no refusal on that path is a bare code, no thrown action leaves a spinner, and no expired or
revoked authorization reads like one waiting to run.

**Weekly three.** *Learned:* a workflow is only as connected as the links between its pages, a security
pin the full suite trips is a stop, not an edit, and a signed-in walk finds what render tests cannot — a
kind missing from a list and a time zone that differs between server and browser. *Turkish Rug House:* its owner can see where an
approved piece of work went. *Hebun AI:* one governed loop, linked end to end and worded throughout.
