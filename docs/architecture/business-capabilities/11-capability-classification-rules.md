# 11 — Capability Classification Rules

## Purpose

Give the rules for classifying capabilities within the taxonomy — how to decide what is a domain, what is a capability, what is a sub-capability, and where any given ability belongs. These rules keep the taxonomy consistent as it is populated later. They classify; they define no capability.

## Core Concepts

The classification rules operationalize the taxonomy ([08](08-enterprise-capability-taxonomy.md)) and hierarchy ([10](10-capability-hierarchy.md)) into decidable tests, so that whoever later populates the model places each node correctly and unambiguously.

## Architecture

### The rules

#### C1 — Classify by altitude
Decide the level by breadth of ability:
- **Domain** — a broad *area* grouping abilities (not one ability).
- **Capability** — a single distinct ability (Phase 10A).
- **Sub-Capability** — a facet within one ability.
Pick the level that matches the breadth, not convenience.

#### C2 — One home per node
Every node has exactly one parent. A capability belongs to exactly one domain; a sub-capability to exactly one capability ([capability hierarchy](10-capability-hierarchy.md)). No node lives in two places.

#### C3 — Domain is a container, capability is an ability
If a candidate groups several abilities, it is a domain. If it states one ability, it is a capability. If it names one ability, use it as a capability — never as a domain, and never inflate a capability into a domain ([capability domains](09-capability-domains.md)).

#### C4 — Sub-capability is a facet, not a split
If a facet is *part of* one ability, make it a sub-capability inside that capability. Do not promote a facet to a full capability just to give it visibility ([capability hierarchy](10-capability-hierarchy.md)).

#### C5 — Preserve Phase 10A independence at every level
Every node — domain, capability, sub-capability — must be organization-, process-, and agent-independent ([02](02-capability-principles.md)). If placing a node requires naming a department, process, or agent, the classification is wrong ([03](03-capability-vs-department.md), [04](04-capability-vs-process.md), [05](05-capability-vs-agent.md)).

#### C6 — No overlap between siblings
Sibling nodes do not claim the same ability. Domains do not overlap; capabilities within a domain do not overlap; sub-capabilities within a capability do not overlap ([capability boundaries](12-capability-boundaries.md)).

#### C7 — Classify by ability, not by realization
Place a node by *what ability it is*, never by who performs it, how, or with which agent. Realization is not a classification axis.

#### C8 — Build no catalog here
These rules govern *how* to classify later. This phase classifies **nothing** — it creates no domains, capabilities, or sub-capabilities.

## Enterprise Examples

*Illustrative of applying the rules — not a catalog.*

- **Altitude check (C1/C3):** a candidate grouping many abilities → domain; a candidate stating one ability → capability; a facet of one ability → sub-capability.
- **Independence check (C5):** a candidate that only makes sense as "the X department's work" fails — it is org, not a capability node.
- **Overlap check (C6):** two sibling nodes claiming the same ability must be merged or re-scoped.

## Design Principles

- **Altitude decides the level.** Breadth of ability, not convenience.
- **One home, no overlap.** Strict single-parent, non-overlapping siblings.
- **Independence is non-negotiable at every level.**

## Boundaries

- Gives **classification rules**; classifies no capability and builds no catalog.
- No process, agent, workflow, code, prompt, UI, or execution.

## Future Evolution

Later phases apply these rules to populate the taxonomy — every node placed by altitude, single-home, non-overlapping, and independent. The rules fixed here are the standard that population is held to.
