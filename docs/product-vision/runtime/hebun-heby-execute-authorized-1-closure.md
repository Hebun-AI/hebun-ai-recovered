# HEBY-EXECUTE-AUTHORIZED-1 · closure record · DEPLOYED — INTERACTIVE EXECUTION ACCEPTANCE PENDING

**Scope, stated first.** Authorized by the Director on 2026-10-27 ("HEBY EXECUTION COORDINATION"). A person
can now perform an internal act a human already authorized — `record-work` or `set-work-declared-state` —
from Heby, where they asked for it, instead of finishing it in Approvals. Heby gains no execution authority:
the click is the signed-in person's, through the same named server actions Approvals calls, and the server
still asks for this tenant's Governance authority. Released on 2026-10-27 ("GO — CONTROLLED PRODUCTION
RELEASE") and **deployed**; production shows the control withheld wherever it must be, **but no request with
an active internal permit existed, so the offered control was not observed and nothing was performed** (§5).
No new agent, schema, migration, authority, provider, Governance decision or model call.

## 1 · Current execution reality (at `0fbe05c7`)

| Kind | Heby today | The person approves | Performed by | Result held | Heby reads it | Where the flow broke |
|---|---|---|---|---|---|---|
| `record-work` | proposes (human or agent origination) | Governance decision in Approvals | `executeRecordWork` → Organizational Work, in the permit's transaction | `work_items` + handoff; `workOutcome` on the lifecycle | yes — "Your requests" and the proposal check | the Execute click lived only in Approvals |
| `set-work-declared-state` | proposes from the Heby work view | Governance decision in Approvals | `executeSetWorkDeclaredState` → Work Authority | `work.state-declared` audit row; `workOutcome.stateChange` | yes | same |
| `send` | proposes | Governance decision in Approvals | `executeAuthorizedAction` → provider adapter (deployment-armed) | `action_execution_attempts` | yes ("Delivered: the provider accepted it.") | Execute in Approvals; external and irreversible — **left there** |

Spending a permit requires the tenant's Governance authority (`consumeActionPermit`, EXECUTION-AUTHORITY-1);
a refused internal act aborts its transaction, so the permit stays `active` and nothing is written.

## 2 · Gate (answered before code)

Owner known (Action Authorization spends, Organizational Work writes); the user's right to perform is the
server's existing Governance-authority check; Governance is satisfied because a permit exists only after a
human approval; the tenant comes from `resolveTenantContext`; execution is the released executor; the result
is the persisted lifecycle (`workOutcome`); no new authority — the same human act from another surface.
**GO — IMPLEMENT.**

## 3 · What changed (`575beac4`)

| File | Change |
|---|---|
| `features/action-authorization/read-action-authorizations.server.ts` | The lifecycle view's `permit` carries `permitId` (the joined row's id; no new read) |
| `components/layout/heby/heby-execute-authorized.tsx` (new) | Offered only for an approved request with an `active` permit of `record-work` or `set-work-declared-state`; "Perform it here" → explicit confirmation → `executeGovernedInternalActionAction` / `executeGovernedWorkStateChangeAction` with the permit id only. Executed → the caller re-reads; refused → the server's reason and "The authorization was not used."; unreachable → "unknown". It states no outcome of its own |
| `components/layout/heby/heby-my-requests.tsx`, `heby-origination-affordance.tsx` | Mount the control beside the lifecycle; after an executed act the list / the request is re-read |

**Pins changed with their reasons:** `tests/heby-request-lifecycle/wording-and-firewall.ts` — "Your requests
offers no execution" became, by Director decision, "the list mounts exactly the one named execution control
and itself offers no decision, execution or revocation"; the lifecycle READ path's no-writer pin is
unchanged. Three wording tests gained `permitId` on their lifecycle fixtures (a type change only).

## 4 · Verification (V2)

V2: a Heby surface gains a call to two released execution seams; no authority, tenant, lifecycle, schema or
provider boundary moved (the server-side authority check is unchanged and pinned, C5). The full suite was not
run; every test file naming a touched module was.

