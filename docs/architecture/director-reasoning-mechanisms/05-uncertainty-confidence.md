# 05 — Uncertainty & Confidence

## Purpose

Uncertainty & Confidence is the mechanism by which reasoning **tracks what it does not know and communicates how sure it is**. Every judgment carries doubt; this mechanism is how reasoning holds that doubt honestly — neither hiding it to look decisive nor overstating it to avoid a call — and conveys it to the Director so recommendations can be properly weighed.

## Architectural role

This mechanism realizes the Phase 7A principle **explicit uncertainty** ([first principles](../director-reasoning/02-first-principles.md)) and the [decision principle](../director-reasoning/04-decision-principles.md) of confidence communication. Unlike the stage-bound mechanisms, it runs **across the entire lifecycle** ([Phase 7B](../director-reasoning-cognition/README.md)): uncertainty is tracked from Observation (what is unknown) through Evidence Evaluation (how strong the support) to the Recommendation (how confident the judgment). It is a continuous thread, not a step. Its final expression — the confidence and stated uncertainties on the recommendation — is what lets the Director calibrate how much weight to place on reasoning's advice.

It is a **calibration mechanism**: it keeps reasoning's confidence honest and legible throughout.

## Inputs

- **Evidence gaps and strengths** from Evidence Evaluation.
- **Unknowns** surfaced at each stage — from Observation onward.
- The **material sensitivities** — where a small change in a shaky assumption would change the judgment.

## Outputs

- A **running account of uncertainty** — what is unknown, how much it matters, carried through the lifecycle.
- A **calibrated confidence signal** on the final recommendation — honest, proportionate to the evidence, with the key uncertainties named.
- Explicit flags where **uncertainty is high enough to affect the decision**, so the Director sees the risk of acting on incomplete knowledge.

## Boundaries

- Confidence is **honest, never performed** — reasoning does not project certainty it lacks, nor manufacture doubt to dodge a recommendation.
- It **produces no action** — reporting uncertainty is reasoning, fully advisory.
- It **defines no method** — this document establishes that uncertainty tracking and confidence communication exist and their role, not any scoring scheme.

## Future direction

Future engines may calibrate confidence more precisely — better distinguishing firm from shaky ground and communicating it more usefully. The mechanism's obligation is fixed: state what is unknown, keep confidence honest, and let the Director weigh accordingly. Precision grows; the honesty is non-negotiable.
