# HEBY-PLAN-DELEGATION-1 · closure record · PRODUCTION-ACCEPTED

Under an accepted Heby AI plan, each recommendation now offers **"Takip görevi oluştur"**: the human can ask
the organization's agent to PROPOSE a new follow-up work item through the released origination seam. The
original work items are never updated. Nothing is filed without a human choosing an agent, choosing a
work scope and confirming; nothing is approved or executed automatically.

## 1 · Why it is safe to disclose (Director decision D1, 2026-10-14)

The released agent-origination request carries the human goal as `conversation` and the organization
structure as `organization`; `workScope` and `agentId` never reach the model. The follow-up goal is one of
four fixed Hebun sentences in `PLAN_FOLLOW_UP_GOALS`, selected only by the recommendation's closed move
(`review-blocked`, `find-accountable`, `review-stale`, `declare-evidence`). It carries no work title,
description, alias, identifier, department, person, date, count, plan ref or model text, so the
origination model learns nothing about the work beyond what AI planning already allowed. The Knowledge
mode is not offered for a follow-up.

Consequence, stated: the follow-up proposal cannot name which work items it is about. The human sees the
items in the plan beside the control; the proposal itself is generic (PLAN-FOLLOW-UP-REFERENCE-1).

## 2 · What changed

| File | Change |
|---|---|
| `src/features/heby-commands/plan-follow-up.ts` | new, pure, imports nothing: the four fixed goals and the label |
| `src/features/heby-commands/contracts.ts` | `HebyCommandResult.followUps?` (optional) |
| `src/features/heby-commands/ai-operational-plan.server.ts` | an accepted plan returns one follow-up per step, goal = `PLAN_FOLLOW_UP_GOALS[step.move]` |
| `src/components/layout/heby/heby-composer.tsx` | under an `info` result with follow-ups: one released affordance per recommendation |
| `src/components/layout/heby/heby-origination-affordance.tsx` | `followUp` wording ("Takip görevi oluştur", "iş kayıtları değiştirilmez", the exact goal shown), no Knowledge mode; per-instance scope select id (`useId`) |

Not changed: origination, mandate, responsibility, Governance, permit, execution, EAI policy, schema,
provider permissions. The browser still sends `{ goal, agentId?, workScope }` to the released action.

## 3 · Tests

`tests/heby-plan-delegation-1/follow-up.ts` (stub generator that answers from the projection it is shown;
realistic titles and names in the register): goals closed and fixed, pass the released prompt validator,
contain no alias/identifier/plan ref/department/name and never ask to alter work; an accepted plan offers
one follow-up per shown recommendation and none of the register's titles, ids, department or plan ref;
contract refusal, EAI refusal, Director control off and no transport offer nothing; an empty plan offers
nothing; the goal table imports nothing; the runtime never reaches origination, governance or
authorization; the composer offers only under an accepted result; the affordance input is unchanged, the
label and notice are present, the Knowledge mode is absent and no follow-up wording implies an update.

`tests/heby-plan-delegation-1/bite-proofs.ts`: M1 titles in the goal, M2 alias in a fixed goal, M3 offered
under any result, M4 Knowledge mode offered, M5 update wording — each makes the suite fail on an
assertion; every file restored (md5).

## 4 · Production acceptance (Director-authorized, 2026-10-14)

Authorized exactly: one real AI planning request, one real agent-origination request, at most one PENDING
record-work request; no retry. Every count below is a read-only production measurement
(`default_transaction_read_only=on`) against a full-table baseline taken immediately before the browser
action (2026-10-13T23:42:17Z) and again after it (23:44:16Z).

| Check | Measured |
|---|---|
| Deployment | `dpl_4soqFWbVCZdT6n2fbzwMffHJAmrY` READY, target production, commit `9308e12c` (contains `2282f1a0`), aliased to `www.hebuntech.com` and `hebuntech.com` |
| Session | `user_session_contexts` `c27dc972`: the Director's user (the Gate D user), `active_tenant_id` = `hebun` (`f625b683`), not revoked |
| EAI precondition | `hebun` revision 4 `242a0db8` in force with agent-origination × {conversation, organization, knowledge} and work-planning × operational-record |
| AI plan | one message `AI ile Engineering için aksiyon planı hazırla` on `/heby`; `AI plan · Engineering`, three recommendations, each with **"Takip görevi oluştur"** |
| Follow-up offer | Recommendation 1 (`find-accountable`) opened by one click (availability read only). Shown goal equals `PLAN_FOLLOW_UP_GOALS["find-accountable"]` at `9308e12c` byte for byte; it names no work title, identifier, alias, department, person or model text. Notice shown: "Yeni bir takip işi önerilir. Önerinin ilgili olduğu iş kayıtları değiştirilmez." Mandate revision 4; no Knowledge mode offered |
| Human choice | work scope Engineering (work domain `e48da4bb`), chosen by the human; submitted once |
| Origination | invocation `a2cce454`: transport live, `claude-haiku-4-5-20251001`, state `selection-valid`, filing `proposed`, provider message `msg_011Cg18B2G6b4fEfSktYeqB7`, 875 / 68 tokens, agent `4ffeeb83` |
| Request | `159b49ce` (`act_5d01db15`): `record-work`, tool `heby.work.record-work`, target `organization/f625b683…`, **status `pending`**, proposer agent `4ffeeb83`, payload `workScope: domain`, `workDomainRef: work-domain/e48da4bb…`; no approval or rejection decision, no permit, `purpose_work_item_id` null |
| Payload digest | `14777add7b5b77ce570f81f734493da5b4564610ae95433fc3b00fbabd8cd6ab` recomputed independently with `digestCanonicalAction` from `9308e12c` over the stored canonical payload: **match** |
| EAI audit | exactly +1 `external-ai.disclosure.authorized` purpose `work-planning`, classes `[operational-record]` (`97186216`, 23:42:58Z) and exactly +1 purpose `agent-origination`, classes `[conversation, organization]` (`05a13a21`, 23:43:56Z); both revision 4, attestation `ffb0c160`; refused count unchanged (1) |
| Side effects | every public table plus the migration ledger counted: only `audit_log` +2 (281 → 283), `heby_origination_invocations` +1 (18 → 19), `heby_action_requests` +1 (23 → 24); `work_items` 8 rows, md5 of the whole table unchanged (`0f459f0a…`); `action_permits`, `action_execution_attempts`, `executions`, `decision_records`, `governance_sessions` unchanged; ledger 77 |
| Browser | console: no messages; three `POST /heby` → 200 (plan, availability read, origination); one `/approvals?_rsc` prefetch `ERR_ABORTED` (framework prefetch cancellation, no user action) |

