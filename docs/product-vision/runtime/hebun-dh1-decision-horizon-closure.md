# The Unified Director Decision Horizon — What Actually Needs My Decision

**Era III. One capability, one loop: selected, designed, built, validated, released, deployed,
production-accepted, closed.** The Definition of Done in §1 was written BEFORE any mutation.

**Authority expansion: NONE.** Zero schema, zero migration, zero table, zero writer, zero new
Governance authority, zero new Heby source class, zero new decision semantics.
**Production ledger 43 → 43.**

---

## 1 · Selection, from current repository reality

Six candidates were ranked. **A won on measured evidence, not preference.**

Hebun has **three** released authorities that each record something as awaiting a human decision:

```
Action Authorization           consequential acts proposed and not yet decided
Agent Improvement Hypothesis   hypotheses filed and not yet decided about   (undecided != declined)
Knowledge minus Governance     current versions Governance recorded no decision about
```

And **no single place carried all three**:

```
/approvals          renders action requests alone  (verified: its imports)
Heby decision-records  carried action requests alone  (verified: its projection)
/agents, /governance/authority   the hypotheses, and only there
attention-observation   the Knowledge set as a COUNT, with no item anywhere
```

A Director asking Heby *"what needs my decision?"* got **one third of the answer with nothing
indicating that two thirds were missing**.

> **A SILENT OMISSION IS WORSE THAN AN ABSENCE.** A horizon that answers "three things" while two
> authorities hold more is not incomplete; it is wrong.

**Enterprise job unlocked:** *"What actually needs my decision across Hebun?"* — answerable in one
place for the first time, with a verdict on whether the answer is complete.

**Why the others were deferred.** **B** — the four organizational authorities already compose on
`/director/organization`; a further derivation adds no fact. **C** — no semantic authority exists
for what it means for Knowledge to belong to a department, and inventing one in a join table is
forbidden. **D** — the one obvious primitive (a target date) is refused by released code. **E** —
after `/pull-requests`, no other real provider capability is stranded with comparable value. **F** —
nothing measured higher.

---

## 2 · The boundary: it composes, and never acquires

The precedent is `attention-observation`, which states it in its own words: *"deliberately NOT a
central module that acquires those subsystems' semantics"*. DH-1 follows it exactly.

- **No table, no handle, no query.** The read model imports four released read seams and arranges
  what they return. A firewall asserts it names no table of any owner and holds no `.select(`,
  no `sql\``, no `@/db`, no writer, and no clock.
- **The action half is the released projection, verbatim.** `readDecisionQueueGroundingSource`
  carries the effect, target, side effect, reversibility, recorded consequences, evidence state and
  proposer. Re-deriving any of that would be a second interpreter of Action Authorization's records,
  so its items travel unchanged — and a firewall asserts the horizon never reaches past it to the
  raw seam.
- **Every decision is still taken where it always was.** Each item names its owning authority and
  the route where the decision is made. The surface offers **no control at all**.

```
COMPOSED != OWNED        GATHERED != DECIDED        DERIVED HORIZON, AUTHORITATIVE ITEMS
```

**One released census admitted it by measurement, not by listing.** APP-1's pin permits a module to
read the action seam only if it holds no queue of its own; the horizon was added to that list and
then *proved* by the loop that runs over every consumer.

---

## 3 · The completeness rule — the sentence this feature exists to protect

> **"NOTHING NEEDS YOUR DECISION" MAY BE SAID ONLY WHEN EVERY SOURCE ANSWERED AND EVERY ONE OF THEM
> ANSWERED WITH NOTHING.**

One unavailable source makes the horizon **partial**, and a partial horizon **names the authority
that could not answer** rather than rendering a shorter list. This is E2-4's rule applied to a union
instead of a subtraction, and it is enforced in three places — the read model's verdict, the Heby
projection's gate on the empty sentence, and the surface's `complete && answeredTotal === 0`.

It matters more here than in any predecessor: telling a Director nothing is waiting during an outage
is the sentence they act on **by doing nothing**, and it is now three times easier to get wrong.

