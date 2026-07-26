# 06 — Decision Validation

## Purpose

Decision Validation is where decision **checks that a decision-ready outcome is sound before it is offered to the Director**. An outcome that rests on an unfair evaluation, an off-goal ranking, an unbalanced risk read, or a governance violation must never be presented as decision-ready. Validation is the gate between a draft outcome and one the Director can be asked to approve.

## Architectural role

Decision Validation is the final decision topic before the outcome leaves the layer. It examines the whole outcome — the [evaluation](02-option-evaluation.md), [prioritization](03-prioritization.md), [risk balancing](04-risk-balancing.md), and [governance alignment](05-governance-alignment.md) — against the [Decision Principles](01-decision-principles.md), and certifies it sound or rejects it. It is the decision analogue of plan validation ([Phase 7D](../director-planning/06-plan-validation.md)) and graph validation ([Phase 5B](../graph-validation/README.md)): whole-outcome invariants that must hold before the outcome is trusted. The Director is offered only validated decision outcomes.

## Inputs

- The **complete draft outcome** — the recommended plan, its evaluation, ranking, risk balance, and governance verdict.
- The **decision principles** and the **approved goal**, to confirm the outcome still serves what was intended.

## Outputs

- A **validity verdict** — sound or not, as a whole.
- Where invalid, the **specific violations** — a biased evaluation, an off-goal ranking, hidden risk, a governance breach — surfaced for correction.
- A **validated, decision-ready outcome** when sound — the form offered to the Director for approval.

## Validation invariants (illustrative)

A sound decision outcome, at minimum:

- **Rests on objective evaluation** — no alternative pre-favored, trade-offs explicit.
- **Ranks by organizational objectives** — not a local metric.
- **Balances opportunity and risk honestly** — both visible, irreversible risk weighted.
- **Is governance-aligned** — no policy, permission, or obligation violated; committing actions marked.
- **Is explainable** — the outcome and its reasoning can be accounted for end-to-end.
- **Preserves Director Authority** — it is decision-ready, not decided; nothing is pre-committed.

## Boundaries

- Validation **judges soundness; it does not decide or execute**. It certifies an outcome as ready for the Director; the Director decides, execution is a later phase.
- It **never certifies an unsound outcome** — offering a flawed outcome would ask the Director to approve a bad decision.
- It **defines no method** — this document establishes that decision validation exists, its role, and the kind of invariants it checks, not any validation algorithm.

## Future direction

Future decision engines may validate outcomes more thoroughly — checking richer invariants, catching subtler bias or misalignment. The obligation is fixed: only sound, objective, governance-aligned, explainable outcomes reach the Director, authority intact. Thoroughness grows; the "only validated outcomes are offered" rule holds.