| Check | Result (2026-10-27) |
|---|---|
| Baseline, 68 affected files, disposable detached `hea1-baseline` at unchanged `0fbe05c7` | 68/68 PASS |
| Candidate, same 68 + 2 new, disposable detached `hea1-candidate` | 70/70 PASS, zero REGRESSION; mutating bite-proofs restored their files |
| `tests/heby-execute-authorized-1/contract.ts` | PASS — C1 when offered (approved + active, two kinds; never pending, rejected, spent, expired, revoked, send, placement, publish); C2 only the two named actions, permit id only; C3 confirmation, nothing on render; C4 no outcome of its own; C5 server actions still resolve the tenant from the session; C6 both mounts; 6/6 bites |
| `tests/heby-execute-authorized-1/execute-postgres.ts` | PASS — X1 pending not offered; X2 permit id on the lifecycle; X3 member without Governance authority refused, nothing written, permit active; X4 other tenant refused and cannot read it; X5 authority performs, re-read states the Work record; X6 spent not offered, second spend refused; X7 state change performed, a stale one refused without spending; X8 "Your requests" offers only the active internal act |
| `tsc --noEmit`, `eslint` on changed files | exit 0 |
| `npm run build` | exit 0 |

The Director's eight checks: authorized start (X5, X7), unauthorized refused (X3), no execution without
Governance (X1), tenant boundary (X4), Heby gains no authority (C2, C5, X3), real result shown (X5, C4),
failure never shown as success (X3, X7, C4), existing agent and work flows intact (68/68 → 70/70).

**Test environment.** macOS Darwin 25.2.0; PostgreSQL 18.6 initialised by this session in its scratchpad
on 127.0.0.1:55499 (`system_identifier` 7701071965303287020) via `HEBUN_TEST_ADMIN_DATABASE_URL`;
`DATABASE_URL` unset; disposable databases; no production database, no provider, no network.

**Not covered by execution.** No browser render or click; the React component is pinned statically and the
executors it calls are driven directly in X1–X8.

## 5 · Production

**Release.** `git ls-remote` read `0fbe05c7` immediately before the push; `a46e9924` descends from it.
Fast-forward push `0fbe05c7..a46e9924` at 10:34:26Z on 2026-10-27, no force; remote read back
`a46e9924a998db42d3c0696ced243b932985920c`. Pre-push on the release commit: `tsc --noEmit` exit 0; HEA-1
contract (6/6 bites) and X1–X8 PostgreSQL PASS; heby-request-lifecycle wording-and-firewall and
lifecycle-postgres (9 cases) PASS; the three wording tests and enterprise-operations-1 next steps PASS;
continuity PASS; `git diff --check` clean. The permit consumer, both executors and the Approvals actions are
byte-identical to `0fbe05c7`. Build and affected-file regression (§4) not rerun: code unchanged since.

**Deployment** (Vercel record, project `hebun-ai-recovered`): `dpl_EZS2h2CBivnwkhCcuT1VRKrFg4b7`, target
production, READY 2026-10-27T10:35:27.066Z, `githubCommitSha` `a46e9924…`, ref `main`. Aliases
`www.hebuntech.com`, `hebuntech.com`, `hebun-ai-recovered.vercel.app`,
`hebun-ai-recovered-hebuntechs-projects.vercel.app`. Smoke: `/` 200, `/login` 200, apex 308, signed-out `/heby`
307. Runtime logs for the deployment: 16 × 200, 1 × 307, 0 × 5xx. READY is not functional acceptance.

**Production UI, hebun tenant** (2026-10-27, Director-signed-in built-in browser, read-only: page loads,
opening "Your requests" — one lifecycle read — and DOM/bundle reads; no execution control clicked, no
decision, no permit spent, no work change, no model or provider call):

