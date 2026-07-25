# Canonical Memory Contracts — Architecture Design

## Purpose

This directory is the **canonical definition of Organizational Memory objects** — the constitutional building blocks of memory. Phase 6A designed *how* an organization remembers (philosophy, model, principles, boundaries). This phase (6B) fixes *what the memory objects are*: their identity, business meaning, and how they relate — as canonical contracts.

It is **design only**. It defines what memory objects are, not how they are stored, retrieved, or served. No fields, no schemas, no storage, no databases, no vector search, no embeddings, no retrieval, no runtime, no APIs. It modifies no Phase 5 contract and no Phase 6A artifact.

When a question arises about *what a memory object is* — what a `MemoryEvent` means, how `Memory` relates to `MemoryOwner`, whether a `MemoryReference` may point outside the graph — this directory is the answer of record.

## Documents

| Document | Covers |
|---|---|
| [01 — Memory Contract Philosophy](01-memory-contract-philosophy.md) | Why memory needs canonical contracts; architecture vs contracts vs runtime |
| [02 — Canonical Memory Objects](02-canonical-memory-objects.md) | The canonical objects: purpose, business meaning, relationships |
| [03 — Memory Object Relationships](03-memory-object-relationships.md) | How the objects relate to one another and to Phase 5 |
| [04 — Contract Principles](04-contract-principles.md) | The principles governing memory contracts |
| [05 — Contract Lifecycle](05-contract-lifecycle.md) | The lifecycle a memory contract travels |
| [06 — Versioning](06-versioning.md) | How memory contracts evolve without breaking prior decisions |

## Relationship to Phase 5

Phase 5 is **closed and frozen**. Memory contracts **reference** the Phase 5 entities and relationship graph; they never modify them. A `MemoryOwner` is a reference to a Phase 5 entity; a `MemoryReference` points at Phase 5 nodes and edges. Memory objects add the temporal layer over the frozen structure — they do not extend or alter the entity or relationship contracts.

## Relationship to Phase 6A

Phase 6A ([memory](../memory/README.md)) established the conceptual memory model — Memory, Source, Owner, Context, Event, Timeline, Relationship — and the principles governing them. This phase turns those concepts into **canonical contracts**: precise, immutable, versioned definitions. 6A is the architecture; 6B is the constitution of the objects that architecture named.

## Relationship to future Memory Runtime

A future Memory Runtime will **consume** these contracts — recording, holding, and serving memories that conform to them. Runtime reads the contracts; it does not author them. The contracts are stable; the runtime that consumes them may evolve freely beneath that stability.

## Relationship to future Director Reasoning

Director Reasoning will read memory objects as its record of the past. Because the objects are canonical and stable, reasoning can depend on their meaning without tracking runtime changes. The contracts give reasoning a fixed vocabulary of the past to reason over.

## Director Gate

This phase defines only the canonical contracts for Organizational Memory. No runtime, storage, retrieval, or APIs. **Phase 6C begins only after explicit Director approval.**
