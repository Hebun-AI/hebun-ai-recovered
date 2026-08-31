# AMA-4 — Agent Mandate Production Acceptance · Closure

**Era III, first program, fourth milestone.** The Agent Mandate Authority is exercised end to end
against the real control plane, by a human, in production.

**Baseline:** `main` at `9e961af`, equal to `origin/main`. Production migration ledger **39 → 40**.
**Released at:** `3bdcf27` — one observability repair the acceptance itself forced.

---

## 1 · What AMA-4 is, in one sentence

> The ceiling was recorded, revised, enforced and reported in production by a human, and every
> refusal it produced left no consequential row anywhere.

This is an **acceptance milestone**, not an architecture milestone. No authority was created, no
owner moved, and the mandate gate sits exactly where AMA-2 put it.

## 2 · The pins

```
MANDATED      != PERMITTED
PROPOSED      != APPROVED
APPROVED      != PERMITTED
PERMITTED     != EXECUTED
CONFIGURED    != VERIFIED
DEPLOYED      != MIGRATED
IN MANDATE    != AUTHORIZED
REFUSED       != COSTLESS
```

The last one is new here and is the milestone's most easily-misread fact — see §8.

## 3 · Production schema truth

Production was **behind by exactly one migration** and this was measured, never inferred from local
state. The released verifier `verifyCanonicalMigrationPrefix` reported `pending` — an exact
canonical prefix, not a divergence — with one pending entry,
`20260831110423_ama1_agent_mandate_authority`.

The ceremony `platform:migrate` was run **by the Director at a TTY**; it refuses piped stdin by
design, and no attempt was made to bypass it.

| | before | after |
|---|---|---|
| ledger applied | 39 | **40** |
| prefix verdict | `pending` (1) | **`converged`** |
| digest | — | `2a9522bb36ca3d8406efc4abc0ef3088` |
| `agent_mandates` | absent | present — 23 cols, 6 CHECKs, 5 FKs, 5 indexes |
| `governance_domain` → `agent-mandate` | absent | present |

Convergence was **re-verified independently** after the ceremony rather than taken from its report,
and the objects were checked directly — a ledger row is a claim, the constraints are the fact.
Organizational counts were byte-identical across the migration.

**A pre-flight catch worth recording.** Local `pg_dump` was 14.20 against a server at 18.6, which
`createValidatedBackup` refuses as `pg_dump-too-old` before the confirmation prompt. `postgresql@18`
was already installed and simply not first on `PATH`. The version gate that an earlier learning
recorded as **INERT** (`majorOf(undefined) = 0`) has since been repaired and now fails closed —
that learning is superseded.

## 4 · What was proved, in production, by a human

| | act | result |
|---|---|---|
| **B** | `/agents` — record a mandate, scope **empty** | revision 1, `proposal_scope []`, human establisher |
| **D** | `/approvals` — agent-originated proposal | **refused `action-outside-agent-mandate`**, no row |
| **F** | `/agents` — revise, scope `["send"]` | revision 2, supersedes 1, revision 1 unchanged |
| **C** | `/approvals` — agent-originated proposal | **filed, `pending`**, no permit, no execution |
| **E** | `/heby` — "what is your mandate?" | grounded on `agent-mandate`, `authoritative: true` |

**The empty ceiling came first, and that ordering was forced.**
`AGENT_ORIGINABLE_ACTION_KINDS` is `["send"]` — exactly one kind — so there is no second kind to
fall outside a scope with. `action-outside-agent-mandate` is reachable **only** through an empty
scope, since the gate is `proposalScope.some(...)` and `[].some(...)` is false for every kind. A
revision was therefore **structurally required**, not manufactured to satisfy a test.

It also left production in the honest state. Ending on an empty ceiling would have disabled Heby's
proposal capability entirely — a real capability regression dressed as an acceptance.

## 5 · The defect the acceptance found

**Step D's refusal could not be identified from what production recorded.**

`heby_origination_invocations.filing_refusal` read `not-authorizable` — the inlet's answer for
every writer refusal its own closed vocabulary cannot name. So
`agent-mandate-authority-unavailable`, `no-agent-mandate` and `action-outside-agent-mandate` were
indistinguishable in the only durable trace a refused origination leaves. Those are precisely the
three that `action-authorization/contracts.ts` records as ones that **"MAY NEVER COLLAPSE"** — and
they were collapsing one seam downstream of the comment forbidding it.

