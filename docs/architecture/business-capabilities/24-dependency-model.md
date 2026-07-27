# 24 — Dependency Model

## Purpose

Define the **Dependency Graph** — the edges of the Enterprise Capability Network — and what a **Structural Dependency** between two capabilities means. Phase 10C gave each capability a Dependencies field; this document defines the graph those fields form and the rules edges must obey. It defines the model, not any real dependency graph.

## Core Concepts

### A Structural Dependency is ability reliance
A **Structural Dependency** is an edge saying "capability A requires capability B to be present in order for A to be exercised" ([dependencies](19-capability-dependencies.md)). It is *structural* because it is a standing property of the abilities — not a runtime call, not a data flow, not an execution step. A depends on B because the ability A rests on the ability B.

### The Dependency Graph
The set of all structural dependencies forms the **Dependency Graph**: a directed graph over capability nodes. It is the backbone of the Capability Network ([23](23-capability-network.md)) — the structure that reveals load-bearing abilities, chains of reliance, and risk concentration.

### Directed and acyclic
- **Directed** — every edge has a direction: from the depending capability to the depended-on capability (downstream → upstream, [upstream and downstream](25-upstream-and-downstream.md)).
- **Acyclic** — the graph should contain no cycles. A cycle (A needs B, B needs A) means the two are really one ability or a boundary is mis-drawn ([meta-model design rules](22-meta-model-design-rules.md)). Cycles are resolved, not encoded.

### Dependencies are ability-to-ability only
Edges connect capabilities to capabilities — never to departments, processes, or agents ([capability vs department](03-capability-vs-department.md), [capability vs process](04-capability-vs-process.md), [capability vs agent](05-capability-vs-agent.md)). A capability does not "depend on" a unit that performs it or an agent that runs it; those are realization, below the graph.

### Dependency strength is structural, not operational
A dependency's importance is derived from the graph — how many capabilities rely on a node, how central it is — not from runtime traffic ([critical capabilities](28-critical-capabilities.md)). Structure, not volume, defines significance at this layer.

## Architecture

- **Edge** — a directed structural dependency between two capability nodes.
- **Dependency Graph** — the directed acyclic graph of all such edges.
- **Direction** — depending → depended-on (downstream → upstream).
- **Acyclicity rule** — no circular dependencies.
- **Ability-only endpoints** — both ends are capabilities.

## Enterprise Examples

*Illustrative of the model only — not a real graph.*

- A chain of reliance (C relies on B, B relies on A) illustrates a directed dependency path; a node many others point to illustrates a load-bearing capability. This phase defines the edge and graph rules; it draws no actual dependencies.

## Design Principles

- **Dependencies are structural, not runtime.** Reliance among abilities, not calls.
- **Directed and acyclic.** No cycles; resolve boundary errors instead.
- **Ability-to-ability only.** No org/process/agent endpoints.

## Boundaries

- Defines the **dependency model**, not any real graph or capability.
- No data flow, workflow, process, agent, execution, code, UI, or prompt.

## Future Evolution

Later phases populate the real dependency graph for structural-risk reasoning. This phase fixes what an edge means and the directed-acyclic, ability-only rules it must obey.
