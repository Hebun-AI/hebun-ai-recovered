# 06 — Memory Classification

## Purpose

Define classification as a constitutional boundary on Memory admission, handling, visibility, contribution, consumption, retention, and archive.

## Classification Dimensions

A Memory Item declares:

- sensitivity class;
- organizational Scope;
- Tenant;
- authorized purpose;
- subject or domain boundary;
- legal, privacy, regulatory, or contractual constraints;
- allowed audience categories;
- retention and archive implications;
- applicable aggregation or derivation restrictions.

This document defines no classification engine, label implementation, access-control system, or enforcement mechanism.

## Boundary Rules

Classification follows the Memory Item and its attributable derivatives unless a separately governed decision establishes an equally or more protective classification. Composition cannot lower protection. Lack of a classification is not public classification.

## Rules

- **P20-CLASSIFICATION-001:** Every Memory Item must have an explicit classification before admission.
- **P20-CLASSIFICATION-002:** Missing or ambiguous classification must fail closed.
- **P20-CLASSIFICATION-003:** Contribution, consumption, derivation, retention, and archive must preserve applicable classification.
- **P20-CLASSIFICATION-004:** Aggregation must not be used to bypass source restrictions.
- **P20-CLASSIFICATION-005:** Technical accessibility must not imply classification authorization.
- **P20-CLASSIFICATION-006:** Cross-Tenant classification inheritance must never be inferred.

## Enterprise Example

Human Resources workforce information cannot become enterprise-wide Memory merely because it supports a strategic question. Purpose and executive relevance do not override privacy, audience, or Tenant constraints.
