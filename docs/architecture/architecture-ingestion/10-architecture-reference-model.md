# 10 — Architecture Reference Model

## Definition

An **Architecture Reference** is an explicit, typed, traceable semantic connection from one architecture object to another. It identifies what is referenced and why without transferring identity, authority, ownership, or normative force.

Canonical types are **Document, Section, Statement, Phase, Evidence, Conflict, Supersession, Deprecation, and Related Concept**.

A Reference is not a dependency, authority grant, inheritance relationship, approval, or execution connection. A broken Reference is a referential integrity defect; it is not by itself an architectural conflict.

## Why

Architecture gains coherence through cross-document relationships, but untyped links are ambiguous. A link may cite evidence, indicate replacement, record conflict, or merely point to related material. This model preserves intent so navigation is not confused with governance or structural dependency.

## Mental Model

```text
Source architecture object
        ── typed reference ──▶ Target architecture object

The connection carries declared meaning and evidence.
It does not carry the target's authority back to the source.
```

## Core Components

- **Document Reference** identifies another governed document.
- **Section Reference** identifies a semantic or evidenced section.
- **Statement Reference** identifies a normative statement.
- **Phase Reference** relates content to a governed architecture phase.
- **Evidence Reference** identifies support for verification.
- **Conflict Reference** records an asserted inconsistency requiring review.
- **Supersession Reference** identifies explicit replacement.
- **Deprecation Reference** records withdrawal and historical context.
- **Related Concept Reference** supports association without stronger semantics.

Every reference retains source context, target identity where known, type, and evidence sufficient to evaluate the relationship. Unknown targets remain unresolved rather than guessed.

## Principles

1. Reference type must be explicit or unresolved.
2. Source identity and evidence context must be preserved.
3. Target resolution uses governed identity, not path similarity alone.
4. A reference transfers no authority, approval, lifecycle, ownership, or scope.
5. Related Concept implies neither dependency nor equivalence.
6. Supersession and Deprecation must be explicit and authority-supported.
7. Conflict identifies relevant assertions and scope; differing language is insufficient.
8. Broken references are reported, never silently repaired.
9. A broken reference is not automatically an architecture conflict.
10. A hyperlink may present a reference but does not define its type.
11. Circular navigation references are not automatically architectural cycles.

## Enterprise Example

A Phase 11 document cites a Phase 8 closure as a Phase Reference and a specific execution boundary as a Statement Reference. They demonstrate alignment but grant no Execution authority. If a hyperlink breaks, it is an integrity defect. A Conflict Reference exists only when governed statements make incompatible claims in overlapping scope.

## Design Notes

- This defines semantics, not graph edges, storage, traversal, or dependency resolution.
- Object identity remains distinct from its physical locator.
- A reference may require evidence beyond a hyperlink.
- Authority is evaluated at the referenced object and applicable scope.
- Reference validation and architecture consistency validation are separate.

## Common Mistakes

- Treating every hyperlink as a dependency.
- Assuming a citation inherits target authority.
- Using paths as permanent target identities.
- Calling any broken link an architectural conflict.
- Inferring supersession from a later date.
- Treating Related Concept as equivalence.
- Redirecting an unresolved target to a plausible document.

## Related Architecture

- [07 — Architecture Document Model](07-architecture-document-model.md)
- [09 — Normative Statement Model](09-normative-statement-model.md)
- [11 — Document Metadata Model](11-document-metadata-model.md)
- [Phase 10 — Business Capability Architecture Closure](../business-capabilities/50-phase-10-closure.md)

