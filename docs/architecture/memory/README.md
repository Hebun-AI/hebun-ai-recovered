# Organizational Memory — Architecture Design

## Purpose

This directory is the architecture design for **Organizational Memory** — how an organization remembers. Phase 5 defined what exists (entities) and how things relate (the graph). This phase (6A) defines the temporal dimension: how decisions, events, lessons, and long-term context are retained, so the organization reasons with continuity rather than from a blank slate.

It is **design only**. It defines the memory philosophy, conceptual model, categories, principles, boundaries, and future consumption. It defines no storage, no database, no vector search, no embeddings, no retrieval, no runtime, and no contracts. It modifies no Phase 5 artifact.

Memory is a **first-class architectural capability** — not a datastore, not a cache, not a log. It sits alongside the entity model and the relationship graph as a core pillar of Organizational Intelligence, with its own philosophy, boundaries, and principles.

## Documents

| Document | Covers |
|---|---|
| [01 — Memory Philosophy](01-memory-philosophy.md) | Why organizations need memory; data → knowledge → memory → experience → wisdom |
| [02 — Memory Model](02-memory-model.md) | The conceptual model: Memory, Source, Owner, Context, Event, Timeline, Relationship |
| [03 — Memory Categories](03-memory-categories.md) | Categories of organizational memory and their purpose |
| [04 — Memory Principles](04-memory-principles.md) | Architectural principles governing memory |
| [05 — Memory Boundaries](05-memory-boundaries.md) | What belongs in memory and what does not |
| [06 — Future Evolution](06-future-evolution.md) | How future capabilities consume memory |

## Relationship to Phase 5

Phase 5 is **closed and frozen**. This phase builds on it and does not redesign it:

- **Phase 5A entities** are what memory is *about* — memories attach to organizations, roles, capabilities, parties, and the rest.
- **The Phase 5B relationship graph** is the structure memory *references* — a remembered decision points at the nodes and edges it concerned.

Memory adds the **time axis** over the frozen structure. It never modifies an entity or a relationship; it records what happened to them.

## Relationship to future Reasoning

Director Reasoning will consume memory as its record of the past. Where the graph gives the present structure, memory gives the history — prior decisions, their outcomes, lessons learned. Reasoning reads memory; it does not live inside it. Memory supplies the past; reasoning applies judgment.

## Relationship to Runtime

Runtime **produces** the events memory records and **reads** memory for context, but memory is not runtime state. Runtime is the live present; memory is the durable past. The two are architecturally separate — memory is not a runtime cache, and runtime is not the memory of record.

## Relationship to Organizational Intelligence

Organizational Intelligence rests on three pillars: **entities** (what exists), the **relationship graph** (how things relate), and **memory** (what has happened over time). This phase establishes the third. Together they let the organization be understood as a living system with structure and history, not a static snapshot.

## Director Gate

This phase establishes only the architecture of Organizational Memory. No contracts, no retrieval, no storage. **Phase 6B begins only after explicit Director approval.**
