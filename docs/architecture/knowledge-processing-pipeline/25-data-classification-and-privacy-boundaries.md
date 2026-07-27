# 25 — Data Classification and Privacy Boundaries

## Purpose

This document defines handling obligations for information classes throughout Phase 13 while leaving policy implementation and legal interpretation outside processing.

## Classification Classes

| Class | Minimum Processing Boundary |
|---|---|
| Public | integrity and provenance still required |
| Internal | organizational access and disclosure boundaries |
| Confidential | need-to-know, minimization, controlled derivation |
| Restricted | explicit authorization and strongest applicable handling |
| Personal Sensitive | purpose limitation, minimization, masking, retention control |
| Regulated | jurisdiction and policy obligations explicitly attached |
| Security Critical | restricted disclosure, integrity protection, controlled observability |
| Unknown | treat at a restrictive default; classify or quarantine before broader use |

## Privacy Obligations

- **Minimization:** process only fields and excerpts necessary for the declared purpose.
- **Masking:** derived views hide unnecessary sensitive values while preserving protected lineage.
- **Retention:** every artifact inherits or strengthens applicable retention constraints.
- **Deletion:** valid deletion obligations propagate to descendants and produce lawful tombstones where required.
- **Disclosure:** downstream packages declare allowed audience, purpose, and prohibited disclosure.

## Classification Propagation

Derived artifacts inherit the strictest applicable parent classification unless a canonical declassification authority explicitly permits change. Processing cannot grant declassification. Classification conflict results in restriction, quarantine, or escalation.

## Rules

- **PRIVACY-001:** Every source and artifact must have a validated classification or remain Unknown.
- **PRIVACY-002:** Unknown classification must not default to Public.
- **PRIVACY-003:** Processing must minimize content and metadata to declared purpose.
- **PRIVACY-004:** Masked outputs must retain protected linkage to original evidence without exposing it.
- **PRIVACY-005:** Retention, deletion, and disclosure constraints must propagate through lineage.
- **PRIVACY-006:** Declassification requires external canonical authority and revalidation.
- **PRIVACY-007:** Observability must inherit content and metadata privacy restrictions.

## Boundaries

This architecture does not provide legal advice, define regional law, select privacy technology, or authorize access.
