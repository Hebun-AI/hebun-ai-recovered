# 10 — Capability Hierarchy

## Purpose

Define the hierarchical relationships of the taxonomy — how Enterprise, Domain, Capability, and Sub-Capability nest — and establish why capabilities are organized hierarchically and why the Sub-Capability level is necessary. It defines the *structure of nesting*, not any concrete node.

## Core Concepts

### Why capabilities are organized hierarchically
A flat list of abilities cannot express that some abilities are broad areas, some are distinct abilities, and some are facets of a larger ability. Hierarchy captures **containment and granularity**: it lets the enterprise reason at the right altitude — broad domain, distinct capability, or fine sub-capability — and drill between them ([enterprise thinking](06-enterprise-thinking.md)). Without hierarchy, the ability model is either too coarse or an unnavigable heap.

### The nesting relationship
Each level *contains* the level below and *belongs to* the level above:

```
Enterprise         contains Domains
  Domain           contains Capabilities,   belongs to Enterprise
    Capability     contains Sub-Capabilities, belongs to a Domain
      Sub-Capability                         belongs to a Capability
```

Containment is strict: a node has exactly one parent, and the tree does not cross-link between branches ([classification rules](11-capability-classification-rules.md)).

### Why Sub-Capabilities are necessary
A single capability is often internally rich — one ability with several distinct facets. The **Sub-Capability** level captures those facets *without splitting the capability into several capabilities*:
- It lets a capability be described at finer grain while still being *one* ability.
- It supports finer measurement — assessing facets of an ability, not just the ability whole ([capability principles](02-capability-principles.md)).
- It keeps the Capability level clean: facets go *inside* a capability as sub-capabilities, rather than inflating the capability count.

A sub-capability is still a capability concept — independent of org/process/agent ([05](05-capability-vs-agent.md)) — just at a finer grain.

### Depth is bounded to four levels
The taxonomy is deliberately four levels (Enterprise → Domain → Capability → Sub-Capability). Sub-capabilities are not further subdivided into sub-sub-capabilities in this architecture; deeper detail is realization (process/agent), not taxonomy ([capability boundaries](12-capability-boundaries.md)). Bounded depth keeps the model reasoning-friendly.

## Architecture

- **Parent/child edges** — strict single-parent containment across the four levels.
- **Granularity gradient** — broad (domain) → distinct (capability) → facet (sub-capability).
- **No cross-branch links** — the taxonomy is a tree, not a graph.
- **Bounded depth** — exactly four levels.

## Enterprise Examples

*Illustrative of nesting only — not a catalog.*

- Structurally: a broad domain contains several distinct capabilities; a distinct capability contains a few sub-capabilities (its facets). The *shape* is shown; no concrete domain, capability, or sub-capability is defined.
- The value of the sub-capability level: a rich ability can be described by its facets while remaining counted as one capability.

## Design Principles

- **One parent per node.** Strict containment; no cross-links.
- **Sub-capability = facet, not a new capability.** Keep facets inside the capability.
- **Four levels, bounded.** Deeper than sub-capability is realization, not taxonomy.

## Boundaries

- Defines the **hierarchy structure**, not any node or catalog.
- No process, agent, workflow, code, prompt, UI, or execution.

## Future Evolution

Later phases populate the hierarchy — real domains, capabilities, and their sub-capabilities — under strict single-parent containment. This phase fixes the nesting and the four-level bound; it names no node.
