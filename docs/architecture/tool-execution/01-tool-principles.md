# 01 — Tool Principles

## Purpose

The Tool Principles are the constitution of an Execution Tool — the commitments every tool must obey, whatever operation it performs. They are the shared contract that makes an operation an *execution tool*: a bounded, passive, honest instrument. Any tool that violates one of these is not a valid Execution Tool.

## Architectural role

These principles constrain all the tool topics that follow (lifecycle, boundaries, invocation, results, governance). Every subsequent document inherits them first. They are what let agents ([Phase 8C](../execution-agents/README.md)) invoke any tool with confidence — because every tool obeys the same rules. They are the deepest, simplest expression of the execution discipline that runs through Phases 8A–8C.

## The principles

### 1. A tool performs only what it is invoked to do
A tool executes an operation only when an agent invokes it with a valid request, within approved work. It never acts unbidden, never performs an operation it was not asked for, never expands its operation beyond the request. Invocation is the sole trigger.

### 2. A tool performs one bounded operation
A tool does one defined thing, within defined bounds — nothing more. It does not chain into other operations, take on adjacent work, or exceed the scope of its operation. Boundedness is the tool's defining nature.

### 3. A tool performs; it does not think
A tool forms no judgment. It does not reason about its request, interpret intent beyond the operation, or decide anything ([tool boundaries](03-tool-boundaries.md)). A tool is an instrument, not a mind.

### 4. A tool returns what happened, honestly
A tool returns a structured result that faithfully represents the operation's outcome — success, failure, or partial ([tool results](05-tool-results.md)). It never misrepresents an outcome, hides a failure, or fabricates a success. Honest return is the tool's core output duty.

### 5. Committing operations respect Director approval
A tool operation that commits or is irreversible (a write, a spend, a publish) was marked upstream and approved by the Director. A tool performs such an operation only within that approval, and an agent invokes it only within the same ([tool governance](06-tool-governance.md), [Director Authority](../director-reasoning/05-director-authority.md)). A tool never becomes a way around the gate.

### 6. A tool is traceable
Every tool operation is recorded — what was invoked, with what request, with what result — contributing to the complete execution trace ([tool results](05-tool-results.md)). An untraceable operation would be an unaccountable effect in the world.

### 7. A tool coordinates nothing
A tool directs no agent and no other tool. It performs its operation and returns; it holds no coordination role. Coordination belongs to orchestration ([Phase 8B](../execution-orchestration/README.md)), never to a tool.

## Inputs

- The **invocation request** from an agent — the operation to perform and its parameters.
- The **approval context** — for committing operations, the Director's approval carried through.

## Outputs

- A **principled frame** every tool operates within — the standard every execution tool is held to.

## Boundaries

- These principles **define no method** — they state what a tool must obey, not how it performs.
- They **describe no concrete tool, MCP, API, or runtime** — specific tools and their machinery are later phases behind the Director gate.

## Future direction

Future tools may perform far more capable operations across many domains — but every one will obey these principles: invoked-only, bounded, non-reasoning, honest, gated for committing operations, traceable, coordinating nothing. Capability grows; the shared constitution holds.
