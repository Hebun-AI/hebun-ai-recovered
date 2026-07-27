# 29 — Network Design Rules

## Purpose

Consolidate the rules governing the Enterprise Capability Network — the standard the network must obey as it is populated and evolved — and define **Network Evolution**, how the network changes over time. This document is the capstone of Phase 10D.

## Core Concepts

The network is only useful if it stays coherent as capabilities and edges are added. These rules define a well-formed network and how it may grow, closing the network layer.

## Architecture

### The network rules

#### N1 — Nodes are meta-model-conforming capabilities
Every node is a capability conforming to the meta model ([15](15-capability-meta-model.md)) — all twelve fields, ability-level, independent. No node is a department, process, or agent.

#### N2 — Edges are structural dependencies through interfaces
Every edge is a directed structural dependency ([dependency model](24-dependency-model.md)) connecting through the upstream capability's interface ([capability interfaces](26-capability-interfaces.md)) — never reaching into internals.

#### N3 — The graph is directed and acyclic
No circular dependencies. A cycle signals a boundary error to resolve, not encode ([dependency model](24-dependency-model.md)).

#### N4 — Every node belongs to exactly one domain
The domain partition holds ([capability domains](09-capability-domains.md)); cross-domain edges are explicit boundary crossings ([network boundaries](27-network-boundaries.md)).

#### N5 — Boundary crossings are explicit and interface-based
Cross-domain dependencies are recognized, deliberate, through interfaces, and boundary-respecting ([network boundaries](27-network-boundaries.md)). Minimize gratuitous coupling between domains.

#### N6 — Criticality and SPOF are derived, not declared
A node's criticality and single-point-of-failure status are computed from the graph structure ([critical capabilities](28-critical-capabilities.md)), never asserted on a node in isolation.

#### N7 — The network is ability-level, not runtime
Nodes, edges, interfaces, and crossings describe reliance among abilities — never calls, flows, or execution ([capability network](23-capability-network.md)).

#### N8 — No real graph in this phase
These rules govern the network defined *later*. This phase plots **no** nodes and **no** edges, and builds no capability catalog.

### Network Evolution

**Network Evolution** governs how the network changes over time:

- **Additive growth is normal.** New capability nodes and their dependency edges attach into the existing network without reshaping it ([capability stability](13-capability-stability.md)). The network grows mostly by addition.
- **Edge changes are deliberate.** Adding or removing a dependency changes the structure of reliance and is a governed, Director-visible act ([capability governance](21-capability-governance.md)) — not a silent rewiring.
- **Acyclicity is preserved through evolution.** No change may introduce a cycle; a proposed edge that would create one exposes a boundary error to resolve first.
- **Criticality shifts are watched.** As the network evolves, nodes may become more or less critical, and new SPOFs may emerge; evolution is where structural risk is re-checked ([critical capabilities](28-critical-capabilities.md)).
- **Realization change is not network change.** Rewriting a process or swapping an agent does not change the network ([capability vs process](04-capability-vs-process.md), [capability vs agent](05-capability-vs-agent.md)); the network evolves only when *ability reliance* changes.

## Enterprise Examples

*Illustrative of the rules only — not a real graph.*

- **Rule check:** an edge reaching into a capability's internals fails N2; a proposed edge creating a cycle fails N3; a criticality claim on an isolated node fails N6.
- **Evolution:** adding a new capability with its dependencies is routine; removing a dependency is deliberate and governed; swapping an agent changes nothing in the network.

## Design Principles

- **Conforming nodes, interface-based acyclic edges, one-domain membership.**
- **Derive criticality; don't declare it.**
- **Grow additively; rewire deliberately; keep it acyclic.**

## Boundaries

- Defines **network rules and evolution**, not any real graph or capability.
- No workflow, process, agent, execution, code, UI, or prompt.

## Future Evolution

Phase 10E and later populate and analyze the real network under these rules — and eventually attach realization below it and Enterprise Intelligence above it, behind the Director gate. The rules fixed here govern the capability network for the enterprise's life.
