# 02 — Work Distribution

## Purpose

Work Distribution is where orchestration **assigns the approved plan's tasks to execution agents** — matching each task to an agent suited to perform it, so the plan is carried out across the available agents rather than by one. It is the first coordination act: turning a single approved plan into work parcelled out to many performers.

## Architectural role

Work Distribution takes the approved plan's task graph ([Phase 7D](../director-planning/03-task-graph.md)) and maps its tasks onto agents, feeding [Agent Coordination](03-agent-coordination.md) and [Execution Synchronization](04-execution-synchronization.md). It distributes *the plan's* work, unchanged — it decides *which agent* performs a task, never *whether* or *what* the task is. It respects the plan's structure absolutely.

## Inputs

- The **approved plan's tasks** — the work to distribute, with committing-action markers.
- The **available agents** and their **capabilities** — what each agent can perform (agents defined in a later phase).
- The **plan's dependencies and constraints** — which shape valid distribution.

## Outputs

- **Task assignments** — each approved task assigned to an agent capable of performing it.
- **Preserved markers** — committing-action and dependency markers carried to each assignment intact.
- A **distribution record** — which task went to which agent, for traceability.

## Boundaries

- Distribution assigns **the plan's tasks; it adds or changes none**. It never invents work, splits scope beyond the plan, or hands an agent something unapproved ([orchestration principles](01-orchestration-principles.md)).
- It **assigns; it does not execute or decide the work** — it chooses the performer, not the outcome. The agent performs; distribution only routes.
- It **respects capability and approval** — a task goes only to an agent able to perform it, and only if the task is approved.
- It **defines no method** and **no specific agents** — this document establishes that work distribution exists and its role, not any assignment algorithm or agent definition.

## Future direction

Future orchestration engines may distribute work more cleverly — matching tasks to agents more precisely, balancing load, adapting to agent availability. The discipline is fixed: distribute only the approved plan's tasks, to capable agents, markers intact, changing nothing. Cleverness grows; the faithful-to-the-plan distribution holds.
