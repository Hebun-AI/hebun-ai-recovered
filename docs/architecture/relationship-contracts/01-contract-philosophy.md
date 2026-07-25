# 01 — Contract Philosophy

## Why relationships are contracts

A relationship in Hebun is not an incidental link that code creates in passing. It is a **declared, canonical fact** about how the organization is structured. Treating relationships as contracts means every relationship type has a fixed identity, a fixed meaning, and a single authoritative definition that every part of the platform shares.

The alternative — letting each component define relationships as it needs them — produces drift: the same relationship modeled three ways in three places, none authoritative. Contracts eliminate that. One definition, shared, canonical.

This mirrors Phase 5A, where entities became inert, immutable contracts. Relationships receive the same treatment: they are first-class canonical objects, not runtime conveniences.

## Why relationships are immutable definitions

A relationship contract, once ratified, does not change meaning. `reports_to` means the same thing next year as today. Immutability at the definition level is what makes the graph trustworthy over time — a traversal written against `owns` today keeps working because `owns` cannot be silently redefined.

Immutability applies to the **definition**, not to the individual edges. Edges are created, effective-dated, and retired as the organization changes. What stays fixed is the contract those edges conform to. The vocabulary is stable; the graph built from it is live.

When a relationship genuinely must change meaning, that is not a mutation — it is a new versioned contract and a deprecation of the old one, recorded. See [04 — Contract Lifecycle](04-contract-lifecycle.md).

## Why runtime consumes contracts instead of inventing them

Runtime reads relationship contracts; it does not author them. This inversion is deliberate and load-bearing:

- **Consistency.** Every runtime path interprets a relationship the same way, because they all read the same contract.
- **Auditability.** Because runtime cannot invent relationships, every edge in the graph traces to a ratified contract and a provenance record.
- **Safety.** Reasoning, simulation, and impact analysis can trust the vocabulary is closed and defined. There are no undocumented relationship types to account for.

Runtime that could invent relationships would be runtime that could quietly corrupt the organizational model. The contract boundary prevents that by construction.

## Core qualities

### Stability

The relationship vocabulary changes slowly and deliberately. Stability is a feature: consumers — traversals, analyses, future capabilities — depend on names meaning what they meant. A stable vocabulary is what lets the graph accumulate value rather than churn.

### Versioning philosophy

Change is handled by versioning, not mutation. A contract that must evolve is superseded by a new version; the old version deprecates on a defined path. Nothing is edited in place. Versioning is the mechanism that reconciles the need for stability with the reality of change. Detailed rules are in [03 — Contract Guidelines](03-contract-guidelines.md).

### Auditability

Every relationship contract and every edge conforming to it carries provenance — origin, authorship, time — exactly as Phase 5A models. The full history of a relationship type and of any edge is recoverable. Nothing about a relationship is untraceable.

### Canonical ownership

Each relationship contract has one authoritative home in the canonical layer. It is owned there, not duplicated across features. Consumers reference it; they do not copy it. Single canonical ownership is what makes "the graph is canonical" ([design principle](../relationship-graph/06-design-principles.md)) enforceable at the contract level.
