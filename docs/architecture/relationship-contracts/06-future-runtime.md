# 06 — Future Runtime

How future runtime is expected to interact with relationship contracts — at the **architectural level only**. This document defines no APIs, no storage, no database, no graph engine, and no implementation. It describes the interaction shape and its boundaries, nothing more.

## The consumption boundary

Runtime is a **consumer** of relationship contracts, never an author. The contract layer defines the vocabulary; runtime reads it. This boundary is the single most important architectural fact about the interaction, and everything below follows from it.

```
Canonical Relationship Contracts   (definitions — authoritative, immutable)
              ▲   read-only
              │
Runtime                            (consumes: traverses, analyzes, reasons)
```

The arrow points one way. Contracts do not depend on runtime; runtime depends on contracts. No runtime path adds, redefines, or reinterprets a relationship type.

## What runtime does with contracts

At the architectural level, runtime interaction falls into three read-only modes:

- **Resolution.** Given a relationship type, runtime resolves its meaning, direction, and multiplicity from the contract — never from local assumption.
- **Traversal.** Runtime follows edges that conform to contracts, per the documented [traversal patterns](../relationship-graph/04-traversal-patterns.md). It reads the graph; it does not reshape it.
- **Reasoning.** Runtime layers impact and dependency analysis on top of traversal, consuming the contracts as the fixed vocabulary those analyses are expressed in.

All three are read-only with respect to the contract vocabulary. Edge lifecycle (creating, effective-dating, retiring edges) is a separate, gated concern and still conforms to the contracts it references.

## Guarantees the boundary provides

- **Determinism.** Because the vocabulary is fixed and closed, runtime behavior over it is reproducible — the same graph and traversal yield the same result.
- **Auditability.** Because runtime cannot invent relationships, every edge it acts on traces to a ratified contract and a provenance record.
- **Isolation.** Because contracts are inert and infrastructure-free, runtime consuming them inherits no coupling to storage or transport at the contract layer.
- **Stability under change.** Because contracts version rather than mutate, runtime written against a contract keeps working until that contract is deprecated on a documented path.

## What is deliberately not specified here

This document does not decide, and must not be read as deciding:

- How the graph is stored or indexed.
- Whether traversal is a query, an in-memory walk, or otherwise.
- Any API surface, endpoint, or protocol.
- Any database or graph-engine technology.
- Any algorithm for traversal, validation, or analysis.

Those are implementation decisions for the phases after the Director gate, made contracts-first and verified per the [Capability Lifecycle](../../architecture-backlog/00-capability-lifecycle.md). This phase fixes only the **interaction contract**: runtime consumes canonical relationships, read-only, and never invents them.
