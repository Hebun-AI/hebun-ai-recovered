# AMA-2 — Agent Mandate Proposal Enforcement · Closure

**Era III, first program, second milestone.** The Agent Mandate Authority stops being a record and
becomes a constraint.

**Baseline:** `main` at `cc7c27d`, equal to `origin/main`, 0 ahead / 0 behind. Migration ledger
**40 → 40 (unchanged)**.

---

## 1 · What AMA-2 is, in one sentence

> An agent-originated proposal is written only when the mandate authority answered, a mandate
> exists, and the requested action kind is inside its recorded scope — and passing that ceiling
> authorizes nothing.

## 2 · The invariant, stated as the formula the code implements

```
proposal proceeds  REQUIRES  mandate exists AND kind ∈ mandate.proposal_scope   (necessary)
kind ∈ mandate.proposal_scope  IMPLIES  nothing                                 (never sufficient)
```

The second line is the design. Passing the ceiling changes nothing downstream: the row is still
`pending`, no permit is minted, no Governance decision is written, no provider is reached, and the
human review boundary is exactly where it was. **A mandate only subtracts.**

```
MANDATE RECORDED  != PROPOSAL-ENFORCED   ← crossed by AMA-2, once, deliberately
IN MANDATE        != AUTHORIZED
NO MANDATE        != UNLIMITED MANDATE
UNAVAILABLE       != NO MANDATE
PROPOSAL REFUSED  != GOVERNANCE REJECTION
PROPOSAL-ENFORCED != HEBY-GROUNDED
PROPOSAL-ENFORCED != PRODUCTION-ACCEPTED
```

---

## 3 · The exact enforcement seam

**`recordAgentOriginatedActionRequest`**, in
`src/features/action-authorization/record-action-request.server.ts`.

It is the module that makes an agent-originated proposal **durable**. There is no second writer of
`heby_action_requests` for an agent, and the gate runs **before** `insertActionRequest` is called —
so a refusal leaves no row at all, rather than a withdrawn one.

**Where enforcement deliberately does NOT live**, each asserted as an unreachable import:

| Not here | Because |
|---|---|
| UI (`src/app`, `src/components`) | The server is still reachable without it. A UI gate is advice. |
| The model prompt / `agent-origination` | A model is not an enforcement mechanism. |
| Capability descriptors (`heby-actions`) | That would make the ceiling a property of the capability, not of the agent. |
| Seeded workforce adapters / mocks | A ceiling is never a seeded display property. |
| Governance | Governance authorizes a mandate **change**; it must not become the thing that applies one. |
| Execution, permits, provider adapters | Downstream. A ceiling reaching them would be a second gate. |

**One correction to AMA-1's predicted scope.** AMA-1's closure named
`buildOriginationCandidates` as a possible enforcement point. It is not one, and was rejected:
candidate building shapes what a model is offered, so a gate there is a **prompt constraint** — a
proposal assembled another way would never meet it. Enforcement belongs at the durable write.

---

## 4 · The three fail-closed states, and why they may never collapse

| State | Refusal | Meaning |
|---|---|---|
| **A** — authority unreachable | `agent-mandate-authority-unavailable` | Hebun could not LOOK. |
| **B** — no mandate | `no-agent-mandate` | Hebun looked; nobody has bounded this agent. |
| **C** — outside scope | `action-outside-agent-mandate` | A bound exists and excludes this kind. |

All three refuse, and **all three write no request row**. They are three because they are three
different facts about the organization, and a reader has to act on the difference: repair the
control plane, ask a human to bound the agent, or accept that the bound excludes this act. One value
would make an outage indistinguishable from a deliberate withdrawal — the fabricated-absence defect
this repository has repaired more than once.

**AMA-1 predicted two refusals. There are three.** Its closure listed only `no-mandate` and
`mandate-authority-unavailable`, because at that point the out-of-scope case had no runtime and was
easy to fold into "refused". It is a distinct organizational fact and is named as itself.

**Withdrawal is the representable out-of-scope state.** `AGENT_ORIGINABLE_ACTION_KINDS` is closed at
one kind, so "a mandate naming a different kind" cannot exist — `canonicaliseMandateScope` refuses a
scope naming anything outside the vocabulary, and the table's own CHECK refuses one in SQL. The
representable exclusion is therefore the **empty scope**: nothing is inside an empty ceiling, so
every kind is outside it.

---

## 5 · The finding this milestone actually rests on

**The mandate scope and the prepared action speak two different vocabularies.**

- `mandate.proposal_scope` holds **aliases** — `AgentOriginableActionKind`, i.e. `"send"`. It is the
  vocabulary a model selects from.
