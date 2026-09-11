# Hebun — Social Intelligence: Governed Action Loop Design Review

> ### DESIGN REVIEW — NOT ROADMAP AUTHORITY
>
> **NOT IMPLEMENTATION AUTHORITY. NOT EXECUTION AUTHORITY. NOT APPROVAL TO BUILD.**
>
> Nothing here is scheduled, promoted, chartered or decided by appearing in it. No capability is
> granted. No provider scope is requested. No authority is created.
>
> **Baseline:** branch `main`, `HEAD == origin/main == 5dd2921f3812b6ccd515d147a1821a6588397eca`
> (verified against `git ls-remote`), 0 ahead / 0 behind, staging empty, single worktree.
>
> `docs/inventory/SOCIAL-INTELLIGENCE-FUTURE-PRODUCT-DESIGN.md` was read as a **derived reference
> only**. Every architectural claim this document depends on was re-verified from released source at
> the baseline above. The derived document is not promoted into authority by being cited.
>
> **Nothing regenerates this document.** Any release or authority change beyond the baseline
> requires it to be **re-derived**, not patched.

---

## The answer, up front

**Hebun already has a complete, released, governed action loop — and Social Intelligence is not
connected to it.**

The question this review was asked — *how can Social Intelligence safely become actionable without
becoming an execution authority?* — has a narrower answer than expected. Social Intelligence does not
need an action architecture. One exists, it is production-proven, and it already enforces every
separation the Director asked for:

```
PROPOSED  →  AUTHORIZED  →  EXECUTED  →  SUCCESSFUL
   ↑            ↑              ↑            ↑
heby_action  decision_      permit       the work row
_requests    records +      consumed     + its audit event
             action_permits
```

That is `GIA-1` (`governed-internal-action/execute-record-work.server.ts`), released, with **no
external reach, proven by a bidirectional import firewall**.

**One thing blocks Social Intelligence from reaching it.** Not a table, not a capability, not a
provider scope, not Governance: a provider observation cannot currently be *cited as evidence*,
because `HebyEvidenceReference.sourceClass` is a closed union of 20 values and none of them covers
provider observations.

Everything else in the chain is already released and already correct.

---

## 0. What was verified independently

Read at the baseline, in source:

`action-authorization/*` · `action-execution/*` · `governed-internal-action/execute-record-work.server.ts` ·
`agent-origination/contracts.ts` · `content-observation/*` · `work-artifacts/*` ·
`organizational-work/*` · `heby-actions/contracts.ts` + `action-registry.ts` ·
`heby-integration/contracts.ts` · `provider-instagram|youtube/contracts.ts` ·
`db/schema/action-authorization.ts` · `action-execution.ts` · `work-artifact.ts` · `_enums.ts` ·
`goal.ts` · `mission.ts` · `reasoning.ts`

### Facts this review establishes on its own evidence

1. **A human may propose.** `recordActionRequest(tenant, prepared, deps, purposeWorkItemId?)` is
   exported and released, and inserts with `{ actorType: "human", actorId: tenant.userId }`.
   *Approval* and *purpose declaration* are human-only by DB CHECK; *proposal* is not restricted.
2. **A permit can only be minted by a human.** `action_permits_human_authorizer_chk` enforces
   `authorized_by_actor_type = 'human'` **at the database**. No agent path can mint one.
3. **`record-work` is declared the second and last executable kind**, with posture
   `CONSEQUENTIAL_MUTATION` / `deterministic-inverse` / `internal-authority`, and the registry
   validates its own honesty invariants.
4. **`action_kind` is a `text` column with no CHECK**, gated in code by the originable registry.
5. **`heby_action_requests` already carries provenance columns**: `evidence` (jsonb),
   `proposal_rationale`, `expected_effect`, `consequences`, `side_effect`, `reversibility`,
   `target_kind` / `target_ref`, `purpose_work_item_id`.
