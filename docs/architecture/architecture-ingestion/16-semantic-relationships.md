# 16 — Semantic Relationships

## Definition

A **Semantic Relationship** is a typed, directional or associative architectural assertion that explains how two governed Concepts relate in meaning. Its validity depends on canonical definitions, scope, authority, lifecycle, version, and evidence.

A Relationship is not a Runtime Edge, Knowledge Graph Edge, Execution Flow, database foreign key, workflow step, or authority transfer.

## Why

Concept definitions alone cannot express how architecture hangs together. The enterprise must distinguish definition, constraint, authorization, ownership, realization, observation, and other relationships without collapsing them into generic links or implementation connections.

## Mental Model

```text
Source Concept ── declared semantic meaning ──▶ Target Concept

The assertion explains architectural meaning.
It does not create Runtime connectivity or execution order.
```

## Core Concepts

- **Defines:** a governed source establishes the canonical meaning of a Concept or Statement.
- **References:** one object explicitly points to another without transferring authority.
- **Depends On:** one architectural meaning requires another condition or ability to remain valid or achievable; it does not imply execution order.
- **Constrains:** one Concept or Statement limits the valid scope or behavior of another.
- **Authorizes:** a recognized Authority permits a bounded Decision or action; the relationship requires explicit scope and does not itself execute.
- **Observes:** an authorized observer produces an evidence-bound Observation about a subject.
- **Measures:** an observation or measure evaluates a declared aspect without redefining the measured Concept.
- **Realizes:** an Agent, human, system, Process, or Runtime realization performs or makes a Capability operational without becoming that Capability.
- **Owns:** an accountable organizational seat or unit holds governed ownership within declared scope.
- **Governed By:** a Concept or architectural object is subject to a named Authority, Policy, Rule, or governance regime.
- **Supersedes:** an authorized version or statement explicitly replaces another within declared scope while preserving history.
- **Related To:** concepts share a supported association for which no stronger canonical relationship is asserted.

## Principles

1. Every relationship assertion must identify its type, source Concept, target Concept, Scope, and Evidence.
2. Direction must be preserved where the relationship is directional.
3. Inverse meaning must not be assumed unless canonically established.
4. Authorizes must not be inferred from References, Owns, or Related To.
5. Depends On must not be interpreted as an execution sequence.
6. Realizes must preserve Capability independence from Agent and Runtime.
7. Observes and Measures must not grant authority over the subject.
8. Supersedes must be explicit, authority-supported, lifecycle-aware, and version-aware.
9. Related To must not be used to hide an unknown stronger relationship.
10. Relationship ambiguity or conflict must remain visible for governance.

## Enterprise Example

A Department **Owns** accountability for a Capability. An Agent **Realizes** that Capability under a governed binding. A Policy **Constrains** execution, and the Director **Authorizes** a bounded committing action. Evidence **Measures** an outcome. These distinct relationships must not be collapsed into one generic “connected to” link or interpreted as an execution flow.

## Design Notes

- This vocabulary defines meanings, not edge labels for a graph database.
- Relationship assertions remain derived representations unless directly established by canonical statements.
- The Architecture Reference Model governs references between architecture objects; References here preserves that meaning at Concept level.
- Phase 10 Capability dependencies remain ability-level structural relationships and not Runtime sequence.
- Cardinality, traversal, query, storage, and enforcement are outside this phase.

## Common Mistakes

- Treating every relationship as a graph edge.
- Reading Depends On as “runs before.”
- Assuming Owns grants unlimited authorization.
- Treating Realizes as identity equivalence.
- Using Related To when evidence supports no specific meaning.
- Inferring inverse relationships automatically.
- Turning Authorizes into an execution mechanism.

## Related Architecture

- [10 — Architecture Reference Model](10-architecture-reference-model.md)
- [13 — Canonical Architecture Concepts](13-canonical-concepts.md)
- [14 — Concept Identity](14-concept-identity.md)
- [Phase 8 — Execution Architecture Closure](../execution-review/10-phase-8-final-closure.md)
- [Phase 9 — Enterprise Architecture Closure](../enterprise-review/11-phase-9-final-closure.md)
- [Phase 10 — Business Capability Architecture Closure](../business-capabilities/50-phase-10-closure.md)

