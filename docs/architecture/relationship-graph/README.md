# Organizational Relationship Graph — Architecture Design

## Purpose

This is the architecture design for Hebun's Organizational Relationship Graph — the model that defines **how** the canonical entities from Phase 5A relate to one another. Phase 5A built the entities; this design defines the edges between them and the reasoning those edges enable.

It is **design only**. It defines node and relationship semantics, traversal and impact-analysis patterns, and the principles that keep the graph coherent. It defines no contracts, no runtime, no storage, and no APIs.

## Documents

| Document | Covers |
|---|---|
| [01 — Overview](01-overview.md) | Purpose of the graph; why a graph over isolated entities; nodes, relationships, traversal, reasoning, impact, dependency |
| [02 — Node Types](02-node-types.md) | Every canonical node: purpose, primary relationships, expected graph behavior |
| [03 — Relationship Types](03-relationship-types.md) | Canonical edge vocabulary: description, direction, multiplicity, examples; alignment with the Phase 5A enum |
| [04 — Traversal Patterns](04-traversal-patterns.md) | Common reusable traversals and their guarantees |
| [05 — Impact Analysis](05-impact-analysis.md) | How graph reasoning surfaces downstream effects of change |
| [06 — Design Principles](06-design-principles.md) | Binding architecture rules for the graph |
| [07 — Future Evolution](07-future-evolution.md) | How future capabilities consume the graph as a stable substrate |

## Relationship Graph lifecycle

This design sits at the **Architecture Design** stage of the [Capability Lifecycle](../../architecture-backlog/00-capability-lifecycle.md). The path forward is fixed:

```
Architecture Design   ← this phase (5B)
        ↓  Director gate
Canonical Contracts   (5B.1 — extend the graph contract, ratify the vocabulary)
        ↓
Runtime Implementation
        ↓
UI / API Integration
        ↓
Verification → Director Approval → Release
```

No stage begins without the prior stage's exit criteria met and explicit Director approval. Contracts precede runtime; runtime precedes interface.

## Relationship to Phase 5A

Phase 5A established the canonical entities and, with `OrganizationalRelationship`, the first typed edge contract. This design **builds on that foundation without altering it**:

- Nodes are exactly the Phase 5A contracts — no new business entities are introduced.
- The relationship vocabulary aligns with the frozen `ORGANIZATIONAL_RELATIONSHIP_TYPES` enum; names that extend it are marked as Phase 5B.1 Candidate Relationship Contracts, not changes made here.
- Every graph edge inherits Phase 5A's inert, immutable, provenance-carrying contract shape.

Nothing in Phase 5A is modified by this phase.

## Relationship to Phase 5B.1

Phase 5B.1 is the **canonical relationship contract** work that follows this design, and begins only after the Director gate. It will:

- Reconcile the design vocabulary with the frozen contract — ratifying aliases and enum extensions as Phase 5B.1 Candidate Relationship Contracts.
- Extend the canonical graph contracts to cover the full node and relationship set defined here.
- Keep traversal and impact analysis as read-only reasoning over the contracts.
- Do so contracts-first, verified at each phase, per the lifecycle.

Phase 6 — Organizational Memory is a separate architectural phase — the Memory Layer — not the relationship contracts. Until Phase 5B.1 begins, this remains a design artifact. No contracts, runtime, tests, or storage are created or changed.
