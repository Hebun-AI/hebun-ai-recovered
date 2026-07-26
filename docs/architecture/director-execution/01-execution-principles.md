# 01 — Execution Principles

## Purpose

The Execution Principles are the constitution of Director Execution — the commitments the execution layer must obey. Execution is the one layer that acts in the world; these principles are what keep that power safe and faithful. Any execution that violates one of these is not doing Director Execution.

## Architectural role

These principles constrain all the execution topics that follow (lifecycle, boundaries, control, monitoring, completion). Every subsequent document inherits them first. They keep execution faithful, bounded, traceable, and subordinate to the Director.

## The principles

### 1. Execute only approved, verified work
Execution runs only work that has been through the full Phase 7 chain — reasoned, planned, decided, verified — and **approved by the Director**. Nothing executes on a plan that was not approved, or that verification did not pass. The approval-and-verification precondition is absolute ([README](README.md)).

### 2. Execute faithfully — the plan, exactly
Execution performs the approved plan as it was approved: the same tasks, the same scope, nothing added, nothing dropped. It does not improve, optimize, or reinterpret the plan while running it. Faithfulness is execution's core duty; deviation is a failure, not initiative.

### 3. Execution performs; it does not decide
Execution holds no reasoning, planning, decision, verification, or governance role. When it encounters something the plan did not anticipate, it does **not** decide what to do — it reports, and defers to the Director or routes back to the reasoning domains ([execution boundaries](03-execution-boundaries.md)). Execution never fills a gap with its own judgment.

### 4. Committing actions respect Director approval
Every committing or irreversible action the plan contains was marked upstream ([planning](../director-planning/README.md)) and approved by the Director. Execution performs such actions only within that approval, and never manufactures a new committing action the Director did not authorize ([Director Authority](../director-reasoning/05-director-authority.md)).

### 5. Execution is fully traceable
Every action execution takes is recorded — what ran, when, with what result. The whole execution can be reconstructed and audited ([execution monitoring](05-execution-monitoring.md)). Traceability is not optional; it is how execution stays accountable for acting in the world.

### 6. Execution is controllable
Execution can be interrupted and cancelled by the Director at any point ([execution control](04-execution-control.md)). It never becomes an unstoppable process. The Director's ability to halt execution is part of the Director's authority over it.

### 7. Execution reports honestly
Execution reports progress, failures, and completion truthfully — it does not hide a failure, overstate progress, or claim a completion that did not happen ([execution monitoring](05-execution-monitoring.md), [completion](06-execution-completion.md)). Honest reporting is what lets the Director trust and steer execution.

### 8. Execution never redesigns the plan
Execution carries out the plan; it never changes it. If the plan proves flawed or infeasible in execution, execution reports the problem — it does not re-plan. Re-planning is the planning domain's job, on a new pass, under the Director's authority.

## Inputs

- The **Director-approved, verified execution plan** — the sole subject of execution.
- The **authority context** — the Director's approval and the marked committing actions.

## Outputs

- A **principled frame** every execution activity operates within — the standard execution is held to.

## Boundaries

- These principles **define no method** — they state what execution must obey, not how it is performed.
- They **describe no runtime, agent, or mechanism** — execution machinery is a later phase behind the Director gate.

## Future direction

Future execution engines may perform work more capably — but they will still obey these principles: approved-and-verified only, faithful, non-deciding, gated, traceable, controllable, honest, never re-planning. Capability grows; the constitution holds.
