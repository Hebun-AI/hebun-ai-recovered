# 21 — Information Classification

## Purpose

This document defines governance evaluation of existing information-classification references without classifying content autonomously.

## Classification Classes

`Public`, `Internal`, `Confidential`, `Restricted`, `Personal Sensitive`, `Regulated`, `Security Critical`, and `Unknown`.

Governance validates class applicability, source, version, handling obligations, audience, purpose, retention, and disclosure compatibility. Unknown remains restrictive.

## Rules

- **GCLASS-001:** Every evaluated package and material component must have a validated classification or remain Unknown.
- **GCLASS-002:** Unknown must not default to Public or Internal.
- **GCLASS-003:** Derived components inherit the strictest applicable classification unless external canonical authority permits change.
- **GCLASS-004:** Classification conflicts must remain visible and constrain Outcome.
- **GCLASS-005:** Governance must not classify, declassify, relabel, or transform content.
- **GCLASS-006:** Classification eligibility does not imply permission, approval, or correctness.

## Enterprise Example

A package says Internal while a parent evidence reference is Restricted. Governance preserves the conflict and applies the stricter boundary pending review.

## Boundaries

No classification model, content scanner, labeling system, DLP, or access-control implementation is selected.
