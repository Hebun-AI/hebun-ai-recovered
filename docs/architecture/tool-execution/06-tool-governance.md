# 06 — Tool Governance

## Purpose

Tool Governance defines **how committing and sensitive tool operations stay within the Director's approval and the organization's governance**. A tool is where a real, often irreversible, effect on the world happens — a write, a spend, a publish, an external call. Tool governance is what ensures those effects occur only within what was approved. It is the gate at the point of action, the lowest and most consequential enforcement point in the architecture.

## Architectural role

Tool Governance is where the committing-action boundary that runs the whole chain — identified in reasoning, marked in planning, checked in decision, confirmed in verification, enforced in orchestration ([governance control](../director-orchestration/05-governance-control.md)) — reaches its final point: the operation itself. It confirms, at invocation, that a committing tool operation carries the Director's approval before it is performed, and it composes with the future governance engines ([Policy](../../architecture-backlog/13-policy-engine.md), [Permission](../../architecture-backlog/14-permission-engine.md)). It is the last check before an effect reaches the world.

## What governance covers

### Committing operations
A tool operation that commits or is irreversible — spending, publishing, writing, external side effects — is performed **only within the Director's approval**, carried down through the invocation ([tool invocation](04-tool-invocation.md)). An unapproved committing operation is refused, returned as a failure, never performed.

### Sensitive operations
Operations touching sensitive scope (data residency, restricted resources) are bounded by the applicable governance — policy and permission, enforced upstream and confirmed here. A tool honors these bounds; it does not evaluate them itself (that was done upstream), but it does not perform an operation the governance context forbids.

### Workspace scope
A tool operation stays within the workspace it was invoked for — the hard tenant boundary ([Phase 5](../graph-validation/05-workspace-boundaries.md)) reaches down to the operation. A tool never performs an operation across a tenant boundary.

## Inputs

- The **invocation** and its **approval context** — for committing operations, the Director's approval.
- The **governance context** — applicable policy, permission, and workspace scope, established upstream.

## Outputs

- **Governed operations** — committing and sensitive operations performed only within approval and governance.
- **Refusals** — unapproved or out-of-governance operations refused and returned as structured failures, not performed.
- A **governance trace** — the approval and governance check recorded with the operation.

## Boundaries

- Governance at the tool is a **hard gate** — an unapproved committing operation is never performed, no matter how it is invoked ([tool principles](01-tool-principles.md)).
- A tool **honors governance; it does not evaluate policy itself** — alignment and enforcement happened upstream ([decision](../director-decision/05-governance-alignment.md), [orchestration](../director-orchestration/05-governance-control.md)); the tool confirms approval and refuses what is unapproved. It makes no governance judgment of its own.
- It **never grants approval** — a tool holds no authority; it performs only within approval the Director already gave.
- It **defines no method** — this document establishes that tool governance exists and its role, not any enforcement algorithm.

## Future direction

As the Policy and Permission engines are designed, Tool Governance deepens — confirming richer policy and finer permission at the point of operation. The gate is fixed: committing operations run only within Director approval, sensitive operations only within governance, nothing across a tenant boundary. Depth grows; the hard gate at the point of action holds.
