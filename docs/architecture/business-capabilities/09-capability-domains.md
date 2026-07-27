# 09 — Capability Domains

## Purpose

Define the **Capability Domain** — the top grouping level of the taxonomy, directly beneath the Enterprise. This document establishes what a domain is, how it differs from a capability, and why grouping capabilities into domains is architecturally necessary. It defines the *concept* of a domain, not any concrete domain.

## Core Concepts

### A domain is a broad area of ability
A Capability Domain is a **grouping of related capabilities** — a broad area of what the enterprise can do. It is one level of abstraction above a capability: a domain contains capabilities; it is not itself a single ability.

### Domain vs Capability — the key difference
- **A capability is a single, distinct ability** ([what is a capability](01-what-is-a-business-capability.md)) — one *can*.
- **A domain is a grouping of such abilities** — a category, not an ability. A domain does not pass the "state one ability" test because it is not one ability; it is a container for many.

Confusing the two flattens the taxonomy: treating a domain as a capability makes it too coarse to reason about; treating a capability as a domain makes it a container it cannot fill. The levels are distinct kinds of thing.

### Why domains are necessary
- **Navigation.** Dozens or hundreds of capabilities need broad categories to be found and understood.
- **Reasoning at altitude.** Enterprise reasoning often operates at the domain level ("how strong are we in this whole area?") before drilling to individual capabilities ([enterprise thinking](06-enterprise-thinking.md)).
- **Growth without collision.** New capabilities attach under a domain, keeping the model organized as it expands ([taxonomy design principles](14-taxonomy-design-principles.md)).

### Domains are organization-independent
A Capability Domain is **not** a department. A domain groups *abilities*; a department is a *who* ([capability vs department](03-capability-vs-department.md)). A domain name may coincide with a familiar business area, but the domain is a category of capabilities, not an org unit. Reorganizing the company does not change the domain structure of its abilities.

## Architecture

- **Domain node** — a named grouping directly under the Enterprise root.
- **Membership** — capabilities belong to exactly one domain ([classification rules](11-capability-classification-rules.md)).
- **Domain boundary** — what separates one domain from another cleanly ([capability boundaries](12-capability-boundaries.md)).
- **Independence** — the domain, like its capabilities, is org-, process-, and agent-independent.

## Enterprise Examples

*Illustrative of the level only — not a catalog.*

- The *kind* of thing a domain is: a broad area such as Marketing, Finance, Sales, HR, or Operations. These are named **only** to show what altitude a domain sits at. This phase defines none of them and builds no domain map.
- Structurally: one domain groups multiple capabilities; the enterprise root groups multiple domains.

## Design Principles

- **A domain groups; it is not an ability.** Keep domain and capability levels distinct.
- **Domains are categories of abilities, not departments.** Never define a domain as an org unit.
- **One home per capability.** Each capability belongs to exactly one domain.

## Boundaries

- Defines the **domain concept**, not any domain or catalog.
- No department catalog, workflow, process, agent, code, prompt, UI, or execution.

## Future Evolution

Later phases define the enterprise's actual domains and assign capabilities to them, preserving independence and single-home membership. This phase fixes what a domain *is* and why it exists; it names none.
