# 06 — Execution Completion

## Purpose

Execution Completion is where execution **concludes and reports its outcome** — the terminal stage that closes a run and hands back an honest account of what happened. Execution does not simply stop; it *completes*, producing a clear report of whether the approved plan was carried out, in full, in part, or halted, and with what result. Completion is how a run of the acting layer is properly closed and made accountable.

## Architectural role

Execution Completion is the terminus of the [Execution Lifecycle](02-execution-lifecycle.md), consolidating the [monitoring](05-execution-monitoring.md) record and any [control](04-execution-control.md) actions into a final outcome. It is the execution analogue of the readiness verdict that closed reasoning ([Phase 7F](../director-verification/06-final-readiness.md)): a definitive, honest report that closes the loop back to the Director. Its report becomes an input to organizational memory ([Phase 6](../memory/README.md)), recording what was executed for future reasoning to learn from.

## Completion outcomes

Execution can conclude in several honest ways:

- **Completed** — the approved plan was carried out in full, as approved.
- **Partially completed** — some tasks completed before execution stopped (by failure, interruption, or cancellation), with the partial state reported.
- **Failed** — execution could not carry out the plan, with the failure and its point reported.
- **Cancelled** — the Director stopped execution before completion, with the state at cancellation reported.

Each outcome is reported plainly; none is dressed up as another. A partial or failed run is reported as such, never as success.

## Inputs

- The **final execution state** — what completed, what did not.
- The **monitoring trace** and any **control actions** taken during the run.

## Outputs

- A **completion report** — the outcome (completed / partial / failed / cancelled), what was done, and what was not.
- The **final state** of the executed work — the result handed back to the Director.
- A **memory-ready record** of the run — the durable account, for organizational memory and learning.

## Boundaries

- Completion **reports; it does not decide what happens next**. It states the outcome; deciding on a follow-up — re-plan, retry, accept — is the Director's, and the reasoning domains', not execution's ([execution boundaries](03-execution-boundaries.md)).
- It **reports honestly** — the true outcome, no overstated success, no hidden failure ([execution principles](01-execution-principles.md)).
- It **closes the run; it does not re-open the plan** — a follow-up is a new pass through the reasoning and execution chain, under the Director's authority.
- It **defines no method** — this document establishes that execution completion exists and its role, not any runtime mechanism.

## Future direction

Future execution engines may report completion more richly — finer outcome detail, clearer partial-state accounting, deeper memory records that sharpen future reasoning and learning. The discipline is fixed: honest outcome reporting that closes the loop to the Director and decides nothing about what comes next. Richness grows; the honest, decide-nothing completion holds.
