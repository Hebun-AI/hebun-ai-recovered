# Director Reasoning Mechanisms — Architecture (Phase 7C)

## Purpose

The **Director Reasoning Mechanisms** are the architectural supports that *realize* reasoning — the cognitive tools an engine uses to perform the thinking well. Phase 7A defined **why** the Director reasons; Phase 7B defined **how** the Director thinks (the ordered lifecycle). This phase (7C) defines the **mechanisms that support that thinking** — how reasoning approaches a problem, breaks it down, forms and tests hypotheses, weighs evidence, handles uncertainty, and knows when to stop.

It is **architecture only**. It defines no algorithms, no prompts, no implementation, no runtime behavior. It describes the *kinds of cognitive machinery* every reasoning engine needs, not the machinery itself.

## Relationship with Phase 7A

Phase 7A ([director-reasoning](../director-reasoning/README.md)) is the **philosophy** — why reasoning exists, its first principles, its boundaries, and the Director's authority. The mechanisms in this phase **serve** those principles: evidence evaluation realizes *evidence before conclusion*; uncertainty handling realizes *explicit uncertainty*; every mechanism operates within reasoning's advisory boundary. 7C is 7A made operable at the mechanism level — without crossing into implementation.

## Relationship with Phase 7B

Phase 7B ([director-reasoning-cognition](../director-reasoning-cognition/README.md)) is the **cognitive lifecycle** — the ordered stages reasoning moves through (Observation → … → Recommendation → Director Gate). The mechanisms in this phase are what let each stage be performed well:

- Problem decomposition and reasoning strategies shape *how* Observation, Context, and Goal stages are approached.
- Hypothesis generation and evidence evaluation power Option Generation and Trade-off Analysis.
- Uncertainty and confidence handling runs across every stage and into the Recommendation.
- Reasoning termination governs when a stage is complete and when the whole cycle should stop.

The lifecycle says *what order to think in*; the mechanisms say *what cognitive tools do the thinking* at each step.

## Role inside Director Reasoning

```
Phase 7A — Philosophy        (why reasoning exists, principles)
Phase 7B — Cognition         (the ordered lifecycle of thinking)
Phase 7C — Mechanisms        (the cognitive tools that realize the thinking)  ← this phase
        │  (all still architecture; no implementation)
        ▼
Future — Realization         (how the mechanisms are actually built)
```

Mechanisms sit between the cognitive lifecycle and its eventual implementation. They are the vocabulary of *how reasoning works* — richer than the stage sequence, but still above any code.

## Why mechanisms are separate from cognition

The lifecycle (7B) and the mechanisms (7C) are separated on purpose:

- **The lifecycle is the fixed order; mechanisms are the reusable tools.** The stages do not change; the mechanisms are cross-cutting supports used across many stages. Decomposition serves several stages; uncertainty handling runs through all of them.
- **They evolve independently.** A future engine may sharpen a mechanism (better evidence evaluation) without altering the lifecycle, and vice versa. Keeping them separate lets each improve on its own.
- **It keeps each layer clean.** The lifecycle describes *sequence*; mechanisms describe *capability*; implementation (later) describes *machinery*. Blurring them would muddy all three.

## Documents

| Document | Mechanism |
|---|---|
| [01 — Reasoning Strategies](01-reasoning-strategies.md) | How reasoning approaches a problem |
| [02 — Problem Decomposition](02-problem-decomposition.md) | Breaking a problem into tractable parts |
| [03 — Hypothesis Generation](03-hypothesis-generation.md) | Forming candidate explanations and directions |
| [04 — Evidence Evaluation](04-evidence-evaluation.md) | Weighing evidence for and against |
| [05 — Uncertainty & Confidence](05-uncertainty-confidence.md) | Handling and communicating what is unknown |
| [06 — Reasoning Termination](06-reasoning-termination.md) | Knowing when reasoning is done |
| [07 — Future Evolution](07-future-evolution.md) | How the mechanisms deepen |

Each document defines: **purpose, architectural role, inputs, outputs, boundaries, and future direction.**

## Status

Architecture only — the mechanisms, not their realization. Reasoning engines that implement these mechanisms follow the [Capability Lifecycle](../../architecture-backlog/00-capability-lifecycle.md) behind the Director gate. Nothing here is implemented.
