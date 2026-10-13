# HEBY-PLAN-DELEGATION-1 · closure record · VERIFIED

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

## Closure Contract (v1)

- Phase: HEBY-PLAN-DELEGATION-1
- Owner: apps/dashboard/src/features/heby-commands/plan-follow-up.ts, with the released agent origination seam unchanged
- Reached state: VERIFIED
- Implementation commit: THIS COMMIT — the commit that adds this record
- Verification level: V2 — a shared seam (HebyCommandResult and the WF-1 origination affordance) and an external-AI disclosure boundary; every suite that reads the five touched files was run, plus boundary and failure tests and bite-proofs
- Verification evidence: 34 test files that reference the touched modules run sequentially against PostgreSQL 18 at 127.0.0.1:5432: 32 pass, 2 fail (int5b2-flow bite-proofs and pull-request-firewall) with first errors identical to the unchanged e0c96157 baseline; new follow-up.ts exit 0; bite-proofs 5/5; tsc --noEmit exit 0; eslint exit 0 on touched files; git diff --check exit 0; development-continuity closure-contract exit 0
- Test environment: worktree `.claude/worktrees/heby-plan-delegation-1` at e0c96157 plus this change; macOS (Darwin 25.2.0); tsx from a shared node_modules symlink; PostgreSQL 18 at 127.0.0.1:5432; no provider, no credential, no browser
- Deployment evidence: N/A — not deployed
- Production acceptance evidence: N/A — not deployed
- Deferred risks: PLAN-FOLLOW-UP-REFERENCE-1 (DEFERRED); PLAN-DELEGATION-BROWSER-1 (DEFERRED)
- Director approvals: D1 no Work titles, descriptions or identifiers in agent-origination requests; D2 HEBY-PLAN-DELEGATION-1 approved as the next phase with the label "Takip görevi oluştur", human selection and confirmation, no automatic selection, origination or execution, no mandate or action-type expansion (2026-10-14); commit, push and deploy NOT approved

### Deferred risk detail

- **PLAN-FOLLOW-UP-REFERENCE-1 (DEFERRED)** — under D1 the follow-up proposal cannot carry a reference to
  the work it follows up; a server-held, model-invisible reference would need a payload change to the
  record-work request, which D2 does not allow. Revisit with a Director decision.
- **PLAN-DELEGATION-BROWSER-1 (DEFERRED)** — the control is not yet exercised in a browser: locally the
  fake transport's prose cannot pass the plan contract, so no follow-up can render without a real model
  answer. Production acceptance (one plan, one click, one PENDING agent record-work) needs a Director gate.