6. **`HEBY_SOURCE_CLASSES` holds exactly 20 entries**, none social or observation-related.
7. **`source_class` is a `text` column, not a pg enum** — so adding a class needs **no migration**.
8. **Preparing a work artifact is not a governed action.** `prepare-work-artifact.server.ts` needs a
   `TenantContext`, a declared preparing intent and a durable agent identity — no permit, no decision.
9. **`reasoningTraces` has zero drizzle queries.** Another unwired table.
10. **`goals` / `missions` have zero drizzle queries** — re-verified independently, not carried over.
11. **Three social read capabilities; zero write capabilities. One execution adapter (email).**

---

## 1. Authority map

| Subsystem | Owns (state) | Reads | Writes | Transitions | Authorization | Runtime? | Production path? |
|---|---|---|---|---|---|---|---|
| **Provider Observation History** | `provider_observations` | own rows | observations | none (append-only) | capability-scoped, tenant-predicated | **Real** | **Yes** |
| **Standing Observation Authorization** | `standing_observation_authorizations` | own + last observation | authorizations | active/revoked | Governance | **Real** | **Yes** |
| **Social Intelligence** | **nothing** | released read seams | **nothing** | none | none | **Real** | **Yes** |
| **Agent Origination** | proposals via Action Authorization | candidates, mandate | (delegates) | → PROPOSED | agent mandate ceiling | **Real** | Yes |
| **Action Authorization** | `heby_action_requests`, `action_permits` | requests, decisions | requests, permits | pending→approved/rejected/withdrawn; permit active→consumed/revoked | **human-only** for approve + purpose | **Real** | **Yes** |
| **Governance Decision** | `decision_records`, audit | proposals | decisions, audit events | approve / reject / revoke | human | **Real** | **Yes** |
| **Action Execution (external)** | `action_execution_attempts` | permit | attempts | pending→accepted/refused/failed/unknown | spent permit | **Real** | Yes (email only) |
| **Governed Internal Action (GIA-1)** | **nothing** | permit | (delegates) | permit→spent, inside one txn | spent permit | **Real** | Yes |
| **Organizational Work** | `work_items` + audit | own rows | work items | record / **retire** | tenant + caller authority | **Real** | **Yes** |
| **Work Artifacts** | `work_artifacts`, revisions | own rows | artifacts, revisions | draft / retired | TenantContext + preparing intent | **Real** | **Yes** |
| **Agent Mandate** | mandate rows | mandates | mandates | revisions | Governance | **Real** | Yes |
| **Heby** | conversation rows | source classes | messages, artifacts (one seam) | none over actions | per-source | **Real** | **Yes** |
| **Human Approval (`human-approval/`)** | — | — | **zero DB writes** | — | — | **Architecture-only** | No |
| **Goal / Mission** | `goals`, `missions` | — | **zero queries** | — | — | **Schema-only** | **No** |
| **Reasoning traces** | `reasoning_traces` | — | **zero queries** | — | — | **Schema-only** | **No** |

### What each subsystem must never do on another's behalf

- **Social Intelligence** must never write a proposal row, mint a permit, record work, admit
  Knowledge, or hold lifecycle state of any kind. It may *compose a request* that an owning authority
  writes.
- **Agent Origination** must never approve. The DB CHECK makes this structural, not conventional.
- **GIA-1** must never open its own transaction or hold a table — it hands the permit's transaction
  to the owning authority. It is explicitly "a wiring seam, not an executor authority".
- **Heby** must never mint authority because it is conversational. Its one durable seam
  (`prepareWorkArtifact`) is reachable only on an explicitly declared preparing intent.
- **Action Execution** must never be reused for internal acts. Its ledger is external-send-specific
  in schema *and in meaning* — `recipient_id` and `adapter_id` are NOT NULL.

> **The rule this map enforces:** Social Intelligence does not gain lifecycle authority by wanting to
> initiate work. It gains a *composition seam* into authorities that already own the lifecycle.

---

## 2. Precedents

### TRH-20 — live observation → proposal