The cause had to be established by **elimination**: every other refusal ruled out by its own
distinct reason, `prepareAction` computed to `REQUIRES_HUMAN_REVIEW` so the writer was provably
reached, and the released AMA-2 suite re-run to confirm the path. Correct, and not something a
production record should require.

Two seams lost it, and both were repaired without new vocabulary:

- the **inlet** now carries the writer's `ActionRequestRefusal` verbatim as `authorityRefusal`
- **origination** prefers it: `filed.authorityRefusal ?? filed.reason`

`reason` keeps its released value everywhere, so no caller's exhaustive switch moved and the
`/approvals` already-pending wording is untouched. The enum travels, **not** the prose in `detail`
— that sentence embeds a recipient's display name for some refusals, and a provenance column is no
place for one.

**AGENT-PROPOSAL-4B's pin was repaired STRICTER.** Its regex `filingRefusal: filed.reason` was
quietly doing two jobs: proving no vocabulary was invented, and freezing *which* released
vocabulary is recorded. The second job was the defect. It now pins both operands, requires the
inlet's reason to remain the fallback, and forbids a literal — a check it never performed.

After the fix, production recorded the ceiling itself:

```
18:14:25  refused  action-outside-agent-mandate
```

The three pre-fix rows still read `not-authorizable`, so the repair is legible as a before/after in
the record. The UI improved with **no UI change** — that surface already renders `detail`.

## 6 · Governance binding

Every mandate transition is bound, and the binding was measured:

```
decision_records     4 -> 6   (+1 establish, +1 revise)
governance_sessions  4 -> 6
audit_log           31 -> 35   agent-mandate.established  1
                               agent-mandate.revised      1
                               governance.decision.recorded +2
```

Revision 1 remains immutable and readable at `proposal_scope []`; the effective mandate resolves to
revision 2, which carries `supersedes_mandate_id`. Governance **authorized** each transition and
owns none of the mandate state — the boundary AMA-1 drew is unchanged.

## 7 · Heby grounding

Asked at `/heby`, Heby reported revision 2, scope `send`, its recorded purpose, and revision 1 as
superseded — with the ceiling semantics intact: *"a ceiling, not permission … being inside the
mandate does not grant authorization: every proposal I make still requires a human decision, and
nothing may run without one."*

Production recorded the evidence, the **first `agent-mandate` rows ever written** to
`heby_answer_source_evidence`:

```
agent-mandate  Heby — effective mandate, revision 2    authoritative: true
agent-mandate  Heby — superseded mandate, revision 1   authoritative: true
```

**One nuance, recorded rather than smoothed over.** Heby named four of the five distinctions
explicitly — permission, authorization, approval, execution. It did not use the word **permit**.
The grounding source's own detail text does carry *"not a permit"*; Heby simply did not quote that
clause. The Director accepted the answer; the gap is in the model's selection from grounded text,
not in the grounding.

**The first attempt at E failed, and it was not a defect.** It was asked from the Heby panel while
on `/approvals`, which resolves to the `decisions` workspace — whose classes are
`decision-records, governance, knowledge, intelligence` and do **not** include `agent-mandate`.
`agent-mandate` is Command-only by AMA-3's explicit design. The answer returned Governance and
Knowledge truth because that is what that workspace holds. This is the same lesson E2-8 recorded:
**WORKSPACE AVAILABILITY != GLOBAL HEBY AVAILABILITY.**

## 8 · REFUSED != COSTLESS

Each refused origination **spent a real model call** and wrote a `heby_origination_invocations`
row. The mandate gate is enforced at the proposal writer, which sits **after** the model has
reasoned and selected — and AMA-4 deliberately did not move it.

> A mandate refusal prevents the durable proposal. It does not prevent the reasoning that produced
> it, and it is not free.

This is worth stating plainly because "the ceiling stops the agent" is easy to over-read as "the
ceiling stops the agent from thinking, or from costing anything."

## 9 · Production delta — the whole milestone

| table | baseline | final | attributable to |
|---|---|---|---|
| `agent_mandates` | 0 | **2** | B, F |
| `decision_records` | 4 | 6 | B, F |
| `governance_sessions` | 4 | 6 | B, F |
| `audit_log` | 31 | 35 | B, F |
| `heby_action_requests` | 3 | **4** | C only |
| `action_permits` | 1 | **1** | — |
| `action_execution_attempts` | 1 | **1** | — |
| `heby_origination_invocations` | 1 | 5 | C, and 3 refusals |
| `agents` | 1 | **1** | — |

