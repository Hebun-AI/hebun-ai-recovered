# 04 — Tool Invocation

## Purpose

Tool Invocation defines **how an execution agent requests an operation from a tool** — the request side of the agent↔tool contract. An invocation is the agent asking a tool to perform one bounded operation; this document fixes what a valid invocation is, so every agent invokes every tool the same way and every tool knows what it is being asked.

## Architectural role

Tool Invocation is the entry point of the [Tool Lifecycle](02-tool-lifecycle.md) — the request that triggers a tool operation. It is the interface between an agent performing its task ([Phase 8C](../execution-agents/README.md)) and a tool performing an operation. It defines the *shape* of a request, not its transport or protocol (no MCP, no API). It carries, for committing operations, the approval context that governance depends on.

## What an invocation carries

- The **operation** — which bounded operation the agent is requesting.
- The **parameters** — the inputs the operation needs, within the tool's defined bounds.
- The **approval context** — for a committing operation, the Director's approval carried down from planning and decision, so governance can confirm the operation is authorized ([tool governance](06-tool-governance.md)).
- The **traceability context** — enough to record the operation as part of the execution trace.

## Inputs

- The **agent's need** — the operation the agent's task requires at this step.
- The **tool's defined contract** — what operation and parameters the tool accepts.

## Outputs

- A **well-formed invocation** — a valid request the tool can validate and perform.
- A **recorded invocation** — the request logged for traceability.

## Boundaries

- An invocation **requests one bounded operation** — it does not ask a tool to reason, decide, coordinate, or perform more than its one operation ([tool boundaries](03-tool-boundaries.md)).
- Invocation is **agent-to-tool** — an agent invokes a tool; a tool does not invoke agents, and a tool is not invoked to coordinate ([tool principles](01-tool-principles.md)).
- A **committing invocation carries its approval** — an agent invokes a committing operation only within the Director's approval, and the approval travels with the request.
- It **defines no method, protocol, or concrete tool** — this document establishes that tool invocation exists and its shape, not MCP, APIs, or any transport.

## Future direction

Future invocation may carry richer requests — more expressive parameters, finer approval context, better traceability. The shape is fixed: a valid, bounded, agent-to-tool request that carries approval for committing operations and stays traceable. Expressiveness grows; the bounded, approval-carrying invocation holds.