`content-observation/originate-with-observation.server.ts` composes a **live** YouTube public read
(CGO-5) with `originateAgentAction`. It stores no observation, keeps no history, compares nothing,
ranks nothing and mints nothing. A failed observation does not fail the origination, and the model is
told *nothing* about an absent observation — "an absence is not evidence of anything."

**Reusable:** the shape — a third module composing two released seams, with neither gaining an import
of the other. **Not reusable:** the input. It reads a provider *live*. The Social Intelligence path is
stored history, which the authoritative specification (§14) already states explicitly.

**This precedent must not be generalised into a universal architecture.** It is one composition, for
one capability, with one agent.

### GIA-1 — proposal → decision → permit → internal mutation

The complete loop, released:

| Stage | Record | Owner |
|---|---|---|
| Heby or a human **proposes** | `heby_action_requests` | Action Authorization |
| A human **decides** | `decision_records` | Governance |
| A permit **exists** | `action_permits` (human-only CHECK) | Action Authorization |
| The permit is **spent** | `consumeActionPermit` | Action Authorization |
| The Work Authority **mutates** | `work_items` | Organizational Work |
| The **outcome** | the work row + its audit event, same transaction | Organizational Work |

Its own comment states the ladder this review adopts:

> `PROPOSED != AUTHORIZED != EXECUTED != SUCCESSFUL`

And the failure semantics: *"A refusal inside the transaction ABORTS it: the permit reverts to active
and no work row exists. So 'authorized' never silently becomes 'successful'."*

Idempotency is the permit itself — a second invocation finds nothing to spend. There is deliberately
**no framework for a second internal action**, which is a constraint on this design, not an invitation.

### R3W — preparation without governance

`prepare-work-artifact.server.ts` is the one Heby seam producing a durable artifact. It is
**ungoverned by design**, because a prepared artifact is *"Not Knowledge, not approved, not
authoritative, not executed."* The separation is structural: the ordinary answer path imports the
artifact reader and **no writer at all**.

---

## 3. The canonical action ladder

The Director's candidate ladder is replaced below with repository vocabulary where one exists. Three
proposed stages **do not exist in Hebun and are not invented here**.

| # | Stage | Repository representation | Owner | Persistence | Human required? | Provider capability? |
|---|---|---|---|---|---|---|
| 1 | **OBSERVED** | `provider_observations` | Observation History | **Yes** | no | read (held) |
| 2 | **CALCULATED** | pure derivation, in memory | Social Intelligence | **No** | no | none |
| 3 | **INFERRED** | — *(no representation)* | would be Heby | **No** | no | none |
| 4 | **RECOMMENDED** | — **UNAVAILABLE** (§6) | — | **No** | — | — |
| 5 | **PROPOSED** | `heby_action_requests` status `pending` | Action Authorization | **Yes** | proposer may be human **or** agent | none |
| 6 | **PREPARED** | `work_artifacts` + revision | Work Artifacts | **Yes** | human-invoked intent | none |
| 7 | **AUTHORIZED** | `decision_records` + `action_permits` active | Governance + Action Auth. | **Yes** | **YES — DB CHECK** | none |
| 8 | **EXECUTABLE** | active permit + registered adapter *or* internal seam | Action Auth. | derived | — | depends on kind |
| 9 | **EXECUTED** | permit consumed, `handoff_id` exists | Action Authorization | **Yes** | no | — |
| 10 | **SUCCESSFUL / FAILED** | the work row + audit event (internal) · attempt status (external) | owning authority | **Yes** | no | — |
| 11 | **RESULT OBSERVED** | — *(no representation for social)* | — | **No** | — | would need read |

**Note on ordering.** PREPARED is **not** a stage between PROPOSED and AUTHORIZED. It is a parallel
track: an artifact is prepared *first*, then an action may be proposed *against* a revision of it. The
Director's linear ladder implies a sequence the architecture does not have, and flattening it would
suggest preparation needs authorization — it does not.