- `prepared.actionKind` holds a **registry kind** — `HebyActionKind`, i.e.
  `"send-external-communication"`. It is the vocabulary the authorization chain speaks.

`agent-origination/contracts.ts` has said since AGENT-PROPOSAL-1 that *"the alias never becomes the
kind by string"*. Until AMA-2 the correspondence existed only as a fact about control flow: the
inlet passes the **constant** `SEND_ACTION_KIND` because origination selected the alias. Nothing
named it, so nothing could check it.

A ceiling comparing the two directly would have matched **nothing** and refused **every** agent
proposal — including the ones a mandate admits. That failure is invisible to any test that only
checks that out-of-mandate proposals are refused: it looks perfectly fail-closed while enforcing the
wrong thing.

The fix is `AGENT_ORIGINABLE_REGISTRY_KIND`, declared in the vocabulary's own module as a **total**
`Record<AgentOriginableActionKind, HebyActionKind>`, whose value is the released `SEND_ACTION_KIND`
itself rather than a repeated literal. Admitting a new alias without declaring its registry kind is
a compile error. There is deliberately **no reverse direction**: a registry kind that no alias
denotes is exactly what a ceiling must be able to refuse.

Bite-proof 7 mutates the comparison back to string equality and requires the **in-scope** case to
break.

---

## 6 · The human path is untouched

`recordActionRequest` reads no mandate. Its body is asserted to contain no mandate symbol at all,
and a bite-proof puts it under the ceiling and watches the firewall fail.

Proved behaviourally against a real database: with the agent **withdrawn** (empty scope), the same
act the agent was just refused is **filed** by a human — both through the writer and through the
released `/send` inlet.

> **AGENT MANDATE CONSTRAINS AGENTS, NOT HUMAN AUTHORITY.**

---

## 7 · Authority firewalls — what AMA-2 did not create

Asserted structurally, and by a real-database consequence census:

- **No** Governance decision, **no** permit, **no** execution attempt, **no** provider invocation.
- **No** mandate mutation — `agent_mandates` still has exactly one writer, and revision 1 is
  byte-identical before and after every enforcement path in the suite.
- **No** use of `agents.authority_ceiling` — the AMA-1 ban on that identifier now extends to the one
  module outside the feature that knows what a mandate says.
- **No** widening of `AGENT_ORIGINABLE_ACTION_KINDS` — still `["send"]`.
- **No** agent authentication. The agent id still arrives only through the branded `AgentProposer`,
  minted from a server-side identity read; the ceiling is looked up by the **verified** proposer's
  id, never a caller-supplied one, and a bite-proof swaps it for the human's id.
- **No** permission activation — `permissions` and `role_permissions` still have zero writers.
- **No** new action kind, provider, surface or work/task/workflow authority.

**The seam imports the read seam module, never the feature barrel.** `@/features/agent-mandate`
re-exports `establishAgentMandate`; importing it would put a Governance-bound mandate writer into
the proposal path's import graph — the defect G6C repaired in Heby's graph, where a database-handle
import dragged `establishGovernanceAuthority` in behind it. The ban is by **exact specifier**,
because the legitimate read-seam import contains the barrel's own path as a substring.

Retirement is unchanged: a retired agent has no proposer to resolve, so the refusal still comes from
the released identity seam and never mentions a mandate.

Tenant isolation is unchanged: another organization's mandate is indistinguishable from one that
never existed, so a foreign agent is refused `no-agent-mandate` no matter what any other tenant
recorded.

---

## 8 · Schema and migration truth

**ZERO.** No table, no column, no enum value, no migration. The ledger is **unchanged at 40**,
pinned as an exact count. Only AMA-1's migration ever touched mandate storage, asserted by census,
and it declares no `enforced`, `applied_at`, `consumed_at` or `last_checked_at` column — enforcement
writes nothing back.

Enforcement is a **read**, applied in code, against rows a human wrote.

---

## 9 · The AMA-1 census was inverted, not relaxed

AMA-1 measured *"exactly three modules outside the feature can see a mandate, and none is a proposal
path."* That sentence was the measured absence of enforcement, and it could not survive AMA-2.

It was **inverted narrowly**:

- The importer census is now **exactly four**, naming the one proposal writer explicitly. A second
  enforcement point added anywhere still fails.
- The per-directory ban over the four proposal-path directories keeps every other file blind to a
  mandate, exempting the seam **by name** rather than exempting its directory —
  `action-authorization` also holds the decision writer, the permit consumer and the revoker, and
  none of those may acquire a ceiling of its own.
- New assertions were added, not removed: the seam reads the read seam, does not reach the writer,
  and writes no mandate state.

