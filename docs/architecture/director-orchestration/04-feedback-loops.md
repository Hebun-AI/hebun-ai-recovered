# 04 — Feedback Loops

## Purpose

Feedback Loops are where orchestration **returns the workflow to an earlier component when verification identifies an issue**. Director Intelligence is not a strict one-way pipeline: when verification ([Phase 7F](../director-verification/README.md)) finds a contradiction, a gap, or a misalignment, the flawed outcome must not be pushed forward — it must go *back* to the component responsible, be corrected, and re-flow. Feedback loops are the mechanism of that return.

## Architectural role

Feedback Loops make the workflow **corrective rather than merely sequential**. Where [Phase Coordination](02-phase-coordination.md) defines forward progression, feedback loops define principled backward routing. Orchestration determines *which* component owns a given verification finding — a flawed plan goes back to planning, a biased decision to decision, an unsupported conclusion to reasoning — and routes the correction there, then re-runs the affected downstream components. It coordinates the loop; it never performs the correction.

## Inputs

- **Verification findings** — the contradictions, gaps, or misalignments identified ([Phase 7F](../director-verification/README.md)).
- The **mapping of findings to responsible components** — which layer owns each kind of flaw.

## Outputs

- **Routed feedback** — each finding sent back to the component responsible for correcting it.
- A **re-entry point** — where the workflow resumes after correction, re-running the affected components in order.
- A **loop record** — every feedback loop taken, for traceability and to detect non-convergence.

## Boundaries

- Feedback routes **backward to the responsible component; orchestration does not correct**. It directs the correction; the responsible layer performs it ([orchestration principles](01-orchestration-principles.md)).
- It **re-runs, it does not shortcut** — after correction, the affected downstream components (including verification) run again; a corrected outcome is not waved through unverified.
- It **respects termination** — endless loops are a failure; orchestration surfaces non-convergence (a flaw that resists correction) to the Director rather than churning ([orchestration validation](06-orchestration-validation.md), and echoing reasoning termination in [Phase 7C](../director-reasoning-mechanisms/06-reasoning-termination.md)).
- It **produces no action** and **defines no method** — this document establishes that feedback loops exist and their role, not any routing algorithm.

## Future direction

Future orchestration engines may route feedback more precisely — pinpointing the responsible component more finely, re-running only what is truly affected, detecting non-convergence earlier. The discipline is fixed: findings go back to the responsible component, corrections are re-verified, and unresolvable flaws surface to the Director. Precision grows; the correct-and-re-verify discipline holds.
