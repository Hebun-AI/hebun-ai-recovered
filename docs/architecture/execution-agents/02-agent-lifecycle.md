# 02 — Agent Lifecycle

## Purpose

The Agent Lifecycle is the **ordered progression of an agent performing assigned work** — from receiving an assignment to reporting its completion. It is the per-agent analogue of the execution lifecycle ([Phase 8A](../director-execution/02-execution-lifecycle.md)): where that ordered a whole plan's execution, this orders a single agent's handling of the task(s) assigned to it.

## Architectural role

The Agent Lifecycle defines *how an agent proceeds* while [Agent Communication](05-agent-communication.md) and [Agent Reporting](06-agent-reporting.md) operate across it. Each agent runs this lifecycle for its assignment, within the larger coordinated execution orchestration directs ([Phase 8B](../execution-orchestration/README.md)). The agent performs the lifecycle; it does not design the work (the plan did) or coordinate its place in the whole (orchestration does).

## The lifecycle

```
Assignment       — receive assigned, approved task(s) from orchestration
   ↓
Acceptance       — confirm the task is approved and within the agent's capability
   ↓
Execution        — perform the assigned task faithfully, honoring committing-action gates
   ↓
Reporting        — report progress throughout; report the outcome at the end
```

Throughout, the agent can be interrupted, cancelled, or reassigned by orchestration and the Director ([agent responsibilities](03-agent-responsibilities.md)), and it communicates status continuously.

## Stage meanings

- **Assignment.** The agent receives task(s) from orchestration, drawn from the Director-approved plan. It performs only what it is assigned.
- **Acceptance.** The agent confirms the task is approved and within its capability; it does not accept unapproved work or work it cannot faithfully perform, reporting instead ([agent boundaries](04-agent-boundaries.md)).
- **Execution.** The agent performs the task faithfully — exactly as assigned, honoring any committing-action gate within the Director's approval.
- **Reporting.** The agent reports progress during execution and the outcome (completed, failed, partial, cancelled) at the end ([agent reporting](06-agent-reporting.md)).

## Inputs

- The **assigned, approved task(s)** and their **committing-action markers**.
- **Orchestration signals** — coordination, interruption, cancellation, reassignment.

## Outputs

- **Performed work** — the assigned task carried out faithfully, within approval.
- **Status and progress** — communicated throughout the lifecycle.
- The **outcome report** — the agent's result, handed back to orchestration.

## Boundaries

- The lifecycle **performs the assigned task; it does not redesign it or take on more** ([agent principles](01-agent-principles.md)).
- It **is interruptible throughout** — no stage is beyond orchestration's coordination or the Director's control.
- It **honors the gates** — no committing action runs outside the Director's approval.
- It **defines no method** and **no concrete agent** — this document establishes that the agent lifecycle exists and its stages, not any runtime mechanism or specific agent.

## Future direction

Future agents may run the lifecycle more capably — accepting richer assignments, performing more complex tasks, reporting more finely. The order is fixed: receive assigned-and-approved work, accept only what fits, execute faithfully, report honestly. Capability grows; the faithful, gated, interruptible progression holds.
