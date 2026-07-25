# 02 — Memory Context

Context is what turns a memory from a fact into a meaning. The same recorded event signifies different things depending on the frame it is read in. This document describes the **architectural role of context** — the kinds of context that qualify a memory and how they shape its interpretation. No implementation.

Context here elaborates the Phase 6B `MemoryContext` object: 6B fixed that context exists and is carried; 6C describes the *dimensions* of context and their interpretive effect.

## Why context is architectural

A memory read without its context is a fact stripped of significance. "Approved the budget" means one thing in a growth quarter and another during a freeze. Context is not decoration on a memory — it is the frame that determines what the memory *means*. Preserving and applying context is therefore a first-class architectural responsibility, not an afterthought.

## Dimensions of context

A memory is qualified by several context dimensions at once. Each shapes interpretation differently.

### Organizational context

*Where in the organization* the memory sits — the unit, the reporting line, the accountable role. The same decision means differently at the executive level than at a team level. Organizational context anchors a memory in the Phase 5 structure it concerned.

### Business context

*What the business was doing* — its situation, priorities, and constraints at the time. A cost decision reads differently under expansion than under contraction. Business context supplies the strategic frame.

### Temporal context

*When* the memory occurred, relative to the organization's history — the era, the phase, the sequence. A choice made early in a company's life carries different weight than the same choice made at maturity. Temporal context ties meaning to the timeline ([03 — Memory Timeline](03-memory-timeline.md)).

### Project context

*Within what initiative* the memory arose — the project, its goals, its stage. A decision inside a failing project and the same decision inside a thriving one mean different things. Project context scopes a memory to the effort it belonged to.

### Workflow context

*Within what process* the memory was produced — the workflow, its step, its purpose. Workflow context situates a memory in the operational flow that generated it, distinguishing an incidental note from a decision point.

### Actor context

*Who was involved* — the people, their roles, their authority. A memory attributed to an accountable executive carries different weight than one from an observer. Actor context frames a memory by its human participants.

### AI Agent context

*Which agent produced or shaped it* — for AI-generated memory, the agent, its classification, and its role. Agent context lets the organization weigh AI-produced memory appropriately, distinguishing autonomous conclusions from assisted ones, and keeps AI provenance explicit.

## How context influences interpretation

- **Context selects meaning.** A memory has no single fixed meaning; context determines which meaning applies. The semantic layer reads a memory *through* its context, not in isolation.
- **Context governs relevance.** Whether a past memory bears on a present question is a contextual judgment — same organizational unit, comparable business situation, related project. Context is the primary filter of relevance.
- **Context compounds.** The dimensions combine: a memory is read through its organizational *and* business *and* temporal frame together. The richer the preserved context, the more precisely a memory can be interpreted later.
- **Missing context flattens meaning.** A memory whose context was not captured can be retrieved but not fully understood — it reverts to a bare fact. This is why 6B makes context constitutive of a valid memory.

## What this document does not define

- No mechanism for capturing, storing, or matching context.
- No algorithm for computing relevance from context.
- No fields or schema on `MemoryContext`.

Those are downstream concerns behind the Director gate. This document fixes only the architectural role context plays: it is the frame that gives memory its meaning, along the dimensions above.
