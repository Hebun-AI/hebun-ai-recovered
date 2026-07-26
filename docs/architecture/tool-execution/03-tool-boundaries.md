# 03 — Tool Boundaries

## Purpose

Tool Boundaries define **what an execution tool must never do**. A tool is where an operation meets the world — where a real effect happens. Its boundaries are the last and lowest line in the architecture, keeping each individual operation within what was approved. This document draws those lines explicitly, for every tool, whatever it does.

## Architectural role

Tool Boundaries make the [tool principles](01-tool-principles.md) concrete as prohibitions. They define the wall around the tool: it performs its one operation and nothing beyond it — no reasoning, no planning, no deciding, no coordinating, no exceeding approval. Because a tool is the simplest component, its boundaries are correspondingly strict and clear.

## An Execution Tool does NOT

### Reason
A tool forms no judgment. It does not interpret intent beyond its operation, infer what the agent "really wants", or reason about its request. Reasoning is the [Phase 7 domains'](../director-review/README.md) job, far upstream. A tool executes; it does not think.

### Redesign plans
A tool changes no plan. It performs the operation it was invoked to perform; it does not alter, extend, or reinterpret the work. Planning is the [planning domain's](../director-planning/README.md) job.

### Make decisions
A tool chooses nothing. Where a request is ambiguous or its operation could go several ways, a tool does not decide — it returns a failure or a structured result surfacing the ambiguity ([tool results](05-tool-results.md)). Deciding is the [decision domain's](../director-decision/README.md) job.

### Coordinate execution
A tool directs no agent and no other tool. It performs its operation and returns; it chains nothing and orchestrates nothing. Coordination is orchestration's job ([Phase 8B](../execution-orchestration/README.md)).

### Exceed its bounds
A tool performs only its one defined operation, within its defined scope. It does not perform an adjacent operation, escalate its own capability, or do more than it was invoked to do ([tool principles](01-tool-principles.md)).

### Bypass Director Authority
A tool never performs a committing operation outside the Director's approval, and never becomes a path around the gate ([tool governance](06-tool-governance.md), [Director Authority](../director-reasoning/05-director-authority.md)). A committing operation runs only within the approval carried down from planning and decision.

## What a tool does with a bad request

The defining question for the operation-level component: *what does a tool do when it cannot perform the request as given?* The answer is the boundary in action — **the tool refuses and returns a structured result; it never improvises across a boundary.**

- An ambiguous request → return a structured "cannot perform / ambiguous" result, do not guess (that would be deciding).
- An out-of-bounds request → refuse it, do not stretch to perform it (that would exceed bounds).
- An unapproved committing operation → refuse it, do not perform it (that would bypass authority).
- A request needing more work → return what it could, do not take on the rest (that would be re-planning or coordinating).

A tool's response to what it cannot do is always to return honestly and let the agent (and the domains above) decide what happens next — never to assume a role it does not hold.

## Boundaries of this document

- It **defines prohibitions, not methods** — what a tool must not do, not how it performs.
- It **describes no concrete tool, MCP, API, or runtime** — specific tools and their machinery are later phases.

## Future direction

Future tools will perform more capable operations within these boundaries — handling more of the world by *performing their one operation better* and *returning richer results*, never by assuming a role they lack. The boundaries are fixed: a tool performs one bounded operation and returns; it never reasons, re-plans, decides, coordinates, exceeds its bounds, or bypasses authority. Capability grows within the wall; the wall does not move.
