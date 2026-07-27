# 23 — Enterprise Capability Network

## Purpose

Model business capabilities not as isolated entities but as **nodes in an Enterprise Capability Network**. Phase 10C gave every capability a standard shape, including Dependencies and Consumers ([capability dependencies](19-capability-dependencies.md)). Phase 10D lifts those pairwise links into a first-class network view — the structural relationships among all capabilities, as an enterprise-wide graph. This phase defines the network *concept and rules*; it builds no real graph and no capability catalog.

## Core Concepts

### The enterprise is a network of abilities
No capability stands alone. Each relies on others and is relied upon ([dependencies](19-capability-dependencies.md)). Seen together, the capabilities form a **directed network** — the Enterprise Capability Network — where nodes are capabilities and edges are structural dependencies. This network *is* the structural picture of what the enterprise can do and how its abilities support each other.

### Why the network view matters
Reasoning about capabilities one at a time misses structure: which abilities are load-bearing, which are isolated, where a single weak node threatens many others. The network view makes that structure visible ([enterprise thinking](06-enterprise-thinking.md)) — it is the substrate for structural-risk reasoning, critical-capability identification ([critical capabilities](28-critical-capabilities.md)), and single-point-of-failure detection.

### Nodes and edges
- **Node** — a capability (or, at finer grain, a sub-capability), conforming to the meta model ([15](15-capability-meta-model.md)).
- **Edge** — a structural dependency: "this ability relies on that ability" ([dependency model](24-dependency-model.md)). Edges are directed (upstream → downstream) ([upstream and downstream](25-upstream-and-downstream.md)).

### The network is ability-level, not runtime
Edges are *ability reliance*, not calls, messages, or execution order. The network is a map of how abilities depend on each other, never an execution graph — realization (process/agent) sits below the taxonomy floor ([capability boundaries](12-capability-boundaries.md)). This phase describes no execution.

### The network inherits all prior invariants
Nodes and edges are organization-, process-, and agent-independent ([capability principles](02-capability-principles.md)). The network references capabilities only — never departments, processes, or agents.

## Architecture

- **Capability Network** — the directed graph of all capability nodes and their dependency edges.
- **Node** — a meta-model-conforming capability.
- **Edge** — a directed structural dependency ([24](24-dependency-model.md)).
- **Interfaces** — the points at which capabilities connect ([capability interfaces](26-capability-interfaces.md)).
- **Boundaries** — where the network meets other networks/domains ([network boundaries](27-network-boundaries.md)).
- **Criticality** — network-derived importance of nodes ([28](28-critical-capabilities.md)).

## Enterprise Examples

*Illustrative of the network view only — not a real graph or catalog.*

- The *shape* of the idea: capabilities as nodes, reliance as directed edges; some nodes are depended on by many (load-bearing), others by few. This phase defines the network concept; it plots no actual nodes or edges.

## Design Principles

- **Capabilities are networked, not isolated.** Model the relationships, not just the nodes.
- **Ability-level graph, not runtime.** Edges are reliance, never calls.
- **Reference capabilities only.** No org/process/agent in the network.

## Boundaries

- Defines the **network concept and rules**, not any real graph or capability.
- No process, workflow, agent, execution, code, UI, or prompt.

## Future Evolution

Later phases plot the real network — actual capability nodes and dependency edges — for structural-risk reasoning by Enterprise Intelligence. This phase fixes what the network *is* and the rules it obeys; it plots nothing.
