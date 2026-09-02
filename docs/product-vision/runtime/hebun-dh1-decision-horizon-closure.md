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

## 8 · Production acceptance

**Deployed commit is the release commit, byte for byte.** `200e22cd2c75a670571645b7af25c8781d748c34`,
read from the Vercel REST API's `meta.githubCommitSha` on deployment
`dpl_ARQCJWdN6UwZs1oVMBRWupFoxTQb`, target `production`, state `READY`. Cluster
`7675444875863894887`, database `neondb`. **Production ledger 43 → 43.**

### The answer was determined before anyone looked

All three authorities were read directly first, so the horizon's output was a PREDICTION to be
checked rather than a screen to be interpreted — and production held a **mixed** case, which is far
stronger than an empty one:

```
Action Authorization    3 pending, 1 approved     -> 3, and the approved one must NOT appear
Improvement Hypothesis  table empty               -> 0, ANSWERED WITH NOTHING, never "missing"
Knowledge - Governance  2 in-force, 1 ratified    -> 1 (143d8eaf…); 65f7f57f… subtracted
Verdict                 all three readable        -> complete, total 4
```

**Before this capability, `/approvals` and Heby both answered 3.** The true answer is **4, across
three different kinds** — which is the whole reason DH-1 exists.

### What the Director observed, and what the record proves

The `/approvals` panel showed **3 · 0 · 1**, with the hypothesis authority explicitly answering with
nothing and **no incomplete-horizon banner**. Heby returned the same four-item structure. The Heby
surface could not be scrolled to its end, so the tail of the answer was **not** taken on trust — it
was recovered from **G6D's durable answer-source evidence**, which stored the answer as served:

```
ordinal 0  heby-action-request/368d793d-7961-4e17-b627-0bd5f909ddeb   send-external-communication
ordinal 1  heby-action-request/499eb5d0-c52f-4fa5-995b-084f6492d4f5   send-external-communication
ordinal 2  heby-action-request/6531ec43-e5ff-40dd-9255-651fa7d4e395   send-external-communication
ordinal 3  knowledge-review/143d8eaf-dd7d-4f6f-85c5-4d109dbf008d      Current Knowledge version
                                                                       with no recorded decision
ordinal 4  decision-horizon:complete                                   This horizon is complete
```

Every id matches the authoritative rows exactly. The `approved` request is **absent**. The ratified
Knowledge version `65f7f57f…` is **absent** — the subtraction working on real production rows. And
**ordinal 4 is the completeness verdict**: precisely the item the UI truncated, recovered from the
record instead of from the screen.

**Per-item provenance survived into the stored evidence**, verbatim:

> *"Knowledge, measured against Governance's own decision record records this as a current Knowledge
> version Governance has recorded no decision about. Recorded 2026-08-26T10:40:11.890Z. The decision
> is taken at /knowledge, never here. This is RECORDED as awaiting a decision. It is not a statement
> that the decision is overdue, expected, or more important than anything else here…"*

That timestamp is `knowledge_nodes.created_at` for `143d8eaf…`, unaltered.

**And nothing was misreported as absent.** Zero `:unavailable`, zero `decision-horizon:partial`,
zero `decision-horizon:none` rows were recorded, and zero evidence rows from this answer contain an
`@`. The class carried the whole horizon: `decision-records` contributed 5 of the answer's 8
evidence items.

---

## 9 · Non-effects, measured across the whole database

Baseline `2026-09-02T08:52:56Z`, post `2026-09-02T09:05:22Z`.

```
59 tables by created_at · 6 by recorded_at/occurred_at · 57 by updated_at — all scanned
```

**GATHERING IS NOT DECIDING**, measured on every source the horizon touched:

```
heby_action_requests    3 pending, 1 approved, 4 total   UNCHANGED
agent_improvement_hypotheses            0                UNCHANGED
knowledge_nodes                         2                UNCHANGED
decision_records (knowledge_node)       1                UNCHANGED
decision_records (all)                  6                UNCHANGED
action_permits 1 · execution_attempts 1                  UNCHANGED
audit_log                              39 -> 39          a read writes no audit row
drizzle ledger                         43 -> 43
```

The 60-minute audit window is **empty**. Everything that did move is the Director using the product,
named and explained — nothing filtered out:

| Table | Change | Why it is not the horizon |
|---|---|---|
| `user_session_contexts` | +1 | the Director signing in |
| `auth_credentials` | 1 updated | the same sign-in |
| `conversations` / `messages` | +1 / +2 | asking Heby the question |
| `heby_answer_evidence_set` / `heby_answer_source_evidence` | +1 / +8 | G6D recording that answer — the very rows this acceptance was corroborated from |

---

## 10 · Closure

**CLOSED / PRODUCTION-ACCEPTED.**

```
release commit    200e22c   feat(decisions): gather everything that needs a human decision into one horizon
deployed commit   200e22c   identical
production ledger 43        unchanged — zero schema, zero migration, zero table
suite             647 / 647 (2 runs: one intended, one replacement after pin movement)
runtime           Node v24.16.0 — pinned during preflight, both suites on it
bite-proofs       10 / 10 mutations bit
```

**Deferred, intentionally and named.** No control on the horizon: every decision is still taken on
its owner's surface. No fourth source — the vocabulary is closed, and a source added without a
reader makes every horizon partial, which is the correct and loud failure. No priority, urgency,
risk score, deadline, elapsed time or ordering across sources. No per-item drill-through. No
Knowledge statement text. No writer, no table, no cache: the horizon is recomputed on every read,
because a stored copy would go on claiming a decision somebody had already taken.

**No successor authorized.** APF, ASA, Governed Internal Action and Director Intelligence remain
deferred with their activation conditions unproven. Pin-debt cleanup remains backlog.
