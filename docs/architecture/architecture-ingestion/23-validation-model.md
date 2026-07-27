# 23 — Extraction Validation Model

## Definition

**Extraction Validation** is the read-only evaluation of extracted Entity and Relationship candidates against canonical identity, ontology, authority, evidence, lifecycle, version, direction, reference integrity, and scope requirements.

Validation reports findings. Validation is not Correction. Validation is not Inference. It does not create, merge, delete, repair, approve, or rewrite Entities, Relationships, or sources.

## Why

Even deterministic extraction can expose duplicate candidates, unresolved identities, invalid relationship types, or incompatible evidence. A separate validation model prevents detection from becoming silent correction and ensures every defect remains visible to the proper governance authority.

## Mental Model

```text
Extracted candidate + canonical evidence
                 ↓ read-only evaluation
Pass or typed Validation Finding
                 ↓
Governed review outside Validation

Finding is not a fix.
```

## Core Components

- **Entity Identity Finding:** identity is missing, unstable, ambiguous, or unsupported.
- **Duplicate Entity Finding:** more than one candidate may represent the same governed subject.
- **Unknown Concept Finding:** Entity Type does not map to an approved Canonical Concept.
- **Missing Authority Finding:** applicable source authority is absent or unresolved.
- **Missing Evidence Finding:** evidence is absent, insufficient, or not independently verifiable.
- **Broken Reference Finding:** a required governed target cannot be resolved.
- **Invalid Relationship Finding:** Relationship Type is outside the ontology or semantically incompatible.
- **Relationship Direction Finding:** direction is missing, reversed, ambiguous, or unsupported.
- **Lifecycle Compatibility Finding:** source and assertion lifecycle do not permit claimed applicability.
- **Version Compatibility Finding:** evidence or participants belong to incompatible or unresolved versions.
- **Canonical Scope Finding:** Entity or Relationship exceeds or conflicts with canonical Scope.
- **Duplicate Relationship Finding:** multiple candidates may assert the same typed relationship under the same governed context.

Every finding records its subject, finding type, source evidence, applicable rule, scope, lifecycle, version, severity or disposition where governed, and unresolved reason. The model defines no automated remediation.

## Principles

1. Validation must evaluate without mutation.
2. A finding must remain traceable to candidate and canonical evidence.
3. Missing data must not be synthesized during validation.
4. Duplicate findings must not trigger automatic merging.
5. Broken references must not automatically become architecture conflicts.
6. Relationship authority and direction must be validated independently.
7. Lifecycle and Version compatibility must be evaluated before current applicability.
8. Unknown Concepts or Relationships must fail closed.
9. Validation must distinguish absence, ambiguity, incompatibility, and conflict.
10. Only governed review may resolve normative conflicts or approve corrections.

## Enterprise Example

Two extracted candidates have the same display name but different source scopes. Validation reports a Duplicate Entity Finding and a Canonical Scope Finding. It preserves both candidates and their evidence. It neither chooses one nor merges them. Director-governed review determines whether they share identity or represent distinct subjects.

## Design Notes

- “Pass” means conformance to this extraction contract, not canonical approval of new architecture.
- Finding severity and remediation workflow are deferred governance concerns.
- Validation uses Phase 11B broken-reference semantics and Phase 11C ontology meanings.
- Correction may require source governance; it is explicitly outside this phase.
- No validator, rules engine, data structure, or interface is designed.

## Common Mistakes

- Auto-fixing a candidate while validating it.
- Treating a duplicate name as proven duplicate identity.
- Filling missing Authority from organizational rank.
- Calling every broken reference a conflict.
- Inferring relationship direction.
- Treating a successful validation as Director approval.
- Hiding unresolved findings to produce a clean result.

## Related Architecture

- [10 — Architecture Reference Model](10-architecture-reference-model.md)
- [12 — Architecture Document Model Design Rules](12-document-model-design-rules.md)
- [18 — Architecture Ontology Design Rules](18-ontology-design-rules.md)
- [19 — Canonical Entity Model](19-entity-model.md)
- [20 — Canonical Relationship Model](20-relationship-model.md)