### Illegal transitions

| Forbidden | Why, in this repository |
|---|---|
| RECOMMENDED → anything | Stage 4 has no representation. Nothing can transition from a state that does not exist |
| PROPOSED → EXECUTED | Skips the human CHECK on `action_permits`. Structurally impossible, not merely forbidden |
| AUTHORIZED → SUCCESSFUL | GIA-1 exists precisely to keep these apart. A refusal aborts and the permit reverts |
| PREPARED → SUCCESSFUL | Preparation produces text. No execution evidence exists to make anything successful |
| EXECUTED → SUCCESSFUL (external) | `accepted` means the provider answered. Delivery is not represented (§9) |
| CALCULATED → PROPOSED, automatically | A calculation is not a reason. A proposer — human or mandated agent — must exist |
| Any stage → RESULT OBSERVED | Requires an observation Hebun did not take. Cadence is not evidence of causation |

---

## 4. The narrowest legitimate loop

Three candidates were evaluated against repository reality.

### A · Prepare an Instagram content draft

| | |
|---|---|
| Capability | **Released** — `content-draft` + `content_destination: "instagram"` |
| Owner | Work Artifacts |
| Governance | **None required** — preparation is ungoverned by design |
| Missing seam | A Social-Intelligence-grounded preparing intent |
| External mutation | **No** |
| Reversible | Yes — `retired` lifecycle |
| Blocker | Requires a **model call** and a **durable agent identity**; grounding on social evidence needs the missing source class |

**Verdict: legitimate, but not the narrowest.** It drags in the model path and agent authorship.

### B · Record Social-Intelligence-derived work

| | |
|---|---|
| Capability | **Released end to end** — the entire GIA-1 chain |
| Owner | Organizational Work (via Action Authorization + Governance) |
| Governance | **Yes, and already built** — human decision mints the permit |
| Missing seam | A preparer producing a `record-work` `HebyPreparedAction` carrying observation evidence |
| External mutation | **No** — firewall-proven no external reach |
| Reversible | **Yes** — `retireWork` is the declared deterministic inverse |
| Blocker | `HebyEvidenceReference.sourceClass` cannot name a provider observation |

**Verdict: the narrowest and the best.** No model, no agent, no mandate, no provider call.

### C · Create/prepare an existing proposal

**Not a third option.** Creating a proposal *is* step one of B. Evaluated and folded in.

### The choice

**B is the best first loop**, on every criterion the Director named:

- **Architectural legitimacy** — every lifecycle stage stays with its existing owner; Social
  Intelligence writes nothing.
- **Product usefulness** — turns "followers fell by 4" into a tracked organizational commitment with
  the evidence attached.
- **Minimum new authority** — none. One source class and one preparer.
- **Minimum external risk** — zero. No provider is contacted; the firewall proves it cannot be.
- **Reuse** — proposal, decision, permit, execution and work authority are all released.
- **Reversibility** — `retireWork`, already declared as this kind's inverse.
- **Testability** — the whole chain is already under test; the new surface is a pure preparer.

---

## 5. Product flow

### CURRENTLY POSSIBLE (released, no new code)

```
stored observations → measurement series → calculated comparison → rendered with provenance
```

That is the whole of it. The surface reads and shows. **Nothing else is reachable from it today.**

### NEXT LEGITIMATE EXTENSION (the candidate phase — §12)

```
Instagram observations (PROVIDER REPORTED)
  → measurement series          (HEBUN OBSERVED)
  → calculated comparison       (HEBUN CALCULATED)
  → a HUMAN reads it and decides this deserves organizational attention
  → the human proposes `record-work`, with the observations cited as evidence   [PROPOSED]
  → a human decides in Governance                                              [AUTHORIZED]
  → GIA-1 spends the permit; the Work Authority records the item               [EXECUTED]
  → the work row and its audit event exist                                     [SUCCESSFUL]
  → no Instagram request is made, ever
```

