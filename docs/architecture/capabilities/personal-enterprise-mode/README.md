# Personal Enterprise Mode

## What this is

**Personal Enterprise Mode** is a future product capability of Hebun AI: a mode in which Hebun acts as the owner's **AI-native business operating partner** — continuously discovering opportunities, designing ventures, monitoring a portfolio, and optimizing revenue, all under the owner's (the Director's) explicit authority.

It is a **product capability**, not an engine. It is **not** a reasoning architecture, **not** an agent architecture, **not** a runtime architecture. It builds *on top of* those foundations and orchestrates them toward a business outcome for a single owner.

This directory documents **only the product vision and capability boundaries**. No implementation, prompts, APIs, databases, vector stores, or runtime.

## Where it sits

Personal Enterprise Mode is a consumer of the certified architecture baseline and the reasoning layer above it:

```
Organizational Model      (Phase 5A — what exists)
Relationship Graph        (Phase 5B — how things relate)
Organizational Memory     (Phase 6 — what has happened over time)
Director Reasoning        (Phase 7 — how the organization thinks)
Multi-Agent Orchestration (execution of designed work)
        │  consumed by
        ▼
Personal Enterprise Mode  ← this capability (product layer)
```

It composes these layers; it does not modify or replace any of them. The graph gives it structure, memory gives it history, reasoning gives it judgment, orchestration gives it hands — and the Director gives it authority.

## Documents

| Document | Covers |
|---|---|
| [01 — Purpose](01-purpose.md) | Hebun as AI-native business operating partner |
| [02 — Core Capabilities](02-core-capabilities.md) | What the mode can do |
| [03 — Director Gates](03-director-gates.md) | What Hebun may and may not do without approval |
| [04 — Revenue Engine](04-revenue-engine.md) | Continuous opportunity search |
| [05 — Learning Loop](05-learning-loop.md) | How Hebun learns the Director without taking authority |
| [06 — Boundaries](06-boundaries.md) | Augments the Director, never replaces |
| [07 — Future Evolution](07-future-evolution.md) | Integrations with reasoning, enterprise modes, autonomous operations |

## The one rule that governs everything

**Personal Enterprise Mode augments the Director; it never replaces the Director.** Hebun researches, designs, prepares, simulates, and forecasts freely — but every outward, irreversible, or committing action waits for explicit Director approval. This principle runs through every document here.

## Status

Future product capability. Vision and boundaries only. Its architecture, contracts, and runtime — should it be built — follow the [Capability Lifecycle](../../../architecture-backlog/00-capability-lifecycle.md) behind the Director gate. Nothing here is implemented.
