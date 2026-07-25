# 03 — Memory Object Relationships

How the canonical memory objects relate to one another and to the frozen Phase 5 model. This document describes the **conceptual relationships** between objects — architecture only, no fields, no cardinality contracts, no runtime.

Notation: `Object --relates--> Object`. These relationships are conceptual descriptions, not the ratified relationship contracts of Phase 5B; they describe how memory objects compose.

## Core relationships

### Memory → MemoryEvent

```
Memory --records--> MemoryEvent
```

A Memory is the durable record of exactly one MemoryEvent. The Event is *what happened*; the Memory is *the retained trace of it*. This is the founding relationship — memory exists to record events.

### Memory → MemorySource

```
Memory --originates_from--> MemorySource
```

Every Memory carries the Source that produced it. This relationship is what makes a memory traceable. It is mandatory: a memory with no Source has no provenance and cannot be trusted.

### Memory → MemoryOwner

```
Memory --owned_by--> MemoryOwner --references--> Phase 5 entity
```

Every Memory is owned by an organizational entity, expressed through MemoryOwner as a reference into the Phase 5 model. This binds memory to the organizational structure and keeps it within a workspace. Ownership is single and mandatory — the memory analogue of the graph's single-sourced ownership.

### Memory → MemoryContext

```
Memory --interpreted_by--> MemoryContext
```

A Memory is given meaning by its Context. The relationship preserves the *why* alongside the *what*, so the memory stays interpretable across time.

### MemoryReference → Memory

```
MemoryReference --connects--> Memory --and--> (Phase 5 graph | another Memory)
```

A MemoryReference links a Memory outward — to the Phase 5 nodes and edges it concerned, and to other Memories it relates to (cause, sequence, supersession). This is what keeps memory anchored to the organizational model and connected into a web of related history rather than a set of isolated records.

### MemoryEvent → MemoryTimeline

```
MemoryEvent --positioned_on--> MemoryTimeline
```

The events that memories record take their ordered place on a Timeline. This relationship is what turns a set of memories into a sequence — the axis along which trajectory and, eventually, experience become visible.

## The relationship web

```
                 MemorySource
                     ▲ originates_from
                     │
MemoryEvent ◄──records── Memory ──owned_by──► MemoryOwner ──► Phase 5 entity
     │                    │  │
     │ positioned_on      │  └─interpreted_by──► MemoryContext
     ▼                    │
MemoryTimeline            └─connected_by── MemoryReference ──► Phase 5 graph
                                                          └──► another Memory
```

Read around the hub: a **Memory** records a **MemoryEvent**, originates from a **MemorySource**, is owned by a **MemoryOwner** (a Phase 5 entity), is interpreted by a **MemoryContext**, and is connected outward by **MemoryReference** to the Phase 5 graph and to other Memories; the underlying **MemoryEvent** is positioned on a **MemoryTimeline**.

## Relationship to Phase 5

Two relationships cross into Phase 5, and both are **reference-only**:

- `MemoryOwner --references--> Phase 5 entity` — accountability anchored in the org structure.
- `MemoryReference --connects--> Phase 5 graph` — memory anchored to the nodes and edges it concerned.

Neither modifies Phase 5. Memory points *at* the frozen structure across the time axis; the structure is unaware of and unchanged by the memories that reference it. This one-directional dependency — memory depends on the graph, never the reverse — keeps Phase 5 frozen and memory a clean layer on top.

## What is not defined here

- No cardinalities as ratified contracts — "one Source per Memory" is stated as meaning, not as a Phase 5B-style multiplicity contract.
- No fields or schemas on any object or relationship.
- No storage, retrieval, or runtime behavior.

Those are downstream concerns behind the Director gate. This document fixes only how the canonical memory objects conceptually relate.
