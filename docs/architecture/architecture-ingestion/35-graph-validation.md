# 35 — Architecture Knowledge Graph Validation

## Definition

**Graph Validation** is the read-only evaluation of an Architecture Knowledge Graph against identity, connectivity, relationship, authority, evidence, scope, lifecycle, version, provenance, and integrity requirements.

Validation reports findings. Validation is not Repair. It does not connect, disconnect, add, remove, merge, reverse, normalize, approve, or reinterpret Graph components.

## Why

Projection can introduce duplicates, omissions, broken relationships, lost provenance, or context mismatches even when the source Representation is valid. Independent validation detects these failures without altering the Graph or upstream architecture.

## Mental Model

```text
Architecture Knowledge Graph
        ↓ read-only evaluation
Pass results + typed Graph findings
        ↓
Governed review outside Validation

A finding identifies a defect.
It does not repair it.
```

## Core Components

- **Duplicate Graph Identity Finding:** distinct Graphs share an identity or one projection has duplicate Graph identities.
- **Disconnected Components Finding:** projected components lack expected semantic connectivity within declared Scope; disconnection may be valid and requires evidence-based classification.
- **Broken Relationships Finding:** participant, direction, type, evidence, or traceability cannot be resolved.
- **Authority Violations Finding:** authority is missing, broadened, transferred, or reinterpreted.
- **Evidence Violations Finding:** evidence is missing, inapplicable, incompatible, or unverifiable.
- **Scope Violations Finding:** Graph or component assertions exceed governing Representation Scope.
- **Lifecycle Violations Finding:** Graph applicability conflicts with explicit Graph or input lifecycle context.
- **Version Violations Finding:** Graph and Representation or component versions are incompatible or unresolved.
- **Provenance Violations Finding:** traceability to Representation or canonical sources is broken.
- **Semantic Integrity Finding:** ontology or Representation meaning has been lost or altered.

## Principles

1. Validation must not modify Graph, Representation, or canonical sources.
2. Duplicate identities must not be silently merged.
3. Disconnected components must not be automatically repaired or rejected.
4. Broken Relationships must preserve original direction and evidence context in findings.
5. Authority and Evidence violations must be evaluated separately.
6. Scope, Lifecycle, and Version must be checked before current applicability.
7. Missing provenance must not be reconstructed by inference.
8. Validation Findings must remain visible and traceable.
9. Validation success must not create source or Graph authority.
10. Repair, correction, approval, and transformation require separate governance.

## Enterprise Example

A Graph contains two disconnected Capability components. Validation checks the governing Representation and finds that no canonical Relationship was asserted between them. It records the disconnection as expected within Scope rather than inventing Related To. If an expected Relationship component was omitted during projection, it records a failure without adding it.

## Design Notes

- Disconnection is a condition to classify, not inherently an error.
- Graph Validation builds on Representation Validation and does not repeat source extraction.
- A Graph can retain upstream findings and add projection-specific findings.
- Validation does not define severity scales, remediation workflows, or tooling.
- No validator, query, schema, or repair algorithm is specified.

## Common Mistakes

- Connecting disconnected components automatically.
- Reversing a broken Relationship to make it resolve.
- Merging duplicate Graph identities.
- Reconstructing provenance from labels.
- Treating validation as Graph approval.
- Hiding upstream Representation findings.
- Repairing Graph content during review.

## Related Architecture

- [23 — Extraction Validation Model](23-validation-model.md)
- [28 — Representation Validation](28-representation-validation.md)
- [33 — Architecture Knowledge Graph Integrity](33-graph-integrity.md)
- [34 — Architecture Knowledge Graph Boundaries](34-graph-boundaries.md)

