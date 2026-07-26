# 03 — Consistency Validation

## Purpose

Consistency Validation is where verification **checks that the outputs of all prior phases cohere** — that the reasoning, the plan, and the decision agree with one another and with the approved goal. Each phase checked its own output; consistency validation checks the *seams between them*, where a contradiction can hide invisibly to any single layer. It answers: *does the whole chain tell one coherent story?*

## Architectural role

Consistency Validation is verification's distinctive contribution — the check no producing layer can perform on itself, because each sees only its own part. It looks across Reasoning ([7A–7C](../director-reasoning/README.md)), Planning ([7D](../director-planning/README.md)), and Decision ([7E](../director-decision/README.md)) for alignment. It is the multi-phase analogue of the internal consistency audits used across the architecture ([e.g. Phase 5B review](../review/02-consistency-audit.md)): the parts must describe one model, not several overlapping ones.

## Inputs

- The **approved goal** — the anchor everything must serve.
- The **reasoning output** (recommendation and its evidence), the **plan** (tasks, dependencies, resources), and the **decision outcome** (evaluation, ranking, governance verdict).

## Outputs

- A **consistency verdict** — whether the chain coheres.
- Identified **cross-phase contradictions** — where the plan diverges from the reasoning, the decision from the evidence, or any part from the approved goal.
- Confirmation of **goal fidelity** — that the plan and decision still serve the goal reasoning was approved to pursue, with no drift or unapproved scope.

## Consistency checks (illustrative)

The chain is consistent when, at minimum:

- **The plan realizes the reasoning** — every task traces to the approved recommendation; the plan adds no goal reasoning did not conclude.
- **The decision reflects the evaluation** — the chosen outcome matches what the option evaluation and prioritization actually support.
- **Constraints are honored throughout** — the constraints reasoning identified are respected by the plan and the decision.
- **The whole serves the goal** — no phase has drifted from the approved objective.

## Boundaries

- Consistency Validation **checks coherence; it does not reconcile by rewriting**. Where it finds a contradiction, it reports it; the producing layer resolves it, under the Director's authority ([verification principles](01-verification-principles.md)).
- It **reads all phases; it modifies none** — it is read-only over the entire chain.
- It **produces no action** and **defines no method** — this document establishes that consistency validation exists, its role, and the kind of checks it makes, not any algorithm.

## Future direction

Future verification engines may check consistency more thoroughly — detecting subtler cross-phase contradictions and finer goal drift. The obligation is fixed: the chain must cohere as one story serving the approved goal, and contradictions are reported, never silently reconciled. Thoroughness grows; the read-only, whole-checking discipline holds.
