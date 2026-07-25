# 05 — Memory Clustering

Memories are not isolated points; they naturally group. A customer's memories belong together; a project's decisions form a story; an incident has a history. This document describes **conceptual grouping** — how memories cohere into meaningful clusters. It is architecture only: no clustering algorithm, no similarity computation, no vector math.

Clustering here is a *conceptual* lens, not a mechanism. It describes groupings that exist in meaning, which a future retrieval layer may surface but this phase does not compute.

## Why grouping is conceptual, not algorithmic

Memories cohere because of what they are *about*, not because an algorithm placed them together. A cluster is a set of memories sharing a meaningful anchor — the same customer, the same project, the same capability. The grouping is inherent in the memories' references and context, established when they were recorded.

This phase names the natural groupings. *How* they are detected, indexed, or ranked is a retrieval concern, downstream and out of scope. The point here is that these clusters are real and meaningful, and the architecture recognizes them.

## Conceptual clusters

### Customer memories

All memories anchored to a given external Party — engagements, decisions, escalations, outcomes across the relationship. Grouped by their reference to the Phase 5 Party (and its PartyRole). This cluster is the organization's remembered relationship with one customer, read as a whole.

### Project memories

Memories arising within a single initiative — its decisions, milestones, and lessons. Grouped by project context ([02](02-memory-context.md)). This cluster is the story of one effort from inception to outcome.

### Decision histories

Memories of related decisions and their consequences over time. Grouped by decision chains along the timeline ([03](03-memory-timeline.md)). This cluster answers *"how has this kind of decision gone before"* — the grouping reasoning most directly draws on.

### Department memories

Memories anchored to a given OrganizationalUnit — its operations, decisions, and evolution. Grouped by organizational context. This cluster is a department's remembered life, surviving the people who passed through it.

### Incident histories

Memories of an incident and its resolution — what happened, what was done, what was learned. Grouped as an event chain. This cluster preserves operational lessons so recurring situations meet accumulated experience rather than fresh improvisation.

### Capability evolution

Memories tracking how a Capability changed over time — how it was built, adjusted, supported, and deprecated. Grouped by reference to the Phase 5 Capability across the timeline. This cluster is the biography of an organizational ability.

## How clusters relate to the canonical model

Clusters are not new objects. Each is a **conceptual grouping** over existing Phase 6B memories, formed by what they share:

- **Shared reference.** Memories pointing at the same Phase 5 entity (Party, Unit, Capability) cluster around it via `MemoryReference`.
- **Shared context.** Memories with the same project, workflow, or organizational context cluster by that dimension.
- **Shared timeline thread.** Memories in the same sequence or event chain cluster temporally.

A single memory may belong to several clusters at once — a decision can be part of a customer cluster, a project cluster, and a decision history simultaneously. Clusters overlap freely because they are lenses, not partitions.

## What this document does not define

- No clustering, similarity, or grouping algorithm.
- No embeddings, vectors, or distance measures.
- No index, no retrieval mechanism, no ranking.

Those are downstream, behind the Director gate. This document fixes only the conceptual truth that memories cohere into meaningful groups, and names the groupings the organization's memory naturally forms.
