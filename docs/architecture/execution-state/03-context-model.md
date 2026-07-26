# 03 — Context Model

## Purpose

The Context Model defines **the frame an execution carries** — the surrounding information that gives an execution's state meaning and keeps it correct. Where state is *where an execution stands*, context is *what surrounds it*: which task, which scope, whose approval, what history, how it correlates, and how it stays isolated. Context is what makes a resumed or recovered execution not just *continuable* but *correct*.

## Architectural role

The Context Model is the companion to the [State Lifecycle](02-state-lifecycle.md): state carries the execution's position, context carries its frame. Context travels with the execution through every layer — agents carry it to perform faithfully ([Phase 8C](../execution-agents/README.md)), tools carry it (including approval) to operate within the right frame ([Phase 8D](../tool-execution/04-tool-invocation.md)). It defines *what context is*, not how it is stored or moved.

## The context dimensions

### Task context
*What work this execution is performing* — the task(s) from the approved plan the execution is carrying out. Task context anchors the execution to what it is for.

### Execution scope
*The bounds within which this execution operates* — its workspace, its assigned portion of the plan, the resources it may touch. Scope keeps the execution within its bounds and inherits the hard workspace boundary ([Phase 5](../graph-validation/05-workspace-boundaries.md)).

### Approval context
*The Director's authorization this execution runs under* — the approval, and the marked committing actions within it. Approval context is carried faithfully and never overridden ([state principles](01-state-principles.md), [Director Authority](../director-reasoning/05-director-authority.md)). It is what keeps a running, paused, or recovered execution within what the Director approved.

### Execution history
*What this execution has already done* — the record of completed work, outcomes, and transitions, carried as context so a resumed or recovered execution knows where it has been ([traceability & context](06-traceability-context.md)).

### Correlation
*How the parts of one execution connect* — the thread that ties an execution's agents, tools, tasks, and states together as one coherent whole. Correlation is what lets a distributed, multi-agent execution be understood as a single execution.

### Isolation
*How this execution stays separate from others* — the boundary that keeps independent executions from bleeding into one another. Correlation connects the parts of *one* execution; isolation keeps *different* executions apart. Isolation is absolute across the workspace boundary.

## Inputs

- The **approved plan and its assignment** — task and scope.
- The **Director's approval** — approval context.
- The **execution's unfolding record** — history, and the identifiers that establish correlation and isolation.

## Outputs

- A **coherent execution context** — the full frame the execution carries.
- **Preserved context** — the frame intact across interruption, resume, and recovery.
- **Correlation and isolation** — the connections within one execution and the separation between executions.

## Boundaries

- Context is **carried and preserved; it is not acted on by the context layer** — context frames the execution; the layers above act within it ([state principles](01-state-principles.md)).
- Context **never overrides approval** — it carries approval faithfully; it never manufactures or weakens it.
- Isolation is **absolute across tenants** — context never correlates or leaks across a workspace boundary.
- It **defines no method or storage** — this document establishes that the context model exists and its dimensions, not how context is represented or moved.

## Future direction

Future context handling may carry richer frames — finer scope, deeper history, more precise correlation. The model is fixed: task, scope, approval, history, correlation, isolation — carried faithfully, approval never overridden, isolation absolute. Richness grows; the integral, approval-preserving, isolated context holds.
