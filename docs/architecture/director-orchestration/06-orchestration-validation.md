# 06 — Orchestration Validation

## Purpose

Orchestration Validation is where orchestration **checks that the workflow itself is sound** — that the components ran in the right order, information flowed faithfully, feedback loops converged, gates were honored, and the whole is traceable. Where verification ([Phase 7F](../director-verification/README.md)) checks the *content* the components produced, orchestration validation checks the *process* that produced it. It answers: *was this workflow conducted correctly?*

## Architectural role

Orchestration Validation is orchestration's self-check — the assurance that the coordination it performed was valid, distinct from verification's assurance that the reasoning content is sound. It is the orchestration analogue of the validation layers found across the architecture ([plan validation](../director-planning/06-plan-validation.md), [decision validation](../director-decision/06-decision-validation.md)): whole-process invariants that must hold before the workflow's result is trusted.

## Inputs

- The **workflow record** — the progression state, information-flow record, feedback-loop record, and gate-enforcement points.
- The **orchestration principles** the workflow must satisfy.

## Outputs

- A **process-validity verdict** — whether the workflow was conducted correctly.
- Identified **process violations** — an out-of-order run, altered information, a non-converging loop, a skipped gate — surfaced for correction.
- A **complete, auditable trace** of the workflow — confirmation that the whole process can be reconstructed end to end.

## Validation invariants (illustrative)

A sound workflow, at minimum:

- **Ran in order** — components executed in their proper sequence, none skipped ([phase coordination](02-phase-coordination.md)).
- **Flowed information faithfully** — outputs passed intact, markers preserved ([information flow](03-information-flow.md)).
- **Converged** — feedback loops resolved, or non-convergence was surfaced to the Director ([feedback loops](04-feedback-loops.md)).
- **Honored the gates** — no committing action advanced without Director approval ([governance control](05-governance-control.md)).
- **Is fully traceable** — every step recorded and reconstructable.

## Boundaries

- Orchestration Validation **checks the process; it does not check the content** — that is verification's job. It confirms the workflow ran correctly, not that the reasoning was right.
- It **judges soundness; it does not correct or execute** — it reports process violations; correction is a coordination fix, and the workflow's result still awaits the Director.
- It **defines no method** — this document establishes that orchestration validation exists, its role, and the invariants it checks, not any validation algorithm.

## Future direction

Future orchestration engines may validate the workflow more thoroughly — checking richer process invariants, detecting subtler coordination faults. The obligation is fixed: only correctly-conducted, fully-traceable workflows are trusted, and process faults are surfaced, never hidden. Thoroughness grows; the process-integrity discipline holds.