The request was not approved and nothing was executed. Its title was written by the model from the fixed
goal and carries no work title.

**What this does not prove.** Provider-account reconciliation is **not** done: the audit's `accountRef`
is the configured value, not proof that production's key belongs to the observed Console account.
GATE-D-PROVIDER-RECONCILIATION-1 stays BLOCKED and HEBY-AI-PLAN-PRODUCTION-ACCEPTANCE-1 stays `DEPLOYED`.
This acceptance adds one persisted provider message id for the origination call; the planning call still
persists none.

## Closure Contract (v1)

- Phase: HEBY-PLAN-DELEGATION-1
- Owner: apps/dashboard/src/features/heby-commands/plan-follow-up.ts, with the released agent origination seam unchanged
- Reached state: PRODUCTION-ACCEPTED
- Implementation commit: 2282f1a0 — released on `main`, reachable from `9308e12c`
- Verification level: V2 — a shared seam (HebyCommandResult and the WF-1 origination affordance) and an external-AI disclosure boundary; every suite that reads the five touched files was run, plus boundary and failure tests and bite-proofs
- Verification evidence: 34 test files that reference the touched modules run sequentially against PostgreSQL 18 at 127.0.0.1:5432: 32 pass, 2 fail (int5b2-flow bite-proofs and pull-request-firewall) with first errors identical to the unchanged e0c96157 baseline; new follow-up.ts exit 0; bite-proofs 5/5; tsc --noEmit exit 0; eslint exit 0 on touched files; git diff --check exit 0; development-continuity closure-contract exit 0
- Test environment: worktree `.claude/worktrees/heby-plan-delegation-1` at e0c96157 plus this change; macOS (Darwin 25.2.0); tsx from a shared node_modules symlink; PostgreSQL 18 at 127.0.0.1:5432; no provider, no credential, no browser
- Deployment evidence: dpl_4soqFWbVCZdT6n2fbzwMffHJAmrY READY production at 9308e12c (www.hebuntech.com, hebuntech.com)
- Production acceptance evidence: authenticated Director browser on /heby (section 4): one AI plan with three recommendations and follow-up controls; one human-chosen Engineering follow-up; invocation a2cce454 live, msg_011Cg18B2G6b4fEfSktYeqB7; request 159b49ce PENDING record-work, digest recomputed match; read-only full-table delta audit_log +2 (work-planning +1, agent-origination +1), invocations +1, requests +1; work_items md5 unchanged; no decision, permit or execution. Provider-account reconciliation NOT done (GATE-D-PROVIDER-RECONCILIATION-1)
- Deferred risks: PLAN-FOLLOW-UP-REFERENCE-1 (DEFERRED); PLAN-DELEGATION-BROWSER-1 (CLOSED); GATE-D-PROVIDER-RECONCILIATION-1 (BLOCKED); AI-PLAN-UI-THROW-1 (DEFERRED)
- Director approvals: D1 no Work titles, descriptions or identifiers in agent-origination requests; D2 HEBY-PLAN-DELEGATION-1 approved as the next phase with the label "Takip görevi oluştur", human selection and confirmation, no automatic selection, origination or execution, no mandate or action-type expansion (2026-10-14); commit, push and deploy NOT approved by D2 — the release and deployment at 9308e12c preceded this acceptance; production acceptance of exactly one plan, one origination and at most one PENDING record-work (2026-10-14); acceptance evidence accepted and documentation-only closure authorized (2026-10-14); push and deploy of this record NOT approved

### Deferred risk detail

- **PLAN-FOLLOW-UP-REFERENCE-1 (DEFERRED)** — under D1 the follow-up proposal cannot carry a reference to
  the work it follows up; a server-held, model-invisible reference would need a payload change to the
  record-work request, which D2 does not allow. Revisit with a Director decision.
- **PLAN-DELEGATION-BROWSER-1 (CLOSED)** — locally the fake transport's prose cannot pass the plan
  contract, so no follow-up could render without a real model answer. Closed by the Director-authorized
  production acceptance in section 4: one plan, one click, one PENDING agent record-work (`159b49ce`).
- **GATE-D-PROVIDER-RECONCILIATION-1 (BLOCKED)** — owned by HEBY-AI-PLAN-PRODUCTION-ACCEPTANCE-1. This
  phase's follow-up control renders only under a real AI plan, so it inherits the unreconciled provider
  account. Not resolved here; section 4 adds the origination message id `msg_011Cg18B2G6b4fEfSktYeqB7`
  as a candidate for Console reconciliation.
- **AI-PLAN-UI-THROW-1 (DEFERRED)** — owned by HEBY-AI-PLAN-PRODUCTION-ACCEPTANCE-1. The follow-up control
  sits under the same plan runtime; a non-connectivity error still leaves "Preparing an AI plan…" on
  screen. Unchanged here.