**No permit, no execution, no provider send.** `agents` is byte-unchanged and
`authority_ceiling` is still `NULL` with no writer. The filed proposal from step C is
`pending`, with `approval_decision_id` NULL and `approved_at` NULL, and was deliberately **not
approved** — `external-send` is armed in production, so approving it could reach a real recipient.

Every out-of-mandate refusal produced **zero** consequential durable mutation: no request row, no
decision, no permit, no execution attempt, no provider invocation of the send adapter.

## 10 · Validation

Repository changed, so the full gate was run:

- targeted: `ama2-mandate-enforcement`, `agent-proposal-1` — pass
- affected firewalls: 5 suites asserting on the edited source text — pass
- typecheck clean · lint **0 errors** (14 pre-existing warnings elsewhere)
- **618 / 618**, run the released way (`npm run test:run`)

**Two process failures are recorded because both invalidated a result.**

1. A 10-minute foreground timeout **SIGTERM'd the suite mid-bite-proof**, leaving two unrelated
   source files mutated on disk — an ownership gate deleted from the agent retirement writer, and a
   soft withdrawal turned into a hard `delete` in the Knowledge external-reference authority. A
   second suite run had already started against that tree. Both were restored from `HEAD` and the
   run repeated. **Verify source residue against the released SHA before trusting any suite result
   or committing.**
2. The suite was first run as `node --env-file=.env.local scripts/run-tests.mjs`. The released path
   loads **no env file**; injecting one produced 16 false failures in gating-sensitive suites.
   **A suite run differently from how the repository runs it proves nothing.**

## 11 · What AMA-4 did NOT do

No second agent, no agent selection, no agent authentication, no task or workflow authority, no
permissions system, no mandate templates, no automatic mandate derivation, no autonomous widening,
no provider scope expansion, no new execution authority, no new Governance authority, no new
persistence owner, no `agents.authority_ceiling` usage, and no direct write around a released
writer. `permissions` and `role_permissions` still have **zero writers**.

**No schema.** Ledger unchanged at 40 by this milestone's own release; the 39 → 40 move was AMA-1's
migration finally reaching production.

## 12 · Remaining limitations

1. **One agent, one tenant.** Everything proved here is one durable agent in one organization.
   Multi-agent mandates are untested because a second agent is structurally unreachable.
2. **One action kind.** `AGENT_ORIGINABLE_ACTION_KINDS` is `["send"]`, so "outside the mandate"
   could only ever be demonstrated by an empty ceiling. A scope that admits some kinds and excludes
   others has **never been exercised anywhere**, including in tests.
3. **`agent-mandate-authority-unavailable` is unproven in production.** Two of the three fail-closed
   states were exercised; the third needs a real outage and was not manufactured.
4. **Mandate visibility is still `/agents` and Command only.** Live Map and `/approvals` show agents
   and proposals and say nothing about ceilings.
5. **A wrong-workspace question is indistinguishable from an absent truth.** Asking about the
   mandate from `decisions` returns a confident Governance answer rather than "not answerable here".
   Every source cited was honestly labelled, so this is a candidate observation, not a defect.
6. **Heby named four of five distinctions.** See §7.
7. **The pending proposal from step C is still pending** and is real production state.

## 13 · Verdict

```
AMA-1 = RELEASED
AMA-2 = RELEASED
AMA-3 = RELEASED
AMA-4 = PRODUCTION-ACCEPTED

AGENT MANDATE PROGRAM = CLOSED

Agent Mandate Authority:
  durable                 = YES
  Governance-bound        = YES
  proposal-enforced       = YES
  human-product-reachable = YES
  Heby-grounded           = YES
  production-accepted     = YES
```

**This closes one program, not an era.** Era III's outcome is unmeasured and no clause of it is
satisfied by this. It does **not** mean agents are fully built, a multi-agent runtime exists, an
autonomous enterprise has been achieved, a second agent is available, task orchestration exists, or
that ASA is unblocked — ASA's prerequisite was never a mandate.

```
ERA III = OPEN · AGENT MANDATE PROGRAM = CLOSED · NO NEXT PROGRAM SELECTED
```
