# 21 — Architecture Extraction Principles

## Definition

**Architecture Extraction** is the governed, deterministic identification of canonically evidenced Entities and Relationships from eligible architecture sources while preserving source meaning, provenance, authority, lifecycle, version, and scope.

Extraction creates a derived representation. It does not modify canonical sources, infer missing architecture, validate by popularity, or implement a parser.

## Why

Canonical documents contain the evidence needed to identify architecture subjects and relationships, but extraction can corrupt meaning if it guesses, loses context, or normalizes ambiguity. Shared principles ensure any future mechanism produces the same bounded interpretation from the same governed source state.

## Mental Model

```text
Eligible canonical evidence
        ↓ governed extraction
Traceable Entity and Relationship candidates
        ↓ independent validation
Validated derived representation

Authority remains with the source throughout.
```

## Core Components

- **Deterministic:** the same eligible source state and governed interpretation rules yield the same result.
- **Repeatable:** independent conformant attempts can reproduce the result and evidence path.
- **Evidence First:** no Entity or Relationship exists in extraction before supporting evidence.
- **Traceable:** every result points to document, statement, lifecycle, version, scope, and evidence.
- **Source Preserving:** source wording, context, identity, and authority are not rewritten.
- **No Silent Assumptions:** ambiguity, absence, and conflict remain explicit.
- **No Hallucinated Entities:** unsupported subjects are never created.
- **No Hallucinated Relationships:** co-occurrence or plausibility never creates a relationship.
- **Canonical First:** applicable canonical sources govern over derivatives.
- **Implementation Independent:** principles remain valid regardless of future technology.

## Principles

1. Eligibility and authority must be established before extraction.
2. Extraction must be read-only.
3. Direct source content must remain distinguishable from extraction results.
4. Entity and Relationship identity must be evaluated separately.
5. Relationship evidence and authority must be evaluated separately from Entity evidence.
6. Missing data must remain missing.
7. Inference must not produce canonical Entities or Relationships.
8. Conflicting evidence must be surfaced rather than merged.
9. Deprecated and Archived evidence must retain historical traceability without current applicability.
10. Extraction must not authorize execution or change Runtime state.

## Enterprise Example

Two Approved documents use similar names for a Department. A conformant extraction preserves both source contexts and evaluates identity evidence. If equivalence is not explicit, it returns an unresolved identity finding rather than creating two confirmed Entities or silently merging them. A human reviewer can trace the result to each source.

## Design Notes

- Determinism governs semantic fidelity, not a specific algorithm.
- Extraction and validation are separate responsibilities.
- A candidate is not canonical merely because extraction found it.
- Source preservation includes negative boundaries and exceptions, not only positive statements.
- No parsing, pattern, model, prompt, or pipeline strategy is selected.

## Common Mistakes

- Treating plausible interpretation as deterministic extraction.
- Completing missing Scope or Authority from convention.
- Using generated reasoning as source evidence.
- Merging duplicate candidates automatically.
- Allowing extraction results to overwrite documents.
- Treating extraction success as Director approval.
- Selecting tools before the extraction contract is approved.

## Related Architecture

- [02 — Ingestion Principles](02-ingestion-principles.md)
- [04 — Source of Truth](04-source-of-truth.md)
- [06 — Architecture Ingestion Design Rules](06-design-rules.md)
- [19 — Canonical Entity Model](19-entity-model.md)
- [20 — Canonical Relationship Model](20-relationship-model.md)

