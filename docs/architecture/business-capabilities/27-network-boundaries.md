# 27 — Network Boundaries

## Purpose

Define **Boundary Crossing** in the Capability Network — what it means for a dependency edge to cross from one capability domain to another, and the rules that keep such crossings clean. Cross-domain dependencies are where a capability network is most at risk of becoming tangled; this document defines how they stay coherent.

## Core Concepts

### Domains partition the network
The taxonomy groups capabilities into domains ([capability domains](09-capability-domains.md)). In the network, domains partition the nodes: each capability belongs to exactly one domain. Most dependencies live *within* a domain; some cross *between* domains.

### A Boundary Crossing is a cross-domain dependency
A **Boundary Crossing** is a dependency edge whose two endpoints live in different capability domains — capability A in domain X depends on capability B in domain Y. Crossings are legitimate and expected (domains are not isolated), but they carry more structural weight than within-domain edges: they couple whole areas of the enterprise's ability model.

### Why crossings need rules
Uncontrolled cross-domain dependencies produce a tangled network where every domain leans on every other, destroying the value of domain partitioning. Rules keep crossings intentional and visible:
- **Crossings are through interfaces.** A cross-domain dependency connects through the upstream capability's interface ([capability interfaces](26-capability-interfaces.md)), never through its internals.
- **Crossings are explicit.** A boundary-crossing edge is a recognized, deliberate structural fact — not an accidental reach into another domain.
- **Crossings respect domain boundaries.** A crossing depends on a capability in another domain; it does not absorb, own, or reach around that domain ([capability boundaries](12-capability-boundaries.md)).

### Crossings and criticality
Boundary crossings often mark the most critical edges: an upstream capability depended on *across domains* is load-bearing for the whole enterprise, not just its own domain ([critical capabilities](28-critical-capabilities.md)). Crossings are prime spots to check for single points of failure.

### Crossings are ability-level
A boundary crossing is a structural dependency between abilities in different domains — not a runtime integration, message route, or execution handoff. It says nothing about how work flows; it is a map-level fact ([capability network](23-capability-network.md)).

## Architecture

- **Domain partition** — every node in exactly one domain.
- **Within-domain edge** — dependency inside one domain.
- **Boundary Crossing** — dependency edge between two domains.
- **Crossing rules** — through interfaces, explicit, boundary-respecting.
- **Criticality flag** — crossings are candidate critical/SPOF edges.

## Enterprise Examples

*Illustrative of crossings only — not a real graph.*

- A capability in one broad area relying on a capability in another broad area is a boundary crossing — legitimate, but weighty and to be made explicit. This phase defines the crossing concept and rules; it maps no actual domains or crossings.

## Design Principles

- **Crossings through interfaces, explicit, boundary-respecting.**
- **Minimize gratuitous crossings.** Keep domains loosely coupled.
- **Crossings are ability-level, not runtime integration.**

## Boundaries

- Defines **boundary-crossing rules**, not any real graph, domain, or capability.
- No integration, workflow, process, agent, execution, code, UI, or prompt.

## Future Evolution

Later phases identify real boundary crossings and analyze the coupling they create for structural-risk reasoning. This phase fixes what a crossing is and the rules that keep cross-domain dependencies clean.
