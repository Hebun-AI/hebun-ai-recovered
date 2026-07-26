# 06 — Reasoning Termination

## Purpose

Reasoning Termination is the mechanism by which reasoning **knows when to stop**. Thinking could always continue — another hypothesis, more evidence, a finer trade-off — but at some point further reasoning stops improving the judgment and only delays it. This mechanism governs *when a stage is complete* and *when the whole reasoning cycle should conclude*, so reasoning is neither cut short nor endlessly spun out.

## Architectural role

Termination is what makes the lifecycle's **transition criteria** operative ([Phase 7B](../director-reasoning-cognition/README.md)). Each stage has criteria for advancing; termination is the mechanism that judges whether they are met — enough observation, enough options, enough evaluation — and when to move on. At the cycle level, it recognizes when reasoning has reached a sound, explainable recommendation and should proceed to the Director Gate rather than continue. It also handles the honest case where **further reasoning cannot resolve the uncertainty** — declaring the limit reached and presenting the best judgment with its doubt, rather than churning.

It is a **stopping mechanism**: it balances thoroughness against timeliness and prevents both premature and endless reasoning.

## Inputs

- The **stage transition criteria** and whether they are satisfied.
- The **confidence and uncertainty** state ([uncertainty & confidence](05-uncertainty-confidence.md)) — whether more reasoning would materially improve it.
- The **cost of delay** relative to the value of further refinement — timeliness matters to a Director.

## Outputs

- A **stage-completion judgment** — whether reasoning may advance to the next stage.
- A **cycle-termination judgment** — whether reasoning has reached a Director-ready recommendation, or has hit the limit of what it can resolve.
- Where terminated on a limit, an explicit note that **the judgment is as good as reasoning can make it given the uncertainty** — honesty over false thoroughness.

## Boundaries

- Termination **never forces a false conclusion** — stopping does not mean inventing certainty. A cycle may terminate with an honestly uncertain recommendation.
- It **never rushes past the criteria** — stopping a stage before its criteria are met is premature, not efficient.
- It **produces no action** and **defines no method** — this document establishes that termination exists and its role, not any stopping rule.

## Future direction

Future engines may judge stopping points more astutely — recognizing sooner when reasoning has converged and when it has stalled. The mechanism's balance is fixed: thorough enough to be sound, timely enough to be useful, honest when the limit is reached. Judgment grows; the balance holds.
