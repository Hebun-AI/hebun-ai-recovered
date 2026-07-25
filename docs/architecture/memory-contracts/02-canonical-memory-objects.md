# 02 — Canonical Memory Objects

The canonical objects of Organizational Memory. Each entry fixes the object's **purpose**, **business meaning**, and **relationship to other objects** — not its fields, not its schema. These are constitutional definitions; the precise attributes are a later, gated concern.

These objects make canonical the concepts named in the Phase 6A [memory model](../memory/02-memory-model.md). They reference Phase 5 entities and the relationship graph; they never modify them.

---

## Memory

**Purpose.** The atomic canonical unit of organizational memory — one durable record of something that was true, decided, or observed at a point in time.

**Business meaning.** A single remembered fact-in-context. It is what the organization retains and later reasons over. Immutable once recorded: a Memory is a permanent frame of history, never rewritten.

**Relationship to other objects.** A Memory records a `MemoryEvent`, carries a `MemorySource` and a `MemoryOwner`, is interpreted by a `MemoryContext`, connects outward through `MemoryReference`, and takes its place on a `MemoryTimeline`. It is the hub the other objects attach to.

## MemoryEvent

**Purpose.** The occurrence that a Memory is a record of.

**Business meaning.** The thing that happened — a decision made, a milestone reached, a lesson learned, an observation logged. The Event is the *what happened*; the Memory is the *durable record of it*. Distinguishing the two keeps the occurrence separate from its retention.

**Relationship to other objects.** A `MemoryEvent` is recorded as a `Memory`. Events are what give a `MemoryTimeline` its temporal texture — the timeline is the ordered arrangement of the events memory has retained.

## MemorySource

**Purpose.** The origin of a Memory — where it came from.

**Business meaning.** Who or what produced the memory: a person, an AI agent, a system, an ingested document, an observed event. Source is what makes a memory *traceable* and trustworthy — a memory without a known origin cannot be governed or relied upon.

**Relationship to other objects.** Every `Memory` carries a `MemorySource`. Source is distinct from `MemoryOwner`: an agent may be the Source of a memory a department Owns.

## MemoryOwner

**Purpose.** The organizational entity accountable for a Memory.

**Business meaning.** The part of the organization answerable for a memory's scope and stewardship. Ownership makes memory governable — every memory belongs to some Phase 5 entity, never floating unowned.

**Relationship to other objects.** Every `Memory` has a `MemoryOwner`, which is a reference to a Phase 5 entity (Organization, OrganizationalUnit, or Role). Ownership binds memory to the organizational structure and keeps it within a workspace.

## MemoryContext

**Purpose.** The circumstances that give a Memory its meaning.

**Business meaning.** The surrounding situation — what the organization was doing, what alternatives existed, what constraints applied — that makes a memory interpretable later. Context preserves the *why*; without it a memory is a fact stripped of its reasoning.

**Relationship to other objects.** A `Memory` is interpreted through its `MemoryContext`. Context is what lets a memory read years later still carry the understanding it had when recorded.

## MemoryReference

**Purpose.** A connection from a Memory to the things it concerned.

**Business meaning.** The link that anchors a memory to the organizational model and to other memories. A remembered decision points, through references, at the Phase 5 nodes and edges it was about, and at related memories (cause, sequence, supersession). References are what keep memory *about something the organization recognizes*.

**Relationship to other objects.** A `MemoryReference` points from a `Memory` to Phase 5 graph elements or to another `Memory`. It is the object that keeps memory connected rather than isolated.

## MemoryTimeline

**Purpose.** The ordered, temporal arrangement of Memories.

**Business meaning.** How individual memories compose into history — the sequence and duration that let the organization see trajectory, not just isolated points. The Timeline is the axis along which experience emerges from many memories.

**Relationship to other objects.** A `MemoryTimeline` orders `Memory` records (and the `MemoryEvent`s they capture). It is what makes "what happened over time" answerable and what turns a set of memories into a history.

---

## The objects as one model

```
MemoryEvent      (what happened)
   │ recorded as
Memory           (the durable record — the hub)
   ├── MemorySource     (where it came from)
   ├── MemoryOwner      (which Phase 5 entity is accountable)
   ├── MemoryContext    (what makes it interpretable)
   ├── MemoryReference  → Phase 5 graph, and other Memory records
   └── ordered on
MemoryTimeline   (history)
```

`Memory` is the hub. `MemoryEvent` is what it records; `MemorySource`, `MemoryOwner`, and `MemoryContext` qualify it; `MemoryReference` connects it outward; `MemoryTimeline` sequences it. Together they are the canonical vocabulary of the organizational past.

No fields, schemas, storage, or runtime behavior are defined here — those are downstream, behind the Director gate.
