# WORK-2 — Heby Organizational Work Grounding · Continuity Record

**Era III, third program (Organizational Work), second milestone.** Heby can answer what this
organization has recorded it is doing, what state a human declared each piece of work to be in,
which department it belongs to, and who is accountable — from the Organizational Work Authority's
own record.

**Baseline:** `main` at `1e28603`, equal to real `origin/main`.
**Migration ledger: 42 → 42.** No migration was authored, applied or needed.
**Suite:** **632 passed, 0 failed, 632 total** — one final run.

**WORK-2 IS RELEASED, NOT PRODUCTION-ACCEPTED.**

---

## 1 · Status, term by term

```
DESIGNED                 YES   predicted at WORK-0, confirmed against repository reality
IMPLEMENTED              YES   one projection, one source class, one workspace, one substitution
SCHEMA                   NONE  no table, no column, no enum, no migration
AUTHORITATIVE            REUSED — WORK-1's authority, unchanged; no second Work authority exists
HEBY-GROUNDED            YES   and proved END TO END into the model request, not at the seam
WORKSPACE SCOPE          Command, and only Command
WRITE AUTHORITY ADDED    NONE  Heby's import graph reaches the projection and never the writer
PRODUCTION-ACCEPTED      NO
```

---

## 2 · The pins

```
RECORDED WORK     != OBSERVED ACTIVITY      DECLARED STATE    != VERIFIED STATE
DECLARED COMPLETE != SUCCESSFUL             DECLARED COMPLETE != OUTCOME ACHIEVED
ACCOUNTABLE HUMAN != AUTHORIZED EXECUTOR    DEPARTMENT REF    != THE HUMAN'S DEPARTMENT
WORK ITEM         != WORK ARTIFACT          WORK              != KNOWLEDGE
UNAVAILABLE       != NONE RECORDED          NEW SOURCE CLASS  != NEW AUTHORITY
THE LABEL IS NOT THE KEY                    HEBY GROUNDS ON WORK != HEBY HAS A WORK WRITER
```

---

## 3 · What was built

| Surface | What it does |
|---|---|
| `organizational-work/heby-work-source.server.ts` | **the projection** — the authority's own read, shaped for grounding |
| `heby-integration/contracts.ts` | `work` declared as the **18th** source class, with its boundary reasoning |
| `heby-integration/workspace-registry.ts` | Command gains `work` and one `mayExplain` line — **no other workspace** |
| `heby-answer/model-answer.server.ts` | `withWork` substitution + injectable `resolveWork` dep |
| `heby-runtime/source-resolver.ts` | the pure `work` case — explains the SEAM, never an absence |
| `tests/work2-heby-work-grounding/` | grounding semantics + end-to-end reachability and firewall |

**Zero schema. Zero migration. Zero writer.** The ledger is 42 before and after, and a firewall
asserts it.

---

## 4 · The source class decision, confirmed rather than assumed

WORK-0 predicted `work` would need its own class. Re-measured here against the four candidates it
might plausibly have folded into, and the prediction holds:

| candidate | why not |
|---|---|
| `organization` | Organization Structure Authority owns WHAT PARTS EXIST. Work NAMES a department and is not one. Folding would put "we have an Engineering department" and "we are doing something" under one provenance sentence and one `authoritative` boolean |
| `work-artifacts` | shares a word and nothing else. An artifact is prepared CONTENT with immutable revisions and `authoritative: false`; a work item is a COMMITMENT with MUTABLE declared state that IS a recorded fact |
| `operations` | reads Executive Overview sections the mock-surface gate withholds from a real tenant, so durable rows filed behind it would be invisible to the only tenants that have any |
| `intelligence` | has no connected reader at all |

The governing rule is the one every class since `work-artifacts` has used — **a different authority
owner** — and the mechanical one is that `SourceResolution.authoritative` is ONE boolean per class,
so a class cannot assert one standing and cite under another.

**NEW SOURCE CLASS != NEW AUTHORITY.** WORK-2 widens a contract over an authority released at WORK-1
and creates nothing.

---

## 5 · Truth semantics carried as DATA, not as prompt prose

The Director's instruction was explicit: prefer structured grounding over prompt prose. Every
distinction below travels in a provenance sentence, a frozen non-claim constant, or a per-item
`detail` string — because a model forgets an instruction and cannot forget a field.

- the class **provenance** opens with `EVERY STATE IS A DECLARATION` and states in the same sentence
  that Hebun did not observe the work, did not verify it, and holds no record of any outcome
- it says `DECLARED COMPLETE IS NOT VERIFIED, NOT SUCCESSFUL, AND NOT AN OUTCOME` in capitals
- every **item** carries `WORK_NON_CLAIM`, which repeats the declared/observed split and the
  attribution/authorization split
