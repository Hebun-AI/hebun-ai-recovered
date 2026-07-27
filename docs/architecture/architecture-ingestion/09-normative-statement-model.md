# 09 — Normative Statement Model

## Definition

A **Normative Statement** is an identifiable, governed architectural assertion whose type, scope, authority, source, lifecycle, version, evidence, and governance relationships can be independently evaluated.

Canonical statement types are **Definition, Principle, Rule, Invariant, Constraint, Requirement, Permission, Decision, Exception, Deprecation, and Closure**.

Every Normative Statement has **Identity, Type, Authority, Scope, Source, Lifecycle, Version, Evidence, Supersession, and Exception**.

A Rule is not an explanation, example, inference, recommendation, or Runtime observation.

## Why

Documents mix mandatory commitments with rationale and illustration. Without statement-level distinction, a summary can flatten meaning, an example can become a rule, or an obsolete decision can appear current. This model preserves normative force at the smallest independently governable unit without defining extraction technology.

## Mental Model

```text
Normative Statement
├── assertion: type and scope
├── governance: authority and lifecycle
├── provenance: source, version, and evidence
└── relationships: supersession and exception

Surrounding prose may explain; it does not silently alter the statement.
```

## Core Components

- **Definition** establishes canonical meaning.
- **Principle** guides durable judgment.
- **Rule** mandates or prohibits a condition.
- **Invariant** remains true across permitted change.
- **Constraint** limits the valid solution or decision space.
- **Requirement** declares a condition necessary for conformance.
- **Permission** explicitly allows a bounded condition without requiring it.
- **Decision** records an authorized architectural choice.
- **Exception** authorizes a scoped departure from an identified norm.
- **Deprecation** withdraws current applicability while preserving history.
- **Closure** records the authorized disposition of an architectural body.

Identity distinguishes the assertion across presentation changes. Type describes semantic force but creates no authority. Supersession identifies replacement; Exception identifies a governed departure.

## Principles

1. Every statement identity must be unique within its authoritative model scope.
2. Identity must not derive solely from line number, order, or file path.
3. Type must reflect supported meaning, not formatting.
4. Authority must be evaluated independently of type.
5. Scope must be explicit or unresolved.
6. Canonical statements must retain source, version, lifecycle, and precise evidence.
7. Supersession must be explicit; newer wording must not silently erase history.
8. An Exception must identify its norm, approved scope, authority, and applicability.
9. Explanation and examples must not extend scope.
10. Inference and Runtime observation require governed approval before becoming normative.
11. Conflicting current statements remain visible for Director-governed resolution.

## Enterprise Example

An Approved document states, “Ingestion must not trigger execution.” This is a Rule with source, version, lifecycle, evidence, scope, and authority. A paragraph about operational risks is Design Notes. A blocked-tool scenario is an Example. An observed Runtime event is behavior evidence, not a replacement Rule.

## Design Notes

- Identity is semantic; this phase defines no identifier syntax or schema.
- A sentence may contain multiple assertions; extraction is not defined here.
- Normative force results from meaning plus authority, scope, lifecycle, and version.
- Deprecation preserves history and identifies replacement evidence when available.
- Closure does not imply Director approval unless governance explicitly records it.

## Common Mistakes

- Treating modal words alone as proof of a Rule.
- Assigning authority without checking scope.
- Giving distinct statements the same identity.
- Silently replacing an older statement with newer prose.
- Treating an Exception as a global rewrite.
- Promoting examples, inference, or Runtime observations into rules.

## Related Architecture

- [07 — Architecture Document Model](07-architecture-document-model.md)
- [08 — Document Structure and Sections](08-document-structure-and-sections.md)
- [10 — Architecture Reference Model](10-architecture-reference-model.md)
- [Phase 7 — Director Intelligence Closure](../director-review/10-phase-7-final-closure.md)
- [Phase 8 — Execution Architecture Closure](../execution-review/10-phase-8-final-closure.md)

