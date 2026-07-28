# 15 — Multi-Intent Analysis

## Purpose

Multi-Intent Analysis determines whether multiple purposes in one Query are separable, dependent, conflicting, or unsupported.

## Qualification Model

Each Intent retains:

- identity and exact Query segment;
- purpose and classification rationale;
- allowed and prohibited semantics;
- shared and intent-specific Scope;
- Context and constraint dependencies;
- Objective eligibility;
- relationship to other Intents;
- ambiguity, missing information, and status.

## Relationship Classes

- **Independent** — can form separate Objectives.
- **Dependent** — one qualification requires another's resolved boundary.
- **Shared-Scope** — distinct purposes use the same bounded Scope.
- **Conflicting** — requested outcomes impose incompatible conditions.
- **Unsupported Companion** — a permitted Intent is combined with decision, recommendation, governance, or execution semantics.
- **Inseparable Ambiguity** — decomposition would change meaning.

## Rules

- **MULTIINTENT-001:** Multi-Intent qualification must preserve the original combined Query.
- **MULTIINTENT-002:** Every material Intent must retain separate constraints and status.
- **MULTIINTENT-003:** Unsupported companion semantics must not contaminate a permitted Objective.
- **MULTIINTENT-004:** Shared Context does not merge Intent identities.
- **MULTIINTENT-005:** Inseparable ambiguity requires clarification or refusal.
- **MULTIINTENT-006:** Multi-Intent Analysis must not prioritize, recommend, route, or reason.

## Enterprise Example

A Query asks for explanation, impact analysis, and approval. Explanation and impact may form related Objectives; approval remains an unsupported companion and cannot enter the package.

## Boundaries

No work scheduling, routing, orchestration, prioritization algorithm, or response composition is defined.
