# 01 — Orchestration Principles

## Purpose

The Orchestration Principles are the constitution of Execution Orchestration — the commitments the multi-agent coordination layer must obey. Where the execution principles ([Phase 8A](../director-execution/01-execution-principles.md)) govern *performing* work, these govern *coordinating multiple performers* of it. Any execution orchestration that violates one of these is not doing Execution Orchestration.

## Architectural role

These principles constrain all the orchestration topics that follow (work distribution, agent coordination, synchronization, failure recovery, monitoring). Every subsequent document inherits them first. They keep orchestration a faithful coordinator of approved execution — directing agents without ever executing, deciding, or exceeding approval.

## The principles

### 1. Orchestration coordinates; it never executes
Execution Orchestration distributes and sequences work performed by the agents; it never performs a task itself. The moment orchestration executed work, it would stop being a coordinator and become an executor with authority over the others ([README](README.md)).

### 2. Only approved work is distributed
Orchestration distributes only the tasks of a Director-approved, verified plan ([Phase 8A](../director-execution/README.md)). It never hands an agent work the plan did not contain or the Director did not approve. The approval precondition carries through distribution intact.

### 3. Execution ordering is preserved
The plan's dependencies are honored across agents — a task that must follow another does, even when different agents perform them ([execution synchronization](04-execution-synchronization.md)). Distributing work across agents never reorders it against the plan.

### 4. The plan is never redesigned
Orchestration carries out the approved plan's structure; it never changes it. It does not add, drop, reorder, or reinterpret tasks. If the plan proves flawed in execution, orchestration reports it (via [monitoring](06-orchestration-monitoring.md)) — re-planning happens upstream, under the Director's authority.

### 5. Orchestration performs no reasoning or decision
Orchestration forms no judgment. When coordination faces something the plan did not anticipate, it does not reason or decide what to do — it applies the approved recovery strategy or reports ([failure recovery](05-failure-recovery.md)). Reasoning, planning, and decision remain the [Phase 7 domains'](../director-review/README.md) jobs.

### 6. Committing actions respect Director approval
Every committing action an agent performs was marked upstream and approved by the Director. Orchestration distributes such actions only within that approval and never creates a new committing action the Director did not authorize ([Director Authority](../director-reasoning/05-director-authority.md)).

### 7. The whole multi-agent execution is traceable
Every distribution, coordination, synchronization, failure, and recovery is recorded — the complete multi-agent run can be reconstructed and audited ([orchestration monitoring](06-orchestration-monitoring.md)). Traceability spans all agents, not just one.

### 8. Orchestration is controllable
The Director's ability to interrupt and cancel execution ([Phase 8A control](../director-execution/04-execution-control.md)) extends across all agents through orchestration — a cancellation halts the whole coordinated execution, cleanly. Orchestration never becomes an unstoppable multi-agent process.

## Inputs

- The **Director-approved, verified plan** — the sole subject of coordination.
- The **available execution agents** and their capabilities (agents themselves defined in a later phase).

## Outputs

- A **principled frame** every orchestration activity operates within — the standard the coordination is held to.

## Boundaries

- These principles **define no method** — they state what orchestration must obey, not how coordination is performed.
- They **describe no runtime, agent, or mechanism** — coordination machinery and agent design are later phases behind the Director gate.

## Future direction

Future execution-orchestration engines may coordinate more capably — distributing more cleverly, synchronizing more finely, recovering more gracefully. The principles are fixed: coordinate not execute, distribute only approved work, preserve ordering, never redesign, no reasoning, gated committing actions, traceable, controllable. Capability grows; the constitution holds.