**The human is the inference layer.** That is not a limitation dressed up as a virtue — it is what
makes this phase honest while stages 3 and 4 have no representation. Hebun supplies evidence; a person
supplies judgement; Governance supplies authorization.

### FUTURE ONLY (requires authority that does not exist)

```
… → INFERRED explanation        needs a Heby social grounding path
  → RECOMMENDED next action     needs a recommendation representation (§6) AND a goal (§7)
  → prepared content draft      needs the model path + agent authorship
  → published to Instagram      needs a Meta scope, a capability, an adapter, a new kind
  → result observed             needs post-action observation
  → learning                    needs attribution Hebun cannot honestly perform (§9)
```

---

## 6. Recommendation authority

### RECOMMENDATION AUTHORITY = UNAVAILABLE

Searched and verified: no `recommendations` table, no recommendation lifecycle, no recommendation
record type. The two near-misses are both dead ends:

- `reasoning_traces.recommendation` — a text column on a table with **zero drizzle queries**.
- `PREPARE_RECOMMENDATION` — a Heby *intent*, not a record. It produces a `work_artifact`, whose type
  enum is `operational-plan` / `message-draft` / `content-draft`. **None is a recommendation.**

So today: **model text in a conversation is not a Hebun recommendation artifact**, and nothing makes
it one.

### Does Hebun need a durable recommendation authority?

| Option | Assessment |
|---|---|
| **A · Ephemeral reasoning output** | Honest and cheap. But nothing can be revisited, audited or evaluated — and evaluation is the whole point of a learning loop |
| **B · New durable recommendation artifact** | Full lifecycle, provenance, audit. **Also a new table, new states, new authority** — and duplicates much of what a proposal already is |
| **C · Represented as an existing proposal / work artifact** | `heby_action_requests` already carries `proposal_rationale`, `expected_effect`, `consequences`, `evidence` and a lifecycle. **A recommendation that names an action already IS a proposal** |
| **D · Another authority solves it** | Partly — C is that answer |

**Assessment: C, and A for everything else.**

A recommendation that names a specific action is already expressible as a *proposal*, with better
provenance than a bespoke record would carry — because the proposal's lifecycle is enforced by a
database CHECK rather than by convention.

A recommendation that names no action ("your posting is irregular") is advice, and belongs in A —
ephemeral, labelled inference, not durable truth.

**Option B should be rejected unless a concrete need survives C.** Its cost is a new table, new
lifecycle states, and a second thing that looks like a proposal without being one. The repository has
already paid twice for declaring states nothing transitions rows into — the `hebyActionRequestStatusEnum`
comment records exactly that lesson.

---

## 7. Goal dependency

**Re-verified independently at this baseline:** zero drizzle queries touch `goals` or `missions`.
The finding stands — **no runtime organizational goal authority exists.** A schema is not an authority.

### The line

| GOAL-INDEPENDENT — legitimate today | GOAL-DEPENDENT — needs an objective |
|---|---|
| "Followers went 56 → 52" | "That is bad" |
| "This post gained 3 likes between observations" | "This post performed well" |
| "Hebun last observed at 14:00:19Z" | "Observe more often" |
| "Two of eight posts appear in both observations" | "Prioritise carousels" |
| "The value did not move" | "Growth has stalled" |
| "Instagram reported no comment count" | "Engagement is weak" |

**The boundary is the adjective.** Every goal-independent statement is a noun and a number. The moment
a comparative or evaluative word appears — *good, weak, better, stalled, succeeding* — an objective is
being assumed. If none is stated, the product has silently invented one.

### The interface Social Intelligence would eventually need

Stated as a *requirement on an owner that does not exist yet*, not as a design for one:

```
Social Intelligence requires from the Goal Authority:
  · a stable goal reference it can cite as provenance
  · the objective in words, for a human to read beside the evidence
  · a success criterion expressed in terms SOME authority can measure
  · the ability to answer "no goal is stated" without failing
```

