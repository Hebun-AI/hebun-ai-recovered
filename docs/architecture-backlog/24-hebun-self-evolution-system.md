# 24 — Hebun Self-Evolution System

**Priority:** Future
**Status:** Planned — prerequisite-gated (see *Deferment*)

## Purpose

A **governed product-development intelligence loop that lets Hebun improve Hebun from evidence.**

Every other capability in this backlog improves the *customer's* organization. This one improves *the product itself*: it observes real signals about how Hebun is used and where it fails, clusters them into problems, investigates causes, prepares candidate changes in isolation, verifies them, and brings the survivors to the Director as an evidence package.

**Self-Evolution does not mean self-modification.** It means evidence-backed improvement inside authority boundaries the system cannot move. The Director remains the authority for every consequential release, merge and deploy decision. A recommendation is not a decision.

## Not to be confused with

This capability sits at the centre of several existing records and would be easy to conflate with any of them. The distinctions are load-bearing.

| | Subject it improves / models | Relationship to Self-Evolution |
|---|---|---|
| [19 — Learning Engine](19-learning-engine.md) | the **customer's** organization — patterns from their projects | Different subject entirely. 19 distils why a customer's project worked; 24 distils why *Hebun* failed a user. |
| Innovation Intelligence *(see [Future Architecture Backlog](future-architecture-backlog.md))* | **external markets** → new product opportunities | Outward-facing discovery. 24 is inward-facing repair and improvement of what already ships. |
| Problem Intelligence *(same register)* | **cross-industry** business problems → AI-native hypotheses | Finds problems in the world. 24 finds problems in Hebun. |
| [23 — Director Digital Twin](23-director-digital-twin.md) | how the **Director evaluates** | May inform prioritisation and review preparation. **Never approves.** |
| [22 — Heby Guided Learning Mode](22-heby-guided-learning-mode.md) | teaches **humans** to use Hebun | Opposite direction. 22 changes the person; 24 changes the product. |
| [21 — Enterprise System Map](21-enterprise-system-map.md) | how the **company** runs | A twin of the organization, not of the product. |
| [18 — Observability Center](18-observability-center.md) | platform **live health** | A signal *source* for 24, not a competitor. 18 shows what is happening; 24 asks what should change because of it. |

### It does not replace the Capability Lifecycle

**[00 — Capability Lifecycle](00-capability-lifecycle.md) already owns the process by which Hebun changes.** It defines the twelve stages, the entry and exit criteria, and the Director gates — including Stage 12, *Maintenance & Evolution*, whose exit criterion already reads *"a material change re-enters the lifecycle at the appropriate stage."* Its mandatory rules already require Director approval before implementation, architectural review before code review, and *"Commit, Tag, and Push happen only after Director approval."*

Self-Evolution is **an actor inside that lifecycle, not a second lifecycle.** It may carry work through stages 1–8 and present at stage 9; it may never define what those stages mean, shorten them, or claim an approval they require. A parallel process with its own softer rules would be an authority laundering scheme, whatever it was called.

## The loop

```
OBSERVE → INTERPRET → PRIORITIZE → INVESTIGATE → PROPOSE
   → IMPLEMENT CANDIDATE → VERIFY → DIRECTOR REVIEW
   → RELEASE → MEASURE OUTCOME → LEARN
```

The loop is closed only by the last two steps. A system that proposes changes but never measures whether they helped is generating opinions, not evidence.

## Feedback Intelligence — future input classes

The input layer that turns raw signal into something interpretable. **None of these is connected today.** They are recorded as future input *classes*, not as available data.

**Human-authored** — ideas, complaints, feature requests, bug reports, support conversations, community discussion.

**Behavioural** — product usage signals, abandonment, repeated manual work, workflows a user starts and never finishes.

**System-measured** — failed workflows, failed agent runs, latency, cost, retrieval misses, eval failures.

**Engineering-derived** — security findings, architectural debt, regression history.

**Commercial** — churn and retention signals.