**One guard was re-aimed, and the reason is worth recording.** The directory ban was a bare
`agent-mandate` substring check. The new refusal vocabulary legitimately contains that substring —
`no-agent-mandate` and `action-outside-agent-mandate` are the *names of two refusals* — so the guard
began failing on honest vocabulary rather than on a read. AMA-1 learned this exact shape once
already, on the writer that must *say* the words it denies. The ban is now on the import, the table
and the read symbol: **the three ways a module could actually consult a mandate**.

**One released test anchor was repaired.** AGENT-PROPOSAL-1's firewall sliced the writer's signature
from `indexOf("export function recordAgentOriginatedActionRequest(")`. Making the function `async`
turned that into `-1`, and `slice(-1)` is the file's last character — so two assertions would have
started reporting a missing `AgentProposer` parameter that is plainly still there. The anchor is now
the name, and it is asserted to be found. **The assertions themselves are unchanged in strength.**

---

## 10 · The precondition that changed six released suites

Before AMA-2, a durable agent could propose as soon as it existed. It cannot now. **Six** released
suites began failing at their central assertion — AGENT-PROPOSAL-1, AGENT-PROPOSAL-2,
AGENT-PROPOSAL-4B, SIA-1, SIA-2 and SIA-2.6 — which is the clearest evidence available that
enforcement is real and not decorative.

Three were found by targeted runs; the other three only by the **full suite**, because they exercise
agent origination as a fixture for something else (outcome observation, evaluation, invocation
attribution) rather than as their subject. A targeted-run-only gate would have shipped believing the
blast radius was half its real size.

All six were updated to record a ceiling first, through the **released writers**, via
`tests/helpers/agent-mandate-seed.ts`. Two of them bound **both** tenants' agents, because both
organizations really do originate proposals there. Nothing they assert was weakened, and the mandate they record
admits the full released vocabulary, so it subtracts nothing there.

**Two consequence censuses had to become honest rather than convenient.** They asserted GLOBAL zeros
for `decision_records` and `governance_sessions`, which was true only while nothing in those suites
wrote them. Bounding an agent is a real human Governance act and writes both. The claim was never
"this database holds no decisions" — it was *"nothing was decided about this act"* — so it is now
measured as a **delta across the proposal** (AGENT-PROPOSAL-1) and **scoped to the
action-authorization subjects** (AGENT-PROPOSAL-2, 4B). Both forms are strictly harder to satisfy
than the global zero they replaced: a global zero would also pass in a world where origination wrote
a permit and something else deleted it.

---

## 11 · Validation

- **Targeted:** `tests/ama2-mandate-enforcement/` — `enforcement-postgres.ts` (real PostgreSQL,
  disposable), `enforcement-firewall.ts` (structural), `bite-proofs.ts` (**14 mutations, all 14
  bite**, each failing for its stated reason and restored byte-for-byte).
- The unavailable state is proved **twice**: once with no control plane configured, and once with
  the writer's database perfectly healthy and only `agent_mandates` renamed away — the state a naive
  gate sails straight through, where the writer *could* have written a row and only the gate stopped
  it.
- **Regressions:** AMA-1 firewall and postgres, agent proposal 1/2/4B, SIA-1, SIA-2, SIA-2.6,
  agent runtime, agent identity, R3A/R3A.1, A1a, OPS-P1 all re-run.
- Typecheck clean. Lint zero errors on owned files.
- **The first full suite found three real failures and they were fixed, not worked around** — SIA-1,
  SIA-2 and SIA-2.6, all the same missing precondition. A replacement full suite followed.

---

## 12 · Exact remaining scope for AMA-3

Not selected, and not implied by this closure.

1. **Heby grounding.** Nothing reads a mandate for an answer, so Heby still cannot state what an
   agent is for. Asserted absent by census over `heby-answer` and `heby-integration`.
2. **Surface.** `/agents` renders no mandate. No human can see, record or revise a ceiling through
   the product — every mandate in existence was written by a test or a script.
3. **Production acceptance.** No mandate row exists in production, so nothing here has been proved
   against the real control plane.
4. **A refusal a human can read.** The inlet maps all three mandate refusals through its released
   generic branch, naming the reason in the detail string. Whether the operator surface should
   distinguish them is a product decision nobody has taken.

Explicitly still out of scope: a second agent, agent selection, agent authentication, mandate
templates, mandate policy, automatic mandate derivation, permits, and execution.

```
AMA-1 = RELEASED
AMA-2 = RELEASED · AGENT MANDATE AUTHORITY = PROPOSAL-ENFORCED
AMA-2 != HEBY-GROUNDED
AMA-2 != SURFACED
AMA-2 != PRODUCTION-ACCEPTED
ERA III = OPEN · AGENT MANDATE AUTHORITY = ACTIVE PROGRAM · NO AMA-3 SELECTED
```
