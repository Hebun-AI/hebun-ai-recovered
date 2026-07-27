# 37 — AI Capability Orchestration

## Purpose

Define the **AI Capability Orchestration** layer — the architectural bridge between the capability model and the runtime that realizes it. Phase 10A–10E defined capabilities, their taxonomy, meta model, network, and intelligence. Phase 10F defines how AI agents **realize** capabilities: how the durable ability model is connected to changeable runtime, without either corrupting the other. This phase defines the *bridge architecture* — no agent list, no capability catalog, no workflow, no execution sequence.

## Core Concepts

### Orchestration bridges capability and runtime
AI Capability Orchestration is the layer that connects a **capability** (a durable *what*, [what is a capability](01-what-is-a-business-capability.md)) to the **runtime** that exercises it (agents, tools, execution — Phase 8). It is a bridge: capabilities on one side, runtime on the other, orchestration in between. It does not perform work and does not decide; it connects and coordinates the connection.

### Agents realize capabilities; they do not create them
The foundational rule of this phase: **AI agents realize capabilities — they do not constitute them** ([capability vs agent](05-capability-vs-agent.md)). A capability exists as a defined ability whether or not any agent realizes it. An agent is a *realizer* wired to a capability, not the capability itself. Creating, changing, or removing an agent never creates, changes, or removes the capability.

### Orchestration is built on Capability Intelligence
This layer sits *above* Capability Intelligence ([capability intelligence](30-capability-intelligence.md)): orchestration realizes the capabilities whose health, maturity, and risk the intelligence layer assesses. Intelligence *understands* the ability model; orchestration *realizes* it. The two are distinct — understanding is not realization.

### Orchestration is Director-governed
The Director governs orchestration ([director visibility](35-director-visibility.md), [authority model](../enterprise-organization/04-authority-model.md)): which capabilities are realized, and the binding of realizers to them, are governed and Director-visible. But the Director governs the **orchestration**, not the **runtime** — the Director does not run agents; the Director governs which abilities are realized and how they are bound ([runtime vs capability](42-runtime-vs-capability.md)).

### Orchestration preserves the capability boundary
Orchestration connects capability to runtime without letting runtime leak into the capability model. Capabilities stay organization-, process-, and agent-independent ([capability principles](02-capability-principles.md)); the bridge attaches realizers *below* the capability, at the realization floor ([capability boundaries](12-capability-boundaries.md)), never inside it.

## Architecture

- **Orchestration layer** — the bridge between capability model and runtime.
- **Realization** — how a capability is made real by runtime ([capability realization](38-capability-realization.md)).
- **Agent binding** — how agents attach to capabilities ([agent-capability binding](39-agent-capability-binding.md)).
- **Execution attachment** — how realized capabilities connect to execution ([capability execution model](40-capability-execution-model.md)).
- **Boundaries** — what orchestration does not do ([orchestration boundaries](41-orchestration-boundaries.md)).
- **Capability/runtime separation** — the invariant the bridge preserves ([runtime vs capability](42-runtime-vs-capability.md)).

## Enterprise Examples

*Illustrative of the bridge only — no agent list, no catalog.*

- The *shape* of the idea: a durable ability on one side, changeable agents on the other, orchestration binding them — so the ability persists while its realizers churn. This phase defines the bridge; it names no agent and no capability.

## Design Principles

- **Agents realize; they don't create.** Capabilities exist independent of realizers.
- **Bridge, don't blend.** Connect capability and runtime without leaking runtime into the model.
- **Director governs orchestration, not runtime.**

## Boundaries

- Defines the **orchestration bridge architecture**, not any agent, capability, workflow, or execution sequence.
- No agent list, catalog, state machine, LLM choice, framework comparison, code, UI, or prompt.

## Future Evolution

Later phases build the runtime that realizes capabilities and the concrete bindings, behind the Director gate. This phase fixes the bridge architecture and its invariants; it realizes nothing.
