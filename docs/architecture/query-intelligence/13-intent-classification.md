# 13 — Intent Classification

## Purpose

Intent Classification assigns one or more bounded analytical-purpose candidates to a preserved Query without answering, reasoning, or granting authority.

## Classification Dimensions

- requested analytical operation;
- subject and architecture domain;
- expected output form;
- command, approval, recommendation, decision, or execution semantics;
- stated and implied Scope;
- authority sensitivity;
- Context completeness;
- ambiguity and multi-intent indicators;
- in-scope and unsupported portions.

## Intent Catalogue

The foundational classes from document 04 remain canonical: Information Qualification, Architecture Explanation, Impact Analysis, Dependency Analysis, Constraint Validation, Conflict Analysis, Hypothesis Analysis, Unsupported Outcome, and Out of Scope. Phase 15B adds no Governance or Decision Intent.

## Classification Record

Each candidate records identity, class, Query segments, rationale, supporting phrasing, alternatives, confidence limitation, ambiguity, prohibited interpretations, and status. Classification confidence cannot suppress ambiguity or create authority.

## Rules

- **ICLASS-001:** Every candidate Intent must map to exact Query content.
- **ICLASS-002:** Classification must use only preserved Query and qualified Context references.
- **ICLASS-003:** Unsupported recommendation, decision, governance, and execution semantics must remain visible and excluded.
- **ICLASS-004:** Classification confidence must not become truth or permission to guess.
- **ICLASS-005:** Intent classes must remain distinct from Objectives and reasoning modes.
- **ICLASS-006:** Classification rationale and alternatives must be reconstructable.

## Enterprise Example

“Explain the dependency and deploy the fix” is classified as Architecture Explanation plus unsupported execution semantics. Only the explanation candidate can proceed toward Objective refinement.

## Boundaries

No classifier implementation, model, prompt, taxonomy engine, routing service, or decision logic is defined.
