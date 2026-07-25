# 01 — Overview

## Purpose

The Organizational Relationship Graph defines how Hebun's canonical entities relate to one another. Phase 5A established the entities — Organization, Party, Role, Capability, and the rest. This phase defines the **edges between them**: a single, canonical model of who belongs to what, who is responsible for what, and what depends on what.

The graph is the connective tissue of Organizational Intelligence. Without it, the platform holds a set of accurate but isolated records. With it, the platform can answer relational questions: *what does this capability depend on, who is accountable for this department, what breaks if this agent goes offline.*

## Why a graph, not isolated entities

An organization is not a table. Its meaning lives in the connections — reporting lines, ownership, delegation, membership. Modeling these as isolated entities with embedded foreign keys scatters the same relationship across many records and makes cross-cutting questions expensive and inconsistent.

A graph makes relationships **first-class and explicit**:

- **One place per relationship.** An edge is stated once, not duplicated on both endpoints.
- **Uniform reasoning.** Every relationship is the same kind of object, so traversal and analysis work the same way regardless of which entities are involved.
- **Cross-cutting questions become traversals.** Impact, dependency, and accountability are paths through the graph, not bespoke queries against many tables.

Phase 5A already anticipated this: `OrganizationalRelationship` is a canonical contract — an inert, declarative edge descriptor with typed source and target references. This phase designs the graph that those edges compose into.

## Core concepts

### Nodes

A node is a canonical entity acting as a graph vertex. Every node is one of the Phase 5A contracts, referenced by canonical id within a workspace scope. Nodes carry no graph behavior themselves; they are the endpoints edges connect. Node types are catalogued in [02 — Node Types](02-node-types.md).

### Relationships

A relationship is a typed, directed edge between two nodes. It names *how* the source relates to the target — `belongs_to`, `owns`, `reports_to`. Relationships are explicit, canonical, and carry their own effective period, lifecycle, and provenance. The relationship vocabulary is defined in [03 — Relationship Types](03-relationship-types.md).

### Traversal

Traversal is following edges from a starting node to reach related nodes. It is the mechanism beneath every relational question. Common paths — organization to people, capability to supporting agent — are documented as reusable patterns in [04 — Traversal Patterns](04-traversal-patterns.md). Traversal is read-only and deterministic.

### Reasoning

Reasoning is interpretation layered on top of traversal. Where traversal returns *which nodes are connected*, reasoning answers *what that connection means* — accountability, coverage, risk. Reasoning consumes the graph; it never mutates it. The graph is the substrate that later capabilities (Director reasoning, simulation, learning) reason over.

### Impact analysis

Impact analysis asks: *if this node or edge changes, what downstream nodes are affected?* It is reverse-and-forward traversal from a change point, surfacing everything that depends on the changed element. Detailed in [05 — Impact Analysis](05-impact-analysis.md).

### Dependency analysis

Dependency analysis is the complement: *what does this node rely on to function?* It follows `depends_on`, `uses`, and `supports` edges to assemble the set a node needs. Together, impact and dependency analysis let the platform reason about change before it happens.

## Scope of this phase

This phase is **architecture design only**. It defines node and relationship semantics, traversal and analysis patterns, and the principles that keep the graph coherent. It does **not** define contracts, runtime, storage, or APIs. Implementation waits for the Director gate and follows the [Capability Lifecycle](../../architecture-backlog/00-capability-lifecycle.md): contracts before runtime, runtime before interface.