The classes differ in trustworthiness and must never be pooled into one undifferentiated stream. A measured retrieval miss and a user's opinion about retrieval are both evidence, but they are not the same *kind* of evidence, and a design that flattens them will let volume outvote measurement.

## Feedback Hub — a boundary, not a workspace

A future user-facing entry surface — plausibly Ideas, Complaints, Bugs, Requests, Discussions.

**The Hub is only an input surface. The capability is the intelligence loop behind it.** Recording it here is not a decision to build a workspace, and its UI architecture is deliberately left open. A feedback form with no loop behind it is a suggestion box; the loop is the product.

## Signal quality — popularity is not authority

Hebun must not treat all feedback as equally valuable. Future processing has to distinguish duplicates, noise, low-value requests, conflicting requests, security-unsafe requests, customer-specific requests, broad product patterns, architectural defects, usability issues, business opportunities, and **false or unsupported claims**.

The system clusters and ranks *problems*; it does not count votes.

> **400 users asking to remove approvals does not authorize removing Governance controls.**

That request is real data about friction and must be recorded as such. What it licenses is an investigation into *why approval feels expensive* — not the removal of the control. Demand is evidence about experience; it is never evidence about legitimacy.

## Improvement Intelligence

The conceptual transformation from noise to a decidable proposal:

```
raw signal → problem cluster → evidence → root-cause hypothesis
  → affected subsystem → architecture impact → candidate solution
  → expected impact → risk → validation plan
```

A proposal must be able to answer: What problem exists? How do we know? Who is affected? Which subsystem owns it? Is this actually a *product* problem? What is the narrowest legitimate fix? **What must not change?**

That last question is the one that keeps a fix from becoming a redesign. It is also where a proposal most often discovers it should not exist.

Self-Evolution derives and presents; it does not become a new truth authority for product decisions.

## Self-implementation boundary

A future candidate builder **may**:

- inspect repository reality
- create an isolated branch, worktree or sandbox candidate
- modify code inside that isolated environment
- add tests
- prepare migrations when justified
- run verification
- **discard its own failed candidates** and iterate before presenting anything

It **must never autonomously**:

- merge to `main`, or force-push anything
- deploy to production
- alter Governance authority
- grant itself permissions
- disable a safety firewall
- change what Director approval is required for
- modify secrets or credentials
- connect external execution without authorization

The asymmetry is the design. Everything on the first list is reversible inside an isolated environment and costs nothing if wrong; everything on the second is consequential, and consequence is the Director's.

## Self-verification — a candidate must be able to fail itself

Generated code is not a finished candidate. Verification should cover, where applicable: architecture boundary audit, authority audit, tenant isolation, provenance, lint, typecheck, unit tests, integration tests, migration tests, security tests, browser/e2e where a harness exists, performance, evals, cost, regression analysis, and git scope.

**A candidate that cannot reject itself will hand the Director its own optimism as evidence.** The verification layer exists so that what reaches review has already survived an adversary — and so that the Director's time is spent on judgement, not on catching obvious failures.

## The Director gate

A proposal reaches the Director as an evidence package:

> Problem · Evidence · Root cause · Affected subsystem · Proposed change · Architecture impact · Authority impact · Security impact · Diff · Tests · Migration status · Expected impact · Known limitations · Rollback · Recommendation

Director actions: **APPROVE · REJECT · REQUEST REVISION**.

The package carries a *recommendation*. The recommendation is an input to a decision, structurally distinguishable from one. Self-Evolution never holds the Director's authority, and no confidence level, verification result or predicted preference converts a recommendation into an approval.

## Outcome learning

After an approved change is released: measure whether the target problem actually improved, compare expected against actual impact, detect regressions, and feed the result into future evaluation — including the evaluation of Self-Evolution's own judgement.

**No automatic rollback and no automatic promotion is authorized here.** Both are consequential actions belonging to Execution and Governance, and would need their own decisions.

## Authority map