**The Knowledge block fails closed in both directions.** Knowledge cannot see that a version was
rejected (K4 writes nothing for a rejection) and Governance does not know which versions exist, so
if either side is unavailable the block is unavailable and says which. A readable version list with
an unreadable decision set would make *every* current version look undecided — not caution, but the
avoidance of a specific falsehood.

---

## 4 · Truth semantics, carried as data

```
COMPOSED    != OWNED             PARTIAL     != EMPTY
UNAVAILABLE != HOLDS NOTHING     UNDECIDED   != DECLINED
DIFFERENT KINDS != ONE RANKED QUEUE          BOUND != TOTAL
LISTED      != OVERDUE, EXPECTED OR IMPORTANT
```

No priority, urgency, risk score, deadline or recommendation — **no authority in Hebun owns any of
them**, so nothing here asserts one. No elapsed time: `attention-observation` owns duration truth,
and a second module measuring the same interval against its own clock is how two surfaces come to
disagree. No ordering across sources: ranking three kinds of decision against each other is a
judgement nobody owns.

The Knowledge item carries **no statement text** — only the version id a decision would name —
because a horizon that quoted ratifiable organizational text into a list nobody can ratify from
would be putting the decision in the wrong place.

---

## 5 · What was built

| Layer | File | What it is |
|---|---|---|
| Vocabulary | `decision-horizon/contracts.ts` | Pure: closed source list, owners, routes, completeness sentences, six non-claims |
| Read model | `decision-horizon/read-decision-horizon.server.ts` | Composes four released seams; per-source blocks; completeness verdict |
| Heby | `decision-horizon/heby-decision-horizon-source.server.ts` | Serves `decision-records` — the released queue projection **plus** the two missing owners |
| Answer flow | `heby-answer/model-answer.server.ts` | `decision-records` resolves through the horizon |
| Surface | `components/decision-workspace/decision-horizon-panel.tsx` | `/approvals`, above the queue that is one third of it |

**The class was not changed and no class was added.** `decision-records` was chartered as decision
PREPARATION material — the question *"what is waiting for a human?"* — and was never chartered as
"action requests". Its first reader answered with action requests because that was the only
authority connected at the time. Census stays at 20.

---

## 6 · Validation

```
targeted     dh1-decision-horizon/horizon-truth      PASS
             dh1-decision-horizon/horizon-firewall   PASS
             dh1-decision-horizon/bite-proofs        10 / 10 mutations bit
regressions  app0, app1, app2, e2-4 (5), kga (2), sia3, sia31 (3) — all PASS
typecheck    clean
lint         0 errors, 14 pre-existing warnings
full suite   647 / 647   (2 runs: one intended, one replacement after pin movement)
runtime      Node v24.16.0 — the verified released-baseline interpreter, identified BEFORE the
             first suite run rather than rediscovered during it
```

**Pin movement, both stated.** `app1-decisions-truth` — the action-seam importer list, where the
horizon is admitted by the measurement loop rather than by being listed. `cmdv3-command-composition`
— the `StateBlock` consumer census, 9 → 10.

---

## 7 · Foreseeable defects found and fixed BEFORE release

1. **A circular route.** The panel told a reader to go to `/approvals` for the action source — while
   sitting on `/approvals`. It now points at the queue directly below it, and links only the two
   sources that really are elsewhere.
2. **A pre-existing import cycle would have made the feature untestable in isolation.**
   `read-action-authorizations.server` throws `Cannot access 'tenantColumns' before initialization`
   when loaded as the first module of a process, which is why every released test that uses it
   imports `db/client.server` first. The horizon orders its imports so it loads cleanly on its own —
   an accommodation of somebody else's cycle, recorded as such, and **not a fix for it**: DH-1 does
   not own that module and did not touch it.
3. **Three bite-proofs were aimed at assertions that no longer fired first** — each re-aimed at the
   assertion that actually fires, which in every case was the *stronger* completeness guarantee.

---
