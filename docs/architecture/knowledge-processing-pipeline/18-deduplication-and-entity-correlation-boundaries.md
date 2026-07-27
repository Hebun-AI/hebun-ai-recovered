# 18 — Deduplication and Entity Correlation Boundaries

## Purpose

This document defines safe duplicate and correlation classifications without designing full Entity Resolution Intelligence or asserting uncertain identity as fact.

## Duplicate Classes

| Class | Meaning | Permitted Representation |
|---|---|---|
| Exact Duplicate | byte- or canonically exact content under verified comparison | confirmed duplicate with preserved identities |
| Semantic Duplicate | materially equivalent meaning supported by deterministic criteria | duplicate class plus comparison evidence |
| Partial Duplicate | overlapping but non-equivalent content | overlap relation and distinct remainder |
| Conflicting Duplicate | same claimed subject or event with material disagreement | duplicate relation plus contradiction |
| Related Artifact | relevant connection without equivalence | typed relation only |
| Possible Match | evidence suggests identity but is insufficient | uncertainty record, never fact |
| Confirmed Correlation | qualifying evidence satisfies canonical correlation rule | confirmed relation with rule and evidence |

## Correlation Process Boundary

Correlation is limited by Tenant, Processing Context, purpose, authorization reference, classification, jurisdiction, and Correlation Scope. Source names, proximity, popularity, embeddings, or confidence alone cannot establish identity.

## Preservation

Deduplication changes presentation and processing treatment, not historical existence. Every duplicate remains individually addressable, traceable, classifiable, reversible, and available for contradiction analysis.

## Rules

- **CORRELATION-001:** Uncertain correlation must never be represented as confirmed fact.
- **CORRELATION-002:** Exact, semantic, partial, conflicting, related, possible, and confirmed classes must remain distinct.
- **CORRELATION-003:** Every duplicate or correlation assertion must cite comparison evidence and an applicable rule version.
- **CORRELATION-004:** Deduplication must preserve each source identity, provenance, classification, and contradiction.
- **CORRELATION-005:** Cross-tenant correlation is prohibited unless an explicit approved shared-source contract applies.
- **CORRELATION-006:** Correlation confidence is not identity truth.
- **CORRELATION-007:** Phase 13 must not create a general entity-resolution, identity graph, or probabilistic identity authority.

## Boundaries

This architecture defines classifications and evidence obligations only. Algorithms, similarity models, indexes, thresholds, and resolution engines are deferred implementation choices.
