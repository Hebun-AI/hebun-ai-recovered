# 15 — Concept Taxonomy

## Definition

The **Concept Taxonomy** is a non-exclusive semantic classification that groups Canonical Architecture Concepts by their primary architectural role. It supports consistent interpretation and navigation without defining inheritance, subtype mechanics, storage hierarchy, or organizational hierarchy.

## Why

The architecture corpus contains concepts about structure, behavior, governance, execution, observation, and documentation. Semantic grouping makes their roles clearer without flattening their meanings or turning categories into implementation types.

## Mental Model

```text
Canonical Concepts
        ↓ classified by semantic role
Core · Behavioral · Governance · Execution
Structural · Observation · Documentation

Classification aids understanding.
It creates no inheritance or authority.
```

## Core Concepts

- **Core Concepts:** foundational meaning used across architecture, including Architecture, Concept, Identity, Boundary, Relationship, Lifecycle, and Version.
- **Behavioral Concepts:** meaning about what is done or how work is performed, including Capability and Process.
- **Governance Concepts:** meaning about authority and normative control, including Director, Authority, Policy, Rule, Constraint, Decision, and Governance-relevant Boundaries.
- **Execution Concepts:** meaning about faithful realization of approved work, including Agent, Execution, and Runtime.
- **Structural Concepts:** meaning about enterprise organization and accountability, including Enterprise, Organization, and Department.
- **Observation Concepts:** meaning about supported awareness and interpretation, including Evidence, Observation, and Insight.
- **Documentation Concepts:** meaning about governed architectural expression, including Document, Normative Statement, Reference, Definition, Lifecycle metadata, and Version metadata.

A Concept may be relevant to more than one category. Classification states semantic relevance, not multiple identities.

## Principles

1. Taxonomy classification must not alter Concept Identity or Definition.
2. Categories must not be interpreted as inheritance.
3. Category membership must not transfer authority.
4. A Concept may occupy multiple categories when canonical meaning supports it.
5. Multiple category membership must not create duplicate concepts.
6. Classification must remain traceable to Definition and Scope.
7. Taxonomy must not be treated as enterprise hierarchy, Capability taxonomy, execution sequence, or graph topology.
8. Unknown classification must remain unresolved rather than guessed.

## Enterprise Example

Boundary is a Core Concept because it is used throughout architecture and also relevant to Governance because it limits authority. It remains one Concept Identity with one governed meaning; the two classifications neither duplicate it nor make one category a subtype of the other.

## Design Notes

- The taxonomy is intentionally semantic and non-exhaustive.
- Category names are interpretive aids, not ontology classes with inherited properties.
- Phase 10's Capability Taxonomy remains the authoritative classification of enterprise abilities; this taxonomy does not replace it.
- Phase 9's organizational hierarchy remains structural governance architecture, not a Concept taxonomy.
- No class model, parent-child schema, or type system is defined.

## Common Mistakes

- Treating categories as inheritance trees.
- Replacing Phase 10 Capability classification with ontology categories.
- Equating Structural Concepts with organizational units.
- Creating separate identities for each category membership.
- Using category order as authority or priority.
- Turning the taxonomy into a database or graph schema.

## Related Architecture

- [13 — Canonical Architecture Concepts](13-canonical-concepts.md)
- [14 — Concept Identity](14-concept-identity.md)
- [Phase 9 — Enterprise Architecture Closure](../enterprise-review/11-phase-9-final-closure.md)
- [Phase 10 — Business Capability Architecture Closure](../business-capabilities/50-phase-10-closure.md)

