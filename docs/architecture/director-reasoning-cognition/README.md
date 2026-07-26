# Director Cognitive Model — Architecture (Phase 7B)

## Purpose

The **Director Cognitive Model** defines *how* Director Reasoning thinks. Phase 7A established *why* reasoning exists and the principles it obeys. This phase (7B) defines the **cognitive lifecycle** — the ordered stages every future reasoning engine must move through to turn organizational knowledge into a Director-ready recommendation.

It is **architecture only**. It defines no algorithms, no prompts, no implementation, no runtime. It describes the *shape of thinking*, not the machinery that performs it. Every future reasoning engine, however built, must follow this lifecycle.

## The reasoning lifecycle

```
Observation
   ↓
Understanding          (the output of Observation)
   ↓
Context Building
   ↓
Goal Identification
   ↓
Constraint Analysis
   ↓
Option Generation
   ↓
Trade-off Analysis
   ↓
Recommendation
   ↓
Director Approval      (the gate — execution is beyond this phase)
```

Reasoning proceeds down this path. Each stage consumes the outputs of the stage before it and produces the inputs for the stage after. The lifecycle ends at the Director Gate — the recommendation is presented, the Director decides, and **execution is outside this phase** entirely.

## Documents

| Document | Stage |
|---|---|
| [01 — Observation](01-observation.md) | Observation → Understanding |
| [02 — Context Building](02-context-building.md) | Context Building |
| [03 — Goal Identification](03-goal-identification.md) | Goal Identification |
| [04 — Constraint Analysis](04-constraint-analysis.md) | Constraint Analysis |
| [05 — Option Generation](05-option-generation.md) | Option Generation |
| [06 — Trade-off Analysis](06-tradeoff-analysis.md) | Trade-off Analysis |
| [07 — Recommendation](07-recommendation.md) | Recommendation |
| [08 — Director Gate](08-director-gate.md) | Director Approval |
| [09 — Future Evolution](09-future-evolution.md) | How the model evolves |

Each stage document defines: **what the stage means, why it exists, required inputs, expected outputs, and transition criteria** (when reasoning may move to the next stage).

## How to read the model

- **The stages are ordered and dependent.** Reasoning does not skip stages; each rests on the one before. A recommendation with no goal, or options with no constraints, is malformed reasoning.
- **The stages are principled.** Every stage serves the Phase 7A [first principles](../director-reasoning/02-first-principles.md) — evidence before conclusion, context before action, explicit uncertainty, explainability. The lifecycle is how those principles become a repeatable discipline.
- **The stages are advisory throughout.** Nothing in the lifecycle acts. It produces understanding and recommendation; the Director decides ([Director Authority](../director-reasoning/05-director-authority.md)).

## Status

Architecture only — the cognitive model, not its implementation. Reasoning engines, contracts, and runtime — should they be built — follow the [Capability Lifecycle](../../architecture-backlog/00-capability-lifecycle.md) behind the Director gate. Nothing here is implemented.
