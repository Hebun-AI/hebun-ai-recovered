# 05 — Memory Boundaries

Memory is powerful only if it stays what it is. If everything becomes "memory," the concept degrades into an undifferentiated log and loses its value as the durable, meaningful past. This document draws the boundary: what belongs in memory, what does not, and why the separation matters architecturally.

## What belongs in memory

Memory holds the **durable, meaningful past** — records that the organization should carry forward to reason with later:

- **Events that happened** — decisions, milestones, incidents, observations, with their time and provenance.
- **The reasoning behind decisions** — the context and alternatives that make a past choice interpretable.
- **Lessons learned** — what worked, what failed, and why.
- **Outcomes over time** — how things turned out, forming the trajectory reasoning depends on.

The test: *would the organization be worse off for having forgotten this?* If yes, it is memory.

## What does not belong in memory

Memory is not a catch-all store. The following are explicitly outside it:

- **Runtime state** — the live working state of an execution. Present, not past.
- **Cache** — transient copies kept for speed. Disposable by definition.
- **Temporary context** — scratch data valid only within a single operation.
- **Raw documents as such** — the document is a source; the memory is what was learned or decided from it.

The test: *is this transient, disposable, or merely current?* If yes, it is not memory.

## The distinctions that matter

### Knowledge vs Memory

**Knowledge** is what is true now — the Phase 5 graph, current structure. **Memory** is what has happened over time. Knowledge is a snapshot; memory is the history that produced it. A change to knowledge (an updated relationship) produces a new memory (that it changed, when, why) — the two are distinct layers, and memory never overwrites knowledge.

### Documents vs Memory

A **document** is raw source material. A **memory** is the durable, contextualized record derived from an event or decision. A contract PDF is a document; "we agreed these terms, on this date, for this reason" is a memory. Documents are Sources of memory ([memory model](02-memory-model.md)), not memory itself. Storing documents wholesale is not remembering.

### Events vs Memory

An **event** is the occurrence; a **memory** is its durable record. Not every event becomes a lasting memory — the boundary chooses which occurrences are worth carrying forward. Events are the raw stream; memory is the curated, retained trace.

### Relationships vs Memory

A **Phase 5 relationship** is a present-tense structural fact (Role reports_to Role). A **memory relationship** connects memories to that structure and to each other across time. The graph says how things relate now; memory says how those relations came to be and how they changed. Memory references graph relationships; it does not replace them.

### Runtime state vs Memory

**Runtime state** is the live present — what is executing right now. **Memory** is the durable past. Runtime *produces* events that may become memory and *reads* memory for context, but runtime state is never itself memory. Confusing the two would make memory a volatile cache and runtime a bloated archive — both wrong.

## Why the separation is architectural

Keeping these boundaries sharp is not tidiness — it is what makes memory usable:

- **Reasoning trusts memory** because memory is durable and curated, not polluted with transient state.
- **Runtime stays lean** because it is not burdened with being the record of history.
- **The graph stays canonical** because memory references it rather than duplicating or mutating it.
- **Memory stays meaningful** because it holds only what is worth carrying forward.

A memory layer that absorbed runtime state, cache, and raw documents would be a log, not a memory. The boundary is what keeps organizational memory a first-class capability rather than a dumping ground.
