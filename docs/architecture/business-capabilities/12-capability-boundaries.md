# 12 — Capability Boundaries

## Purpose

Define the boundaries within the taxonomy — what separates one domain from another, one capability from another, and a capability from its sub-capabilities — and the outer boundary that separates the taxonomy from realization (process/agent). Clean boundaries are what keep the ability model coherent as it grows.

## Core Concepts

### Boundaries make the taxonomy coherent
A taxonomy is only useful if each node has a clear edge: you can tell what belongs inside it and what does not. Without boundaries, domains bleed into each other, capabilities overlap, and the model becomes ambiguous. Boundaries are the edges that make classification decidable ([classification rules](11-capability-classification-rules.md)).

### The internal boundaries

- **Domain–Domain.** Domains are non-overlapping areas of ability. An ability sits in one domain, not two.
- **Capability–Capability.** Capabilities within a domain are distinct, non-overlapping abilities. Two capabilities do not claim the same *can*.
- **Capability–Sub-Capability.** A sub-capability is *inside* one capability, a facet of it — never a peer of the capability and never shared across capabilities ([capability hierarchy](10-capability-hierarchy.md)).

### The outer boundary — taxonomy vs realization
The taxonomy stops at ability. Below sub-capability lies **realization** — process (how) and agent (which AI) — which is *not* part of the taxonomy ([capability vs process](04-capability-vs-process.md), [capability vs agent](05-capability-vs-agent.md)). The taxonomy classifies *what the enterprise can do*; it never descends into *how* or *which*. This outer boundary is what keeps the four-level model from leaking into execution.

### Boundaries preserve independence
Every boundary is drawn in terms of *ability*, never in terms of org, process, or agent. A domain boundary is not a department boundary; a capability boundary is not a process boundary. Drawing boundaries by ability keeps the whole taxonomy organization-, process-, and agent-independent ([capability principles](02-capability-principles.md)).

## Architecture

- **Sibling exclusivity** — non-overlapping nodes at every level.
- **Containment edge** — a node lies wholly within its single parent.
- **Realization floor** — the taxonomy bottoms out at sub-capability; process/agent are below the floor and out of scope.
- **Ability-only edges** — boundaries expressed as abilities, never as who/how/which.

## Enterprise Examples

*Illustrative of boundaries only — not a catalog.*

- **Non-overlap:** two candidate domains that share abilities violate the domain boundary and must be re-scoped.
- **Realization floor:** the point where description turns into "here are the steps" or "here is the agent" is *below* the taxonomy — it is process/agent, not a deeper taxonomy level.

## Design Principles

- **Every node has a clear edge.** If you can't tell what's inside, the boundary is wrong.
- **Non-overlapping siblings, single-parent containment.**
- **Stop at ability.** Process and agent are below the taxonomy floor.

## Boundaries

- Defines **taxonomy boundaries**, not any node or catalog.
- No process, agent, workflow, code, prompt, UI, or execution.

## Future Evolution

Later phases place real nodes within these boundaries — non-overlapping, single-parent, stopping cleanly at the realization floor. When the process and agent layers are built, they attach *below* the floor, never inside the taxonomy. The boundaries fixed here hold as the model grows.
