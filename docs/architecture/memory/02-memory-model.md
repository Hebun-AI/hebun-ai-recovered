# 02 — Memory Model

The conceptual model of Organizational Memory. This defines the **concepts** and how they relate — not contracts, not schemas, not storage. Contracts come in a later phase behind the Director gate; here we fix the vocabulary of memory.

Throughout, memory concepts **reference** the Phase 5 entities and graph; they never modify them. A memory is *about* the frozen structure, layered over it in time.

## Core concepts

### Memory

The atomic unit — a single durable record of something that was true, decided, or observed, at a point in time. A Memory carries its content, its time, its provenance, and its context. It is the film-frame of the organization's history: inert once recorded, never rewritten.

A Memory is not a document and not a database row. It is a first-class record with meaning, time, and origin bound together.

### Memory Source

Where a Memory came from. A Source identifies the origin of a memory — a person, an AI agent, a system, an ingested document, an observed event. Source is what makes a memory *traceable*: every memory answers "who or what produced this, and how do we know."

Source is distinct from Owner. A memory produced by an agent (Source) may be owned by a department (Owner).

### Memory Owner

The organizational entity accountable for a Memory. Owner is a reference to a Phase 5 entity — an Organization, OrganizationalUnit, or Role — that is answerable for the memory's scope and stewardship. Ownership makes memory governable: every memory belongs to some part of the organization, never floating unowned.

### Memory Context

The circumstances that give a Memory meaning. Context is the surrounding situation — what the organization was doing, what alternatives were considered, what constraints applied — that makes the memory interpretable later. A decision recorded without its context is a fact stripped of its reasoning; Context preserves the *why*.

### Memory Event

The occurrence a Memory records. An Event is the thing that happened — a decision made, a milestone reached, a lesson learned, an observation logged. A Memory is the durable record; the Event is what it is a record *of*. Events are what give memory its temporal texture: the organization's history is a stream of events, remembered.

### Memory Timeline

The ordered, temporal arrangement of Memories. A Timeline is how memories compose into history — the sequence and duration that let the organization see trajectory, not just isolated points. Timelines make "what happened over time" answerable: they are the axis along which experience emerges from individual memories.

### Memory Relationship

A connection between Memories, or between a Memory and the Phase 5 graph. Relationships link a memory to the entities and edges it concerned, and to other memories it relates to (cause, sequence, supersession). This is what anchors memory to the organizational model: a remembered decision points at the roles, capabilities, and relationships it was about.

## How the concepts compose

```
Memory Event            (something happened)
   │ recorded as
Memory                  (durable record: content + time)
   ├── Memory Source     (who/what produced it)
   ├── Memory Owner      (which Phase 5 entity is accountable)
   ├── Memory Context    (the circumstances that give it meaning)
   ├── Memory Relationship → Phase 5 graph nodes/edges, and other Memories
   └── positioned on a
Memory Timeline         (ordered history)
```

A **Memory** records an **Event**, carries its **Source**, **Owner**, and **Context**, connects through **Relationships** to the frozen Phase 5 structure and to other memories, and takes its place on a **Timeline**. Read one memory and you have a fact in context; read a timeline of related memories and history — and eventually experience — emerges.

## What the model is not

- Not storage. The model says what concepts exist, not how they are persisted.
- Not contracts. No fields, types, or validation are defined here — that is a later phase.
- Not a replacement for the graph. Memory references Phase 5 entities and relationships; it does not duplicate or alter them.
- Not runtime state. A Memory is durable history, not live working state.
