# 04 — Risk Verification

## Purpose

Risk Verification is where verification **independently re-checks the risk picture** the chain produced — confirming that risks were honestly identified, fairly weighed, and not understated on the way to a decision. The decision layer balanced risk ([Phase 7E](../director-decision/04-risk-balancing.md)); risk verification asks, from outside that layer, whether the balance holds up: were risks missed, downplayed, or wrongly judged recoverable?

## Architectural role

Risk Verification is self-critique ([02](02-self-critique.md)) applied to the risk dimension specifically. It re-examines the decision's risk balancing with fresh eyes, checks it against the organization's actual exposure through the graph ([impact analysis](../relationship-graph/05-impact-analysis.md)) and its remembered outcomes ([Phase 6](../memory/README.md)), and feeds [Decision Assurance](05-decision-assurance.md) and [Final Readiness](06-final-readiness.md). Its independence matters most here: the layer that chose a plan is the one most tempted to underweight its risks.

## Inputs

- The **decision's risk balancing** — the identified risks, their weighing, and the recoverability read.
- The **impact context** — how the chosen plan's risks propagate through the organization.
- **Memory** of how comparable risks actually played out — a check against optimistic estimates.

## Outputs

- A **risk-verification verdict** — whether the chain's risk picture is honest and complete.
- Identified **missed or understated risks** — exposures the chain did not surface or weighed too lightly.
- Confirmation (or challenge) of the **recoverability** claims — whether "reversible" risks truly are.

## Boundaries

- Risk Verification **re-checks; it does not re-decide or mitigate**. It reports whether the risk picture holds; adjusting the decision is the decision layer's job, and acting on risk is execution, under the Director's authority.
- It **does not manufacture risk** — it surfaces real understatement honestly, without inflating risk to block a sound plan ([verification principles](01-verification-principles.md)).
- It **produces no action** and **defines no method** — this document establishes that risk verification exists and its role, not any risk model.

## Future direction

Future verification engines may verify risk more penetratingly — catching subtler missed exposures, checking recoverability more rigorously against memory. The discipline is fixed: independently confirm the risk picture is honest and complete, without inflating or acting. Penetration grows; the honest, non-acting stance holds.
