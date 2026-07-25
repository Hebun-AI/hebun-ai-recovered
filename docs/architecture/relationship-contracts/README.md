# Canonical Relationship Contracts — Architecture Design

## Purpose

This is the architecture design for how Hebun's **relationship contracts** are organized. Phase 5B designed the Relationship Graph — the nodes, edges, and reasoning. This phase (5B.1) defines **how the relationships themselves become canonical contracts**: their philosophy, categories, naming and versioning guidelines, lifecycle, validation principles, and how future runtime consumes them.

It is **design only**. It defines no runtime, no storage, no APIs, no database, and no new canonical enums. It does not modify any existing Phase 5A contract.

## Documents

| Document | Covers |
|---|---|
| [01 — Contract Philosophy](01-contract-philosophy.md) | Why relationships are immutable contracts, not runtime inventions |
| [02 — Contract Categories](02-contract-categories.md) | How relationships are grouped into architectural categories |
| [03 — Contract Guidelines](03-contract-guidelines.md) | Naming, direction, multiplicity, ownership, versioning, compatibility rules |
| [04 — Contract Lifecycle](04-contract-lifecycle.md) | The path a relationship contract travels, proposal to replacement |
| [05 — Validation Principles](05-validation-principles.md) | The invariants future validation must enforce |
| [06 — Future Runtime](06-future-runtime.md) | How runtime consumes contracts, at the architectural level only |

## Relationship to Phase 5A

Phase 5A froze the canonical entities and the first typed edge contract, `OrganizationalRelationship`. This design **builds on that without altering it**. Existing enums are not modified; existing contracts are not renamed. Any relationship named here that extends the frozen enum is a **Phase 5B.1 Candidate Relationship Contract** — a design-level proposal, not a change made in this phase.

## Relationship to Phase 5B

Phase 5B ([relationship-graph](../relationship-graph/README.md)) defined *what* the graph is — its nodes, relationship vocabulary, traversals, and impact analysis. Phase 5B.1 defines *how the relationship vocabulary is governed as contracts*: the discipline that keeps the vocabulary stable, categorized, versioned, and validated. 5B is the map; 5B.1 is the constitution for the edges on it.

## Relationship to Phase 6 — Organizational Memory

Phase 6 — Organizational Memory is a **separate architectural phase — the Memory Layer**. It is not the relationship contracts. The earlier misattribution of relationship-contract work to "Phase 5C" was corrected to Phase 5B.1 across the relationship-graph documentation; the Memory Layer itself was ultimately delivered as Phase 6 — Organizational Memory. The Memory Layer is out of scope here.

## Architecture scope

In scope: contract philosophy, categorization, naming and versioning guidelines, contract lifecycle, validation principles, and architectural runtime interaction.

Out of scope: runtime behavior, storage, database schemas, graph engines, APIs, algorithms, and any new or modified canonical enum. Those follow the Director gate and the [Capability Lifecycle](../../architecture-backlog/00-capability-lifecycle.md) — contracts before runtime, runtime before interface.

## Director Gate

This phase ends at architecture documentation. No runtime is designed, no enum is created, no existing contract is modified. **Phase 5B.2 — the canonical relationship contract implementation — begins only after explicit Director approval.**
