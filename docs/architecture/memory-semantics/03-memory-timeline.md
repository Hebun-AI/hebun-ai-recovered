# 03 — Memory Timeline

The temporal architecture of Organizational Memory. Memory is fundamentally about time — it is the organization's record of *what happened over time*. This document describes how time structures memory: the axis along which records become history. It elaborates the Phase 6B `MemoryTimeline` object at the semantic level. Architecture only.

## Why memory is fundamentally temporal

Strip time from memory and nothing is left but current state — which is knowledge, not memory. What distinguishes memory from a database is precisely the time dimension: memory records not just what is true, but what *was* true, when, and in what sequence.

Temporality is not a feature of memory; it is its essence. Every memory is a point in time; every meaning depends on temporal context; every lesson is drawn from a trajectory. The timeline is the structure that makes all of this coherent.

## Temporal concepts

### Past

The domain of memory. Memory is the durable record of the past — everything that has happened and been retained. The past is immutable in memory: what occurred stays recorded as having occurred, never rewritten ([Phase 6A never-rewrite-facts](../memory/04-memory-principles.md)).

### Present

The live edge where new memory is formed. The present is not memory yet — it is runtime state, the working now. As events occur, the present continuously becomes the past, and its events are recorded as new memories. Memory and the present meet at this recording boundary but are architecturally distinct ([memory boundaries](../memory/05-memory-boundaries.md)).

### Historical continuity

The unbroken thread of memory across time. Continuity means the organization's history has no silent gaps — the timeline connects past to present without erasure. Continuity is what lets the organization trust its memory as a complete account rather than a selective one.

### Sequences

Ordered runs of related memories. A sequence is memory arranged in the order it occurred — the natural structure of the timeline. Sequences are what let reasoning follow *how* something unfolded, not just *that* it happened.

### Milestones

Memories of heightened significance that mark turning points. A milestone is a temporal anchor — a decision, a launch, a pivot — that structures the timeline into meaningful eras. Milestones give the timeline landmarks, letting history be navigated by significance, not just by date.

### Decision history

The temporal chain of decisions and their outcomes. Decision history is the timeline read specifically for choices made and what followed — the record most directly consumed by reasoning. It is where *"what did we decide, and how did it turn out"* is answered.

### Event chains

Causally or sequentially linked runs of events. Where a sequence is merely ordered, an event chain carries connection — this led to that. Event chains, expressed through `MemoryReference` links across the timeline, are how the organization remembers not just events but their consequences.

## How time structures meaning

- **Order is meaning.** The sequence of memories carries information the memories alone do not — which decision preceded which outcome. Reasoning depends on temporal order to infer cause and lesson.
- **Duration is meaning.** How long a state held, how quickly a situation evolved — these are properties of the timeline, not of any single memory.
- **Position is context.** *When* a memory occurred, relative to milestones and eras, is part of its meaning ([temporal context](02-memory-context.md)). The timeline supplies this position.
- **Trajectory enables experience.** Reading the timeline as a whole — the trajectory, not the points — is what turns memory into experience ([Phase 6A progression](../memory/01-memory-philosophy.md)). The timeline is the structure that makes trajectory visible.

## What this document does not define

- No storage of temporal data, no indexing by time, no time-based query mechanism.
- No algorithm for sequence detection, chain inference, or milestone identification.
- No retrieval or ranking by recency or relevance.

Those are downstream, behind the Director gate. This document fixes only the architectural role of time: memory is temporal by nature, and the timeline is the structure along which records become history, sequences, and — read whole — experience.