The fourth is the load-bearing one. If the absence of a goal is not a first-class answer, every
surface will render a default objective instead — and the default will be "more followers".

**This task does not solve the missing goal authority, and Social Intelligence must not own it.**

---

## 8. Governance matrix

Provider capability is taken from **released repository truth**, never from what an API could support.

| Action | Internal / External | Reversibility | Provider mutation | Governance likely | Provider **write** capability required | Available today |
|---|---|---|---|---|---|---|
| View observation | Internal | n/a (read) | No | **No** | No | **Yes** |
| Calculate comparison | Internal | n/a (pure) | No | **No** | No | **Yes** |
| Generate explanation | Internal | Ephemeral | No | No — but must be labelled inference | No | **No** — no social grounding path |
| Generate recommendation | Internal | Ephemeral | No | No | No | **No** — §6 |
| Create internal draft | Internal | Reversible (`retired`) | No | **No** — ungoverned by design | No | **Yes**, but not from this surface |
| **Create work item** | **Internal** | **Reversible (`retireWork`)** | **No** | **YES — released chain** | **No** | **Yes**, but not from this surface |
| Prepare proposal | Internal | Reversible (`withdrawn`) | No | It *is* the governance entry | No | **Yes**, but not from this surface |
| Edit draft | Internal | Reversible (new revision) | No | No | No | Yes |
| Publish Instagram post | **External** | **Irreversible in effect** | **Yes** | **Yes** | **Yes** — `instagram_business_content_publish` | **No** |
| Reply to a comment | **External** | **Irreversible in effect** | **Yes** | **Yes** | **Yes** + a comment read that does not exist | **No** |
| Modify profile | **External** | Partially reversible | **Yes** | **Yes** | **Yes** | **No** |
| Send direct message | **External** | **Irreversible** | **Yes** | **Yes** | **Yes** | **No** |
| Launch advertisement | **External** | **Irreversible — spends money** | **Yes** | **Yes**, plus commercial + legal | **Yes** | **No** |
| Delete content | **External** | **Irreversible** | **Yes** | **Yes** | **Yes** | **No** |

**"Irreversible in effect"** is deliberate. A post can be deleted, but it cannot be un-seen. Hebun's
own vocabulary already carries this: `PUBLISHED is not DELIVERED`, `DELIVERED is not SEEN`.

**Every external row is unavailable for the same reason** — no social write capability exists anywhere
in the repository. That is one gate, not six.

---

## 9. Result observation, and the limits of attribution

### Execution success ≠ business outcome

Hebun's execution vocabulary is already precise about this and must not be widened:

- **Internal (GIA-1):** the work row and its audit event *are* the outcome. There is no ambiguous
  phase — it committed or it did not.
- **External (email):** `accepted` means the provider accepted the request. `provider_message_id`
  is an identifier, not a delivery confirmation. **No delivery seam exists.**

### What connecting action to outcome would require

```
prepared action      → a revision digest                    EXISTS
authorized execution → permit + decision                    EXISTS
provider result      → attempt row (external only)          EXISTS for email; nothing for social
later observation    → an observation AFTER the action      the cadence does not know an action happened
business outcome     → attribution                          DOES NOT EXIST, and may never honestly
```

### Attribution limits, stated plainly

1. **The cadence is blind to actions.** Observations land on a fixed schedule; nothing marks one as
   "after the thing we did". A before/after split would be Hebun choosing the boundary.
2. **Correlation is not causation.** Followers rising after a post is consistent with the post,
   another post, a mention elsewhere, or nothing.
3. **Temporal sequence is not proof.** Especially at a 1440-minute cadence, where a whole day of
   unobserved activity sits between two points.
4. **n is tiny.** Two observations, eight posts. No statistical claim survives contact with that.
5. **The window is bounded.** `moreMediaExist` can be `true`, and a post leaving the window is not a
   post being deleted.

**Design position: Hebun should report what it observed after an action, and explicitly decline to
attribute.** "These are the measurements Hebun recorded after that work was authorized" is honest and
useful. "That work produced +5 followers" is not, and no amount of history makes it so.