| Concern | Owner | Self-Evolution's relation |
|---|---|---|
| Organizational truth | Knowledge | reads; never writes |
| Legitimacy, consequential decisions | Governance | subject to; never extends |
| Governed learning / candidate memory | Enterprise Memory, [19 Learning Engine](19-learning-engine.md) | may deposit through their boundaries |
| Derived signal analysis | Feedback Intelligence *(future, within this capability)* | owns |
| Investigation / implementation workforce | Agent Workforce, [11 Agent Registry](11-agent-registry.md) | commissions; does not become |
| Authorized consequential action | Execution | requests; never performs directly |
| Release / merge / deploy authority | **Director** | presents to; never assumes |
| Improvement lifecycle orchestration | **Self-Evolution** | owns *this and only this* |

Self-Evolution must not become a second owner of any row above it. Its own row is orchestration and intelligence over the improvement lifecycle — the connective tissue, not a new organ.

## Constitutional boundary — non-negotiable

**Hebun may improve its implementation. Hebun may not autonomously redefine the authority that governs its own improvement.**

Forbidden as autonomous changes, permanently and regardless of evidence quality:

- removing or narrowing Director approval
- weakening tenant isolation
- granting itself execution authority
- disabling audit
- deleting Governance controls
- modifying constitutional safety rules
- widening credential or secret access
- **redefining what counts as successful verification**

> A system that can silently rewrite its own governing limits does not have governing limits.

The last item is the subtle one. Changing the definition of "verified" is functionally identical to removing verification, and it would look like an ordinary engineering improvement in a diff. A proposal touching the verification contract is a governance change wearing a test file, and must be routed as one.

## Relation to the Director Digital Twin

[23 — Director Digital Twin](23-director-digital-twin.md) may legitimately inform Self-Evolution: likely Director preference, prioritisation context, review preparation — helping decide what deserves the Director's attention first.

> **TWIN PREDICTION ≠ DIRECTOR APPROVAL.**

Self-Evolution must never auto-approve because the Twin predicts approval. A predicted decision that executes itself is not a prediction; it is the decision, taken by the wrong party. Twin output stays derived and structurally distinguishable, exactly as 23 requires.

## Relation to Guided Learning

[22 — Heby Guided Learning Mode](22-heby-guided-learning-mode.md) teaches humans; Self-Evolution improves the product. **Lesson progress and product-improvement telemetry must not merge.** A user struggling with a lesson is a teaching signal; the same user struggling with the live surface is a product signal. Pooling them would let training data masquerade as product evidence, and would quietly turn a learner's mistakes into a mandate to change the thing they were learning.

## Relation to Research Workforce

Future research agents ([01 — Strategic Research Intelligence](01-strategic-research-intelligence.md)) may support Self-Evolution by investigating competitors, customer sentiment, market changes, product opportunities, technical alternatives, documentation and security findings.

**Research findings remain derived evidence. Research does not authorize a code change.** A well-sourced report that a competitor ships a feature is an input to a proposal, never a proposal's approval.

## Illustrative future workflow — not a live capability

Everything below is hypothetical, describing how the loop would read once its prerequisites exist. **No part of this runs today.**

```
18,420 signals → 37 problem clusters → 7 investigations
   → 3 validated candidates → 1 Director decision required
```

**Candidate — Turkish Knowledge Retrieval typo tolerance**

| | |
|---|---|
| Problem | measured retrieval misses caused by spelling errors |
| Evidence | real product signals — measured misses, not requests |
| Root cause | the retrieval representation carries no typo tolerance |
| Architecture impact | Knowledge authority unchanged; a retrieval-layer change only |
| Candidate | prepared in isolation, tests and evals green |
| Director | Approve / Reject / Request revision |

The example is deliberately narrow, and deliberately one where Knowledge authority does *not* move. A candidate that proposed changing what the organization holds as true would not be a retrieval improvement — it would be a Knowledge mutation, and it would belong to Governance rather than to this loop.

## Deferment

