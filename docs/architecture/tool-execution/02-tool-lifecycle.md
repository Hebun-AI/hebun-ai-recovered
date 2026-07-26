# 02 — Tool Lifecycle

## Purpose

The Tool Lifecycle is the **ordered progression of a tool performing one operation** — from receiving an invocation to returning a result. It is the simplest lifecycle in the architecture: a tool is invoked, it performs a bounded operation, it returns. This document fixes those stages so every tool's operation follows the same shape.

## Architectural role

The Tool Lifecycle defines *how a single tool operation proceeds*, within an agent's execution of its task ([Phase 8C](../execution-agents/02-agent-lifecycle.md)). Each invocation runs this lifecycle once. It is bounded and self-contained — a tool operation begins on invocation and ends on return, holding no state or role beyond it. The tool performs the lifecycle; it does not decide when it is invoked (the agent does) or what to do with the result (the agent does).

## The lifecycle

```
Invocation       — receive a request from an agent (operation + parameters)
   ↓
Validation       — confirm the request is well-formed, within bounds, and approved
                   (for committing operations, within the Director's approval)
   ↓
Operation        — perform the single bounded operation
   ↓
Return           — return a structured result (success / failure / partial)
```

The lifecycle is atomic per invocation: one request in, one bounded operation, one structured result out.

## Stage meanings

- **Invocation.** The tool receives a request from an agent — the operation to perform and its parameters ([tool invocation](04-tool-invocation.md)).
- **Validation.** The tool confirms the request is well-formed and within its bounds, and — for a committing operation — within the Director's approval. An invalid or unapproved request is refused with a structured result, not performed ([tool governance](06-tool-governance.md)).
- **Operation.** The tool performs its single bounded operation — the real effect (read, write, call, transform) it exists to do.
- **Return.** The tool returns a structured result faithfully representing the outcome ([tool results](05-tool-results.md)), and the operation is recorded for traceability.

## Inputs

- The **invocation request** — operation and parameters, with approval context for committing operations.

## Outputs

- The **performed operation** — the tool's single bounded effect, within bounds and approval.
- A **structured result** — the outcome, returned to the invoking agent.
- A **trace record** of the operation.

## Boundaries

- The lifecycle **performs one bounded operation; it takes on no more** ([tool principles](01-tool-principles.md)).
- It **validates before acting** — an out-of-bounds or unapproved request is refused, not performed.
- It **honors the gate** — a committing operation runs only within the Director's approval.
- It **defines no method** and **no concrete tool** — this document establishes that the tool lifecycle exists and its stages, not any runtime mechanism or specific tool.

## Future direction

Future tools may run richer operations within this lifecycle — but the shape is fixed: invoke, validate, perform one bounded operation, return a structured result honestly. Capability grows; the atomic, validated, bounded, gated lifecycle holds.
