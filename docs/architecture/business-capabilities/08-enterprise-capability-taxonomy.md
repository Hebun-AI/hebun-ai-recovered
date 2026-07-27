# 08 — Enterprise Capability Taxonomy

## Purpose

Define the architectural classification that organizes business capabilities at enterprise scale. Phase 10A defined *what a capability is*; this document defines *how capabilities are organized* — the taxonomy that turns a flat set of abilities into a coherent, navigable enterprise ability model. It defines the classification structure, not a list of capabilities.

## Core Concepts

### A taxonomy organizes; it does not enumerate
The taxonomy is the *scheme* by which capabilities are grouped and related. It is not the capabilities themselves. This phase builds the shelving, not the books — no capability catalog is created ([capability classification rules](11-capability-classification-rules.md)).

### Why a taxonomy is necessary
A real enterprise has many abilities. A flat, unorganized set is unusable: you cannot navigate it, reason over it, find gaps in it, or grow it without collision. A taxonomy gives the ability model **structure** — grouping, hierarchy, and boundaries — so the enterprise can locate, compare, and extend its capabilities coherently ([enterprise thinking](06-enterprise-thinking.md)).

### The four-level model
The taxonomy is a hierarchy of exactly four kinds of level:

```
Enterprise
   └── Capability Domain      (a broad area of ability)
         └── Capability        (a distinct ability — Phase 10A)
               └── Sub-Capability   (a constituent facet of a capability)
```

- **Enterprise** — the whole company; the root of the ability model.
- **Capability Domain** — a broad grouping of related capabilities ([capability domains](09-capability-domains.md)).
- **Capability** — a single distinct ability, as defined in Phase 10A ([what is a capability](01-what-is-a-business-capability.md)).
- **Sub-Capability** — a finer-grained facet *within* a capability ([capability hierarchy](10-capability-hierarchy.md)).

### The taxonomy inherits Phase 10A independence
Every node in the taxonomy is still a capability concept: organization-, process-, and agent-independent ([capability principles](02-capability-principles.md)). Organizing capabilities does not bind them to who/how/which. The taxonomy is a classification of *abilities*, not of departments, processes, or agents.

## Architecture

- **Root** — the Enterprise node.
- **Domain layer** — broad areas grouping capabilities.
- **Capability layer** — distinct abilities (Phase 10A nodes).
- **Sub-capability layer** — facets within a capability.
- **Classification scheme** — the rules assigning any capability to exactly one place ([classification rules](11-capability-classification-rules.md)).
- **Boundaries** — what separates domains, capabilities, and sub-capabilities cleanly ([capability boundaries](12-capability-boundaries.md)).

The taxonomy is a tree of ability-concepts under the enterprise, orthogonal to the organizational hierarchy of Phase 9.

## Enterprise Examples

*Illustrative of the structure only — not a catalog.*

- Broad domain names such as Marketing, Finance, Sales, HR, or Operations may be *mentioned* as the kind of thing a Capability Domain is. This phase defines **no** such domains and builds no map of them — they are named only to illustrate the *level*, not to enumerate it.
- Structurally: a domain groups several capabilities; a capability decomposes into sub-capabilities. The shape is illustrated; the content is not defined.

## Design Principles

- **Structure, don't enumerate.** Build the scheme; list no capabilities.
- **Four levels, no more.** Enterprise → Domain → Capability → Sub-Capability.
- **Independence survives classification.** Organizing capabilities never binds them to org/process/agent.

## Boundaries

- Defines the **classification scheme**, not any capability, domain, or catalog.
- No workflow, process, agent, code, prompt, UI, or execution.

## Future Evolution

Later phases populate the taxonomy with real domains, capabilities, and sub-capabilities — each placed by the classification rules, each preserving independence. This phase fixes the *scheme*; the population comes later, behind the Director gate.
