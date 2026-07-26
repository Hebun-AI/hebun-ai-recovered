# 03 — Hypothesis Generation

## Purpose

Hypothesis Generation is the mechanism by which reasoning **forms candidate explanations and directions** to be tested. Before reasoning can evaluate, it must have something to evaluate — a proposed explanation of *why* something is happening, or a proposed *direction* worth exploring. Hypotheses are reasoning's tentative "what if"s, put forward to be checked against evidence, not asserted as conclusions.

## Architectural role

Hypothesis Generation feeds the analytical stages of the lifecycle ([Phase 7B](../director-reasoning-cognition/README.md)). It powers **Option Generation** — candidate courses of action are hypotheses about what would work — and it underpins diagnostic reasoning, where candidate explanations must be generated before they can be tested. It pairs directly with [Evidence Evaluation](04-evidence-evaluation.md): generation proposes, evaluation tests. Together they realize the Phase 7A principle **evidence before conclusion** ([first principles](../director-reasoning/02-first-principles.md)) — a hypothesis is never a conclusion until evidence supports it.

It is a **divergent mechanism**: it widens the field of possibilities so nothing plausible is missed before the narrowing begins.

## Inputs

- The **contextualized understanding** and **goal** — the ground the hypotheses must be about.
- **Constraints**, so hypotheses stay within the space of the possible ([constraint analysis](../director-reasoning-cognition/04-constraint-analysis.md)).
- **Memory** — prior explanations and directions that worked or failed, as a source and a check.

## Outputs

- A **set of candidate hypotheses** — proposed explanations or directions, each stated as tentative and testable.
- For each, an explicit marker that it is **unverified** — a hypothesis awaiting evidence, never a finding.

## Boundaries

- Hypotheses are **not conclusions** — generating one asserts nothing. Treating an untested hypothesis as fact violates evidence before conclusion.
- It **produces no action** — proposing possibilities is reasoning, fully advisory.
- It **defines no method** — this document establishes that hypothesis generation exists and its role, not any technique for producing hypotheses.

## Future direction

Future engines may generate richer, more creative, better-targeted hypotheses — and prune obviously weak ones earlier. The mechanism's discipline is fixed: hypotheses are tentative until evidence speaks, and generation always precedes, never replaces, evaluation. Creativity grows; the evidence discipline holds.
