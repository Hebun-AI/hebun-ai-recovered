# 25 — Upstream and Downstream

## Purpose

Define the directional vocabulary of the Capability Network: **Upstream Capability** (one that others depend on) and **Downstream Capability** (one that depends on others). Direction is what makes the dependency graph readable — it tells you which way reliance flows and therefore how risk and change propagate.

## Core Concepts

### Upstream — depended upon
A capability is **Upstream** relative to another when the other relies on it. Upstream capabilities are foundational: they provide an ability that downstream capabilities build on. The more downstream capabilities that point to an upstream node, the more load-bearing it is ([critical capabilities](28-critical-capabilities.md)).

### Downstream — depends upon
A capability is **Downstream** relative to another when it relies on that other. Downstream capabilities are consumers of upstream abilities; they cannot be fully exercised unless their upstream dependencies are present ([dependency model](24-dependency-model.md)).

### Direction is relative
Upstream and downstream are *relational*, not absolute labels. A capability can be downstream of one capability and upstream of another — it consumes some abilities and provides for others. A node's position is defined by its edges, not by a fixed rank.

### Why direction matters — propagation
Direction determines how two things travel through the network:
- **Risk propagates downstream.** If an upstream capability is weak or fails, every downstream capability that depends on it is at risk. Weakness flows *with* the dependency direction.
- **Demand propagates upstream.** A downstream capability's need pulls on its upstream dependencies. Load flows *against* the dependency arrow.

Reading direction is how the enterprise reasons about blast radius ([enterprise thinking](06-enterprise-thinking.md)): what breaks if this ability weakens, and what this ability leans on.

### Direction is ability-level
Upstream/downstream describe reliance among *abilities*, not execution order or call direction. A capability being "upstream" says nothing about when work runs — it is a structural position in the ability graph ([capability boundaries](12-capability-boundaries.md)).

## Architecture

- **Upstream set** — for a node, the capabilities it depends on.
- **Downstream set** — for a node, the capabilities that depend on it.
- **Relative positioning** — a node is upstream/downstream only with respect to another.
- **Propagation semantics** — risk flows downstream; demand flows upstream.

## Enterprise Examples

*Illustrative of direction only — not a real graph.*

- A foundational ability that many others build on sits *upstream* of them; those others are *downstream*. If the upstream ability weakens, the downstream ones are exposed. This phase defines the vocabulary; it positions no actual capability.

## Design Principles

- **Direction is relative.** Upstream/downstream depend on the edge, not a fixed rank.
- **Risk flows downstream; demand flows upstream.** Read direction to find blast radius.
- **Direction is structural, not execution order.**

## Boundaries

- Defines **upstream/downstream vocabulary**, not any real graph or capability.
- No execution order, workflow, process, agent, code, UI, or prompt.

## Future Evolution

Later phases use direction to analyze the real network — tracing blast radius and load paths for structural-risk reasoning. This phase fixes the directional vocabulary and its propagation semantics.
