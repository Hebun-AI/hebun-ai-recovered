# 06 — Orchestration Monitoring

## Purpose

Orchestration Monitoring is where the multi-agent execution **makes itself visible as a whole** — aggregating progress, failures, and traces across all agents into one coherent view. Where Phase 8A monitoring ([execution monitoring](../director-execution/05-execution-monitoring.md)) watches a single execution, orchestration monitoring watches *all the agents together*, so the Director sees one execution, not many disconnected ones.

## Architectural role

Orchestration Monitoring is the visibility layer over the whole coordinated execution. It consolidates each agent's progress and failures into a unified account, feeds [Failure Recovery](05-failure-recovery.md) (which acts on the failures it surfaces), enables the Director's control across all agents ([Phase 8A control](../director-execution/04-execution-control.md)), and maintains the complete multi-agent trace. Its records feed organizational memory ([Phase 6](../memory/README.md)) — the durable account of how the coordinated execution went.

## What it reports

### Aggregate progress
The state of the whole execution across all agents — which tasks are done, running, or waiting, and where the coordinated execution stands against the plan. One picture, not one-per-agent.

### Failures across agents
Failures from any agent, surfaced promptly and honestly, attributed to the agent and task, so recovery can act and the Director can see. No agent's failure is hidden or lost in the aggregate.

### Complete traceability
The full record of the multi-agent run — every distribution, coordination, synchronization, failure, and recovery, across all agents — reconstructable and auditable end to end.

## Inputs

- **Per-agent execution events** — progress, completions, failures, from every agent.
- The **coordination, distribution, and synchronization records** — the orchestration's own actions.

## Outputs

- **Aggregate progress reports** — the unified state of the coordinated execution.
- **Failure reports** — problems from any agent, surfaced with context.
- A **complete multi-agent trace** — the auditable record of the whole run.

## Boundaries

- Monitoring **observes and reports; it does not act, execute, or decide**. It surfaces failures; recovery and the Director respond ([orchestration principles](01-orchestration-principles.md)).
- It **reports honestly** — no hidden agent failures, no overstated aggregate progress, no fabricated completion.
- It **defines no method** — this document establishes that orchestration monitoring exists and its role, not any telemetry mechanism.

## Future direction

Future orchestration engines may monitor the multi-agent execution more richly — finer aggregate views, earlier cross-agent failure detection, deeper traces feeding learning. The discipline is fixed: honest, complete, unified observe-and-report visibility that never acts or decides. Richness grows; the honest, observe-only stance holds.