---

## 10. Heby's role

| Role | Legitimate? | Authority Heby must call |
|---|---|---|
| Explain evidence | **Yes** — this is its purpose | A social grounding source class *(missing)* |
| Present calculated changes | **Yes** — carry, never recompute | Social Intelligence derivations |
| Expose uncertainty | **Yes, required** | `HebyUncertaintyState` — already exists |
| Present recommendations | **Yes, as labelled inference** | none — it is speech, not a record |
| Prepare a proposal | **Yes** — already released for agents | `originateAgentAction` under a mandate |
| Ask for authorization | **Yes** — asking is not authorizing | Action Authorization; the human decides |
| Invoke Work | **No — never directly** | Only via permit → GIA-1 |
| Report execution status | **Yes** | Action Authorization / execution readers |
| Report observed results | **Yes, with §9's refusal to attribute** | Observation History |

**Heby gains no authority from being conversational.** The repository already enforces this
structurally: the ordinary answer path imports the artifact *reader* and no writer; `createKnowledgeAction`
is a separate action Heby's own actions do not import; and no agent path can mint a permit because the
database forbids it.

**Heby is not on the critical path of the candidate phase.** The first loop is human-driven precisely
so that it needs no model call, no agent identity and no mandate.

---

## 11. Minimum architectural delta

| Change | Class | Note |
|---|---|---|
| Governance decision + permit flow | **REUSE EXISTING** | Untouched |
| `recordActionRequest` (human proposer) | **REUSE EXISTING** | Exported and released |
| GIA-1 internal execution | **REUSE EXISTING** | Untouched |
| Organizational Work + `retireWork` | **REUSE EXISTING** | Untouched |
| Social Intelligence derivations | **REUSE EXISTING** | Untouched |
| `HEBY_SOURCE_CLASSES` + one class | **EXTEND EXISTING** | `source_class` is `text` — **no migration** |
| A `record-work` action preparer carrying observation evidence | **NEW CANDIDATE** | Pure; one module; the only genuinely new code |
| One UI affordance on the SI surface | **NEW CANDIDATE** | Composition only |
| Recommendation table | **NOT NEEDED** | §6 — a proposal already is one |
| Goal authority | **BLOCKED** | §7 — another program's |
| Social write capability / adapter / new kind | **NOT NEEDED** | The loop is internal by construction |
| Any new table, schema or migration | **NOT NEEDED** | See below |

### Proof that no new persistence is required

Each artifact the loop produces already has an owning authority and a home:

| Artifact | Existing home |
|---|---|
| The proposal | `heby_action_requests` — with `evidence` jsonb already present |
| The evidence citation | `evidence` jsonb; `source_class` is `text`, not an enum |
| The decision | `decision_records` + governance audit |
| The authorization | `action_permits` |
| The execution fact | permit consumed + `handoff_id` |
| The outcome | `work_items` + its audit event |

**Nothing in this loop lacks an owner. A new table would therefore be a second home for something
already housed, and is rejected.**

---

## 12. Candidate first phase — provisional `SOC-ACT1`

> **`SOC-ACT1` is PROVISIONAL, NOT ROADMAP-APPROVED and NOT IMPLEMENTED.**
>
> Provisional label only. `SOC-*` follows the released Social Intelligence delivery convention and
> MASTER-ROADMAP §17 (delivery labels, never authorities). `SOC-ACT1` is unused at this baseline.
> **This is not added to any roadmap by being written here**, and no part of it has been built.

**OBJECTIVE** — Let a human turn an observed social measurement into a governed organizational work
item, without Social Intelligence gaining any lifecycle authority and without contacting any provider.

**USER VALUE** — Today the dashboard ends in a number. A founder who sees something worth acting on
must leave, remember it, and re-describe it elsewhere. This closes that gap with the evidence
attached, so the work item says *what was observed* and *when Hebun observed it*.

