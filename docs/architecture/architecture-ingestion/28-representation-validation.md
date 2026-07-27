# 28 — Representation Validation

## Definition

**Representation Validation** is the read-only evaluation of an Architecture Knowledge Representation against completeness, identity, authority, evidence, relationship, version, scope, and source-traceability requirements.

Validation reports conformance and findings. Validation is not Transformation. It does not add, remove, merge, normalize, repair, approve, or reinterpret Representation components.

## Why

A Representation may be structurally present while omitting evidence, mixing scopes, duplicating identities, or using incompatible versions. Independent validation makes these defects visible without allowing the checker to reshape the represented architecture.

## Mental Model

```text
Architecture Knowledge Representation
        ↓ read-only conformance evaluation
Validation result + retained findings
        ↓
Governed review outside Validation

Evaluation does not transform the subject.
```

## Core Components

- **Representation Completeness:** all required components for declared Scope are present or missing components are explicitly recorded.
- **Identity Integrity:** Representation, Entity, Relationship, and source identities are unique, stable, and correctly distinguished.
- **Authority Integrity:** every assertion is backed by applicable source authority without transfer or amplification.
- **Evidence Integrity:** evidence is precise, applicable, and independently verifiable.
- **Relationship Integrity:** relationship type, participants, direction, authority, lifecycle, and evidence conform to Phase 11C–11D.
- **Version Integrity:** Representation and component versions are explicit, compatible, and traceable.
- **Scope Integrity:** no represented assertion exceeds its canonical or Representation scope.
- **Source Traceability:** every represented assertion retains an unbroken path to source document, statement, metadata, or approved reference.

## Principles

1. Validation must not mutate the Representation or sources.
2. Completeness must not be achieved by inventing missing components.
3. Identity checks must detect duplicates without merging them.
4. Authority and Evidence must be evaluated independently.
5. Relationship Integrity must not be inferred from participant validity.
6. Version and Scope compatibility must be explicit.
7. Broken traceability must produce a finding, not a guessed source.
8. Validation Findings must remain part of the governed validation evidence.
9. Validation success must not create canonical authority or source approval.
10. Correction and transformation require separate governed action.

## Enterprise Example

A Representation contains valid Department and Capability Entities but an Owns Relationship points to evidence from an incompatible document version. Validation passes Entity identity checks and raises Version Integrity and Relationship Integrity findings. It neither changes the evidence reference nor deletes the Relationship.

## Design Notes

- Representation Validation builds on, but does not replace, Phase 11D Extraction Validation.
- Completeness is evaluated against declared Scope, not an imagined total enterprise model.
- A failed component need not invalidate unrelated components unless canonical rules require it.
- Validation result identity and lifecycle are implementation concerns outside this semantic model.
- No validation engine, correction procedure, or workflow is designed.

## Common Mistakes

- Auto-completing missing components.
- Treating valid Entities as proof of valid Relationships.
- Repairing references during validation.
- Mixing Representation and source versions.
- Treating a clean result as Director approval.
- Removing findings before approval.
- Using validation as a transformation pipeline.

## Related Architecture

- [10 — Architecture Reference Model](10-architecture-reference-model.md)
- [23 — Extraction Validation Model](23-validation-model.md)
- [24 — Architecture Extraction Design Rules](24-extraction-design-rules.md)
- [25 — Architecture Knowledge Representation Model](25-knowledge-representation-model.md)
- [26 — Representation Components](26-representation-components.md)
- [27 — Representation Lifecycle](27-representation-lifecycle.md)