**Intentionally deferred until Hebun can observe itself honestly.** Built early, this capability would generate confident proposals from signals nobody validated, against a product with no measured behaviour to compare them to — sophisticated guessing with a verification report attached.

**No phase number is invented here.** The repository's own rule governs, as already recorded in the [Product Information Architecture](../product-vision/ui/hebun-information-architecture.md): *"The architectural dependency governs; speculative phase numbers do not."* Phase numbers get renumbered and retired; a prerequisite expressed as architecture stays meaningful when they do.

Prerequisite areas, classified honestly against repository reality rather than intent:

| Prerequisite | Honest status today |
|---|---|
| Verification infrastructure | **executable** — `npm run verify` runs lint, typecheck, the full suite and build, and gates every phase |
| Governance / approval boundaries | **executable** — durable Governance authority, delegation and ratification exist and are exercised |
| Repository reality / provenance | **partially executable** — answer and knowledge provenance are durable; there is no product-wide provenance surface |
| Director review boundary | **partially executable** — Governance decisions are durable, but the approval product surface carries no server-authorized mutation path |
| Memory / Learning | **designed** — [19](19-learning-engine.md) is Planned; memory schema exists with no writer |
| Product observability / telemetry | **designed** — [18](18-observability-center.md) is Planned; telemetry schema exists |
| Agent Workforce | **designed** — [11](11-agent-registry.md) is Planned; no investigation or implementation workforce runs |
| Isolated execution / sandbox capability | **not designed** — no sandbox contract exists in the repository |
| Feedback Intelligence inputs | **not designed** — no feedback is captured anywhere today |

The real gate is the last three. A loop that can propose but cannot investigate, isolate or measure is a proposal generator, and the two prerequisites nearest to ready — verification and Governance — are precisely the ones that make its *output* safe rather than its *input* trustworthy.

## Maturity model

A ladder, recorded to sequence the work. **No level is implemented.**

| Level | Capability |
|---|---|
| 1 — Self Observation | Hebun detects issues and opportunities in itself |
| 2 — Self Diagnosis | Hebun investigates causes |
| 3 — Self Proposal | Hebun produces architecture and change proposals |
| 4 — Self Implementation Candidate | Hebun builds changes in isolation |
| 5 — Self Verification | Hebun verifies candidates and rejects weak ones itself |
| 6 — Director-Gated Evolution | Hebun submits validated release candidates for Director approval |

**There is deliberately no level seven.** No level exists, now or later, at which Hebun autonomously rewrites the authority governing its own improvement. The ladder ends at a Director gate because that is its destination, not because further rungs are unbuilt.

## Dependencies

- [00 — Capability Lifecycle](00-capability-lifecycle.md) — the process this executes and must never replace
- [18 — Observability Center](18-observability-center.md) — system-measured signal
- [19 — Learning Engine](19-learning-engine.md) — adjacent; organizational patterns, not product ones
- [11 — Agent Registry](11-agent-registry.md) — the future investigation and implementation workforce
- [13 — Policy Engine](13-policy-engine.md) / [14 — Permission Engine](14-permission-engine.md) — the boundaries a candidate may not widen
- [23 — Director Digital Twin](23-director-digital-twin.md) — may inform prioritisation; never approves
- Governance — legitimacy, and the authority this capability must never acquire
- Execution — authorized consequential action, which this capability requests and never performs
- Knowledge — organizational truth, read-only from here

## Promotion criteria

- Prerequisite areas above are mature — in particular isolated execution, feedback capture, and a measured baseline of product behaviour to compare outcomes against.
- The authority firewall is **enforceable, not merely documented** — the constitutional boundary above expressed as something a candidate structurally cannot cross.
- Proposal output defined as **clearly derived** and structurally distinguishable from a Director decision.
- Separation from [19](19-learning-engine.md), [23](23-director-digital-twin.md) and the external-facing Innovation and Problem Intelligence initiatives explicit in the design.
- Relationship to [00 — Capability Lifecycle](00-capability-lifecycle.md) expressed as participation in its stages, never as a parallel path.
- Director approval.