| Check | Result |
|---|---|
| "Your requests" | Opens and lists 10 requests: 2 awaiting a decision ("Open Approvals"), 4 executed (work outcome sentences and "Open the work register"), 4 rejected |
| Lifecycle wording | Unchanged sentences and next-step links on every item |
| Control withheld where it must be | 0 of 10 carry `data-heby-execute-authorized`; none has an active permit (pending, spent or rejected) |
| `send` | No `send` request is in this person's list; the tenant's known sends are awaiting a decision (no permit). Withholding for `send` is proven by C1, not observed live |
| Served code | The deployed chunk contains "Perform it here" and "The authorization was not used." |
| Offered control (approved, active internal permit) | **UNVERIFIED** — no such request exists in production; none was created |

## Closure Contract (v1)

- Phase: HEBY-EXECUTE-AUTHORIZED-1
- Owner: apps/dashboard/src/components/layout/heby (the control and its two mounts) and the lifecycle read in apps/dashboard/src/features/action-authorization/read-action-authorizations.server.ts; permit consumption, the two executors, the Approvals server actions, Organizational Work and Governance unchanged
- Reached state: DEPLOYED
- Implementation commit: 575beac4e5f4e7682dc7526acec4f9b6d2880125 — released to main by fast-forward 0fbe05c7..a46e9924
- Verification level: V2 — a Heby surface reaches two released execution seams; no authority, tenant, lifecycle, schema or provider boundary moved
- Verification evidence: 2026-10-27, affected files baseline 68/68 and candidate 70/70 in disposable detached worktrees; tests/heby-execute-authorized-1/contract.ts PASS with 6/6 bites; tests/heby-execute-authorized-1/execute-postgres.ts X1–X8 PASS; tsc and eslint exit 0; npm run build exit 0
- Test environment: worktree .claude/worktrees/heby-exec-coord-1 (npm ci, published lockfile); disposable hea1-baseline and hea1-candidate; macOS Darwin 25.2.0; PostgreSQL 18.6 on 127.0.0.1:55499, system_identifier 7701071965303287020, via HEBUN_TEST_ADMIN_DATABASE_URL; no production database, no provider
- Deployment evidence: dpl_EZS2h2CBivnwkhCcuT1VRKrFg4b7 — production, READY 2026-10-27T10:35:27.066Z, githubCommitSha a46e9924a998db42d3c0696ced243b932985920c, aliases www.hebuntech.com and hebuntech.com; / and /login 200; 0 × 5xx
- Production acceptance evidence: N/A — interactive execution acceptance pending: withholding observed on 10 production requests, the offered control and a performed act UNVERIFIED (§5)
- Deferred risks: HEA1-BROWSER-UNVERIFIED-1 (DEFERRED); HEA1-SEND-STAYS-IN-APPROVALS-1 (DEFERRED)
- Director approvals: scoped implementation in an isolated worktree, targeted and regression tests, local commit, 2026-10-27; controlled production release with read-only UI acceptance, 2026-10-27; clicking the control, Governance decisions, permit spends, provider execution, model calls and work completion NOT approved

### Deferred risk detail

- **HEA1-BROWSER-UNVERIFIED-1 (DEFERRED).** In production the control is observed withheld on 10 requests
  and present in the served code; it was never rendered offered or clicked, because no request with an
  active internal permit exists. Acceptance dependency: a signed-in production read of such a request, and —
  as a separate Director decision — one performed act read back through its lifecycle.
- **HEA1-SEND-STAYS-IN-APPROVALS-1 (DEFERRED).** An authorized `send` is still performed only in Approvals
  (external, irreversible, deployment-armed). Acceptance dependency: a Director decision if sends should be
  performed from Heby.

**Weekly three.** *Learned:* the last mile of an authorized act is a surface question, not an authority
question — the server already asked the right person, so the click can live where the request was made.
*Turkish Rug House:* a TRH member who asked Heby to record work or change its state finishes it where they
asked, once Governance approved. *Hebun AI:* Heby now coordinates propose → human decision → perform → read
back for internal acts, on the released authorities only.
