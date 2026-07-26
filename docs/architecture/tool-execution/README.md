# Tool Execution — Architecture (Phase 8D)

## Purpose

**Execution Tools** are the bounded operations through which execution agents actually perform work. Phase 8A defined how execution works, 8B how it is orchestrated across agents, 8C what every agent must be. Phase 8D defines the **architectural contract for tool usage** — the relationship between an execution agent and the tools it invokes to do its work.

This phase defines the **tool contract**, not any specific tool. It defines **no MCP**, no APIs, no browser automation, no concrete tool. What is defined is the shared frame every execution tool must fit: a tool receives a request, performs a bounded operation, returns a structured result, and stays traceable — and never reasons, decides, or exceeds its bounds.

It is **architecture only**. No runtime, no implementation, no algorithms, no prompts, no concrete tool definitions.

## Relationship with Execution Agents

An execution agent ([Phase 8C](../execution-agents/README.md)) performs its assigned work; a tool is *how* it performs a concrete operation within that work. The agent invokes a tool with a request; the tool performs a single bounded operation and returns a result; the agent uses the result to continue its task. The tool is the agent's instrument — the agent wields it, the tool executes one operation and returns.

```
Execution Agent (8C)  — performs assigned work, invokes tools
        │  request
        ▼
   Execution Tool (8D)   ← this phase (the tool contract)
   (performs one bounded operation, returns a structured result — reasons nothing)
        │  structured result
        ▲
Execution Agent (8C)  — uses the result to continue its task
```

## Role of Tool Execution

A tool is the **simplest, most bounded component in the whole architecture** — a single operation, invoked, performed, returned. It holds no plan, no task, no judgment, no coordination role. It is a passive capability: it does exactly what it is asked, within its defined bounds, and returns what happened. Everything above it — agents, orchestration, reasoning — decides *what* to do and *when*; the tool only does *one thing*, on request.

## Why tools are separate from agents

- **Instrument vs performer.** An agent performs a whole assigned task, deciding which operations to invoke and in what order (within its faithful execution of the plan); a tool performs one operation on demand. Separating them keeps the agent's role (perform the task) distinct from the tool's role (perform one operation).
- **Reusability.** Because a tool is a bounded operation with a defined contract, many different agents can invoke the same tool. Separating tools from agents is what lets a capability be shared across the fleet rather than baked into one agent.
- **Boundaries at the operation.** A tool is where an operation meets the world — where a real effect (a read, a write, a call) happens. Defining the tool's boundaries and governance explicitly is what keeps individual operations within what was approved, especially committing ones.
- **Simplicity enables trust.** A tool that only performs one bounded operation and returns a result — reasoning nothing, coordinating nothing — is simple enough to be trusted and governed precisely. Complexity lives above the tool; the tool stays a clean, bounded operation.

## Documents

| Document | Topic |
|---|---|
| [01 — Tool Principles](01-tool-principles.md) | The principles every tool obeys |
| [02 — Tool Lifecycle](02-tool-lifecycle.md) | The stages of a tool performing an operation |
| [03 — Tool Boundaries](03-tool-boundaries.md) | What a tool must never do |
| [04 — Tool Invocation](04-tool-invocation.md) | How an agent invokes a tool |
| [05 — Tool Results](05-tool-results.md) | How a tool returns structured outcomes |
| [06 — Tool Governance](06-tool-governance.md) | Keeping committing tool operations gated |
| [07 — Future Evolution](07-future-evolution.md) | How the tool contract deepens |

Each document defines: **purpose, architectural role, inputs, outputs, boundaries, and future direction.**

## What Tool Execution must always do

- **Execute only agent-approved requests** — a tool performs an operation only when a valid agent invokes it within approved work.
- **Perform bounded operations** — one defined operation, within its bounds, nothing more.
- **Return structured outcomes** — a clear, structured result the agent can use.
- **Support success, failure, and partial completion** — every outcome honestly represented.
- **Preserve execution traceability** — every tool operation is recorded.
- **Never reason** — a tool forms no judgment.
- **Never redesign plans** — a tool changes no plan.
- **Never coordinate execution** — a tool directs no agent and no other tool.
- **Never bypass Director Authority** — committing tool operations stay within the Director's approval.

## Status

Architecture only — the tool contract, not any concrete tool, MCP server, API, or implementation. Concrete tools and their machinery — should they be built — follow the [Capability Lifecycle](../../architecture-backlog/00-capability-lifecycle.md) behind the Director gate. Nothing here is implemented.
