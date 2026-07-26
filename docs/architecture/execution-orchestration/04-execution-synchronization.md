# 04 — Execution Synchronization

## Purpose

Execution Synchronization is where orchestration **manages the timing and ordering of parallel work** — ensuring that tasks performed by different agents at the same time stay consistent with the plan's dependencies, and that tasks which must wait for others do. Where multiple agents run concurrently, synchronization is what keeps the parallel execution correct: right order preserved, concurrent work coherent, no task racing ahead of a dependency.

## Architectural role

Execution Synchronization enforces the plan's ordering ([Phase 7D dependency management](../director-planning/05-dependency-management.md)) across agents running in parallel. It works with [Agent Coordination](03-agent-coordination.md) (which manages collaboration) to keep concurrent execution consistent. It carries the acyclic-ordering discipline of planning into multi-agent execution: a task performed by one agent that depends on another agent's task waits until that dependency is met.

## Inputs

- The **plan's dependency structure** — which tasks must precede which.
- The **agents' execution state** — what each agent has completed, is running, or is waiting on.
- The **parallel branches** the plan allows — work that may proceed concurrently.

## Outputs

- **Synchronized execution** — parallel work proceeds where the plan allows, and waits where the plan requires.
- **Enforced ordering** — dependent tasks run only after their dependencies complete, across agents.
- A **synchronization record** — the ordering and waits observed, for traceability.

## Boundaries

- Synchronization **orders and times; it does not execute or reorder against the plan**. It enforces the plan's dependencies across agents; it never changes them ([orchestration principles](01-orchestration-principles.md)).
- It **preserves the plan's ordering exactly** — parallelism is allowed only where the plan allows; a dependency is never skipped for speed.
- It **performs no reasoning** — a synchronization conflict the plan did not anticipate is reported or handled by the approved recovery, never resolved by orchestration's own judgment.
- It **defines no method** — this document establishes that execution synchronization exists and its role, not any concurrency mechanism.

## Future direction

Future orchestration engines may synchronize more finely — exploiting more parallelism within the plan's allowances, coordinating larger concurrent agent sets, handling waits more gracefully. The discipline is fixed: preserve the plan's ordering exactly, parallelize only where allowed, perform no work and no reasoning. Fineness grows; the ordering-faithful synchronization holds.