- every **declared state** carries its own meaning sentence, and each names the declarer — the
  `complete` one says "Declared complete by an authorized human. Hebun did not verify it, did not
  observe it"
- the **department clause** says in words that it does not mean the accountable human belongs to
  that department
- the **accountable clause** says accountability grants no permission, no Governance authority, no
  approval right and no authority to execute

A test asserts each of these by equality or by regex over the real projection output, and a separate
one asserts that a `complete` item's detail contains no verification, success or outcome vocabulary.

---

## 6 · Product reachability — proved into the model, not at the seam

The Director's Phase 7 named three ways to fake this, and the test refuses all three:

> A declared source class with no runtime substitution is NOT connected.
> A substitution with no workspace reachability is NOT available.
> A model context item that never reaches the answer path is NOT product reachability.

So the proof drives the **real** `answerHebyModelRequest`, with the **real** projection over an
injected authority read, captures the composed `ModelGenerationRequest`, and asserts what actually
landed in the model's grounding context:

```
[work/work-item/w-1] Hebun Era III development — declared state: active — Declared underway.
department: Engineering (d-1) … accountable human: Şenol Sevim (u-1) …
| provenance: Organizational Work Authority — … EVERY STATE IS A DECLARATION …
```

Title, declared state, department name and id, accountable label and id, and the provenance all
arrive. Nothing about Heby is stubbed.

**A throwing read degrades and never denies.** `withWork` falls back to the pure resolution, whose
sentence explains the seam; a test asserts the degraded grounding contains no "no work", "none
recorded" or "is doing nothing".

**No blocked work is manufactured.** With a register holding one active item, a test asserts no item
claims a blocked state and that no blocker vocabulary — blocker, impediment, at risk, stalled,
overdue, behind schedule — appears anywhere in the class.

---

## 7 · A boundary genuinely changed, and it was restated rather than patched

HLR's released firewall asserted **"THE WHOLE HEBY TREE IS BLIND TO THIS MODULE"** — before WORK-2,
no human's readable name reached Heby's grounding context anywhere, and the `organization` class
carries the department owner as an identifier and says so in its provenance.

**WORK-2 changes that deliberately.** A Director asking "who is accountable for this work?" should
get a name, not a UUID, and the Director's Phase 2 asked for exactly that.

It is done through the **released** `resolveHumanLabels` projection — the same Governance-gated,
tenant-scoped, fail-closed read the two pages use — not a new one. It creates no roster: it answers
for ids the register already names and cannot enumerate anybody. The **identifier travels beside the
label in every item**, and an unresolved human is said to be unresolved rather than guessed.

The firewall claim was **repointed, not deleted**, and it is now narrower and still exact:

1. no module under `features/heby*` — the Heby subsystem itself — imports the legibility read
2. **exactly ONE** authority-owned grounding projection resolves labels, and the assertion names it

A second grounding projection reaching for names without a deliberate edit still fails there. That
is the guarantee worth keeping, and it survived.

---

## 8 · Pin debt — four, not forty-nine

WORK-1 authored a migration and cost **49 test-file edits**. WORK-2 authored none and cost **four**:

| pin | grew because |
|---|---|
| `heby-integration/contracts.ts` census | the class list is exact, and gained `work` |
| `hlr-human-legibility` ×2 | the 17→18 count, and the legibility boundary of §7 |
| `osa-owner-eligibility` | the 17→18 count |
| `work1-organizational-work/work-firewall` | it asserted no `work` class exists — repointed to what WORK-1 owns |

**The debt is migration-driven, not change-driven.** WORK-2 touched five source files and two
authorities' contracts and moved four pins, because nothing counts the ledger when the ledger does
not move. Recorded, and NOT cleaned up here — the Director's instruction reserved that.

---

## 9 · What WORK-2 deliberately does NOT do

- no schema, no migration, no column, no enum
- no second Work authority, no change to WORK-1's writer
- no Work mutation reachable from Heby — the answer graph reaches the projection and never the writer
- no action kind, no mandate change, no APF activation, no agent authority
- no Governance decision, permit, execution attempt or subject type
- no provider call
- no ninth workspace; no other workspace gains `work`
- no Live Map change
- no production data touched

---

## 10 · Continuity — unchanged by this milestone

```
WORK-2 production acceptance:       NOT PERFORMED / next
Pin-debt cleanup:                   NOT STARTED / NOT AUTHORIZED
APF (Agent Plurality Foundation):   DEFERRED
Agent #2:                           NOT JUSTIFIED / NOT CREATED
Governed Internal Action:           DEFERRED
GitHub PR reachability:             STRANDED / not started
ASA:                                BLOCKED / DEFERRED
```
