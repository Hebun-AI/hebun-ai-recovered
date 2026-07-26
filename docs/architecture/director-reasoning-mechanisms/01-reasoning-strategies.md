# 01 — Reasoning Strategies

## Purpose

Reasoning Strategies are the **approaches** a reasoning engine takes to a problem — the choice of *how to think about this*, before thinking begins in earnest. Not every situation is reasoned the same way: a diagnostic question, an open-ended opportunity, and a constrained decision each call for a different posture. This mechanism is the selection and application of the right approach for the situation at hand.

## Architectural role

Reasoning Strategies sit at the front of the mechanism set — they shape *how* the cognitive lifecycle ([Phase 7B](../director-reasoning-cognition/README.md)) is traversed for a given problem. The lifecycle order is fixed, but the *character* of each stage adapts to the strategy: an exploratory problem dwells longer in Option Generation; a diagnostic problem invests heavily in Observation and Evidence Evaluation. Strategy is the meta-choice that tunes the reasoning to the task.

It is a **selection mechanism**, not a stage. It informs every other mechanism — which to lean on, how hard — for this particular problem.

## Inputs

- The **contextualized understanding** of the situation (from the lifecycle's early stages) — what kind of problem this is.
- The **goal** the reasoning serves, once identified.
- Relevant **precedent** from memory — how similar problems were approached before.

## Outputs

- A **chosen approach** for the problem — the reasoning posture and which mechanisms to emphasize.
- An explicit note of **why this approach fits** the situation, so the reasoning stays explainable ([first principles](../director-reasoning/02-first-principles.md)).

## Boundaries

- Reasoning Strategies **do not change the lifecycle order** — they tune how stages are performed, never skip or reorder them.
- They **produce no action** — selecting an approach is still reasoning, fully advisory.
- They **define no algorithm** — this document names that strategy selection exists and what it is for, not any method for choosing.

## Future direction

Future engines may draw on a richer repertoire of strategies and select among them more astutely — learning from memory which approaches served which problem types well. The mechanism's role is fixed (choose how to approach the problem); its sophistication grows. The lifecycle and the advisory boundary hold regardless.
