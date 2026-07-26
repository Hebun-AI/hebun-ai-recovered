# 04 — Evidence Evaluation

## Purpose

Evidence Evaluation is the mechanism by which reasoning **weighs evidence for and against** — testing hypotheses, grounding understanding, and supporting judgments against what the knowledge layers actually show. It is the counterweight to Hypothesis Generation: where generation proposes, evaluation checks. This mechanism is how reasoning earns the right to a conclusion.

## Architectural role

Evidence Evaluation is the backbone of the Phase 7A principle **evidence before conclusion** ([first principles](../director-reasoning/02-first-principles.md)). It runs through the lifecycle ([Phase 7B](../director-reasoning-cognition/README.md)) — grounding Observation, testing hypotheses in Option Generation, and supplying the factual basis of Trade-off Analysis. Every claim reasoning makes must be traceable to evidence this mechanism weighed. It is also what keeps reasoning **explainable**: because conclusions rest on evaluated evidence, they can always be accounted for.

It is a **verifying mechanism**: it decides what the evidence actually supports, so conclusions are grounded rather than asserted.

## Inputs

- **Hypotheses and claims** to be tested ([hypothesis generation](03-hypothesis-generation.md)).
- **Evidence from the knowledge layers** — the Organizational Model, Relationship Graph, and Organizational Memory, read with their provenance intact.
- The **relevance frame** — which evidence bears on the question, given context.

## Outputs

- **Weighed evidence** — for each claim or hypothesis, what supports it, what contradicts it, and how strong each is, with provenance preserved.
- A **verdict on support** — whether the evidence backs, undermines, or is insufficient for the claim.
- Explicit **evidence gaps** — where the record is silent or thin, named rather than filled by assumption ([explicit uncertainty](../director-reasoning/02-first-principles.md)).

## Boundaries

- Evaluation **weighs; it does not fabricate**. Where evidence is absent, the gap is reported, never invented to complete a picture.
- It **reads, never rewrites** — it consumes memory as evidence and never alters it ([reasoning boundaries](../director-reasoning/03-reasoning-boundaries.md)).
- It **produces no action** and **defines no method** — this document establishes that evidence evaluation exists and its role, not any weighting technique.

## Future direction

Future engines may weigh evidence more discerningly — better judging source reliability, relevance, and the strength of support, and detecting subtler contradictions. The mechanism's discipline is fixed: conclusions follow evidence, gaps are named, and nothing is fabricated. Discernment grows; the honesty holds.