**AUTHORITATIVE INPUT** — The released Social Intelligence composed view model, over
capability-scoped stored observations. No new read. No provider call.

**AUTHORITATIVE OWNER** — Organizational Work owns the outcome. Action Authorization owns the
proposal and the permit. Governance owns the decision. **Social Intelligence owns nothing.**

**WRITE SEAM** — `recordActionRequest(tenant, prepared, …)`, released, with a human proposer. Social
Intelligence contributes a **pure preparer** producing a `record-work` `HebyPreparedAction` whose
`evidence` cites the observations by their stable refs.

**GOVERNANCE** — Unchanged and mandatory. A human decides; the permit's human-only DB CHECK is the
enforcement. Execution runs through GIA-1 inside the permit's transaction.

**PROVENANCE** — `evidence` names the observations. `expected_effect` states that a work item will be
recorded. `consequences` states that a durable organizational record with an audit trail comes into
existence. The truth classes stay visibly separate: the observation is PROVIDER REPORTED, the instant
is HEBUN OBSERVED, the change is HEBUN CALCULATED, and **the decision to act is the human's** — Hebun
infers and recommends nothing.

**NON-CLAIMS** (rendered, and asserted by test):
- Nothing is published. No social provider write capability exists in Hebun.
- No Instagram or YouTube request is made. This path cannot reach a provider.
- Recording work is not a judgement that the measurement is good or bad.
- A work item is not a goal, a plan, or a commitment by Hebun to do anything.
- Hebun will not claim the work changed any measurement.

**TEST CONTRACT** — at minimum:
- the preparer is pure: no DB, no provider, no clock, no env
- evidence cites observations actually present in the input; never fabricated refs
- an absent or unusable measurement yields **no** proposable action
- `record-work` posture matches the registry (consequential, deterministic-inverse, internal)
- a firewall proving the module's import graph reaches **no** adapter, transport or provider
- a firewall banning ranking/score/performance/recommendation vocabulary
- proposal without a human decision never produces a work item
- a refused execution leaves the permit active and **no** work row
- bite-proofs per repository convention, never run concurrently

**UI SURFACE** — One affordance on the existing Social Intelligence surface. No redesign, no new
panel, no chart. It opens the released proposal path; it does not approve anything.

**SECURITY BOUNDARY** — No credential, no provider, no tenant-supplied scoping. Tenant scoping stays
owned by the released read seam. No internal identifier reaches the screen.

**OUT OF SCOPE** — IG-AN3, YT-SOC3, the cadence finding, publishing, recommendation records, goal
authority, Heby integration, competitor intelligence, and any second internal action kind.

**ACCEPTANCE GATE** — One real work item, recorded in production through a real human decision, with
the observation evidence attached and the audit event present — and **zero** provider requests during
the whole ceremony, proven by the observation history being unchanged.

---

## 13. DIRECTOR DECISION REQUIRED

> ### Should Social Intelligence gain a narrow, human-driven composition path into the already-released governed internal action chain — or remain strictly read-only for the next phase?
>
> The authoritative specification currently calls Social Intelligence *"a reading surface over stored
> provider evidence"* that *"connects nothing, authorizes nothing, and calls no provider."*
>
> Under the candidate phase, the last two clauses stay true — it would still authorize nothing and
> call no provider. **The first clause changes:** it would become a surface from which a human can
> begin a governed act.
>
> That is a product identity decision, not an implementation detail, and it is yours. If the answer is
> yes, the specification's §1 and §3 should be reconciled deliberately, in their own reviewed change —
> not as a side effect of building.

**Secondary decisions, only if the primary is yes:**

1. Is `record-work` the right first act, or should preparing a content draft come first despite
   needing the model path?
2. Does adding a social source class to `HEBY_SOURCE_CLASSES` need its own gate, given it widens what
   Heby may cite?
3. Should the recommendation question be settled now (§6 recommends option C — a recommendation that
   names an action already *is* a proposal), or deferred until a goal authority exists?
