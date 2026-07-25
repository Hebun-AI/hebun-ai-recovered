# Canonical Relationship Specification

## Purpose

This directory is the **canonical specification of Organizational Relationships** — the authoritative definition of *what every relationship means*. Where earlier phases designed the graph, the contracts, and the validation rules, this phase fixes the precise semantics: each relationship's business meaning, permitted endpoints, direction, multiplicity, and ownership semantics.

It is **specification only**. It defines meaning, not mechanism. No runtime, no graph services, no validation logic, no storage, no APIs. It modifies no existing Phase 5A contract and no relationship enum.

When a question arises about what a relationship *is* — what `owns` implies, whether a Person may `contain` a Role, how many owners a Capability may have — this directory is the answer of record.

## Documents

| Document | Covers |
|---|---|
| [01 — Canonical Relationships](01-canonical-relationships.md) | Full definition of every canonical relationship |
| [02 — Endpoint Matrix](02-endpoint-matrix.md) | Allowed and forbidden source/target combinations, with multiplicity |
| [03 — Semantics](03-semantics.md) | Business meaning and the distinctions between close relationships |
| [04 — Multiplicity Reference](04-multiplicity-reference.md) | When each cardinality applies |
| [05 — Direction Reference](05-direction-reference.md) | Direction conventions and why direction is stable |
| [06 — Canonical Examples](06-canonical-examples.md) | Worked organizational examples |
| [07 — Versioning](07-versioning.md) | How the specification evolves |

## Relationship to other phases

- **Phase 5A** — established the canonical entities (the node types) and the first edge contract, `OrganizationalRelationship`. This specification names relationships *between* those entities and modifies none of them. Names extending the frozen `ORGANIZATIONAL_RELATIONSHIP_TYPES` enum remain Phase 5B.1 Candidate Relationship Contracts — proposals, not changes made here.
- **Phase 5B** — designed the [Relationship Graph](../relationship-graph/README.md): nodes, relationship vocabulary, traversal, impact analysis. This specification makes that vocabulary precise.
- **Phase 5B.1** — defined the [Relationship Contracts](../relationship-contracts/README.md): philosophy, categories, guidelines, lifecycle. This specification is the concrete content those contracts govern.
- **Phase 5B.2** — defined [Graph Validation](../graph-validation/README.md): the integrity rules a graph must satisfy. This specification supplies the meanings those rules are checked against.
- **Phase 6 — Organizational Memory** — a separate architectural phase, the Memory Layer. Out of scope here.

## Scope and gate

This is an internal engineering specification: precise, architecture-only. It creates no runtime, no validators, and no contracts. **Phase 5B.4 begins only after explicit Director approval.**
