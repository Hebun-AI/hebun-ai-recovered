# 32 — Phase 15 Test Strategy

## Purpose

This strategy defines architecture-level validation obligations without selecting test tools, environments, data, or Runtime implementations.

## Test Classes

| Test Class | Required Assurance |
|---|---|
| Query Admission | origin, Tenant, classification, trust, and structural outcomes hold |
| Lifecycle | all stages, terminal outcomes, and forbidden transitions hold |
| State Transition | each component follows canonical semantic states |
| Intent Classification | allowed, unsupported, ambiguous, and out-of-scope classes remain distinct |
| Disambiguation | alternatives and material ambiguity remain visible |
| Multi-Intent | separability, dependencies, conflicts, and unsupported companions persist |
| Decomposition | every Part reconstructs to original Query meaning |
| Objective Refinement | Objectives remain non-leading and Phase 14 compatible |
| Scope and Domain | identity, version, lifecycle, time, domain, and exclusions resolve safely |
| Context Qualification | Context classes, minimization, missing Context, and Evidence separation hold |
| Constraint Extraction | source mapping, conflicts, and propagation are complete |
| Missing Information | blocking, limiting, non-material, and unknown gaps yield correct outcomes |
| Normalization | meaning, ambiguity, language, and unsupported semantics are preserved |
| Qualification Planning | obligations remain complete, logical, and non-executable |
| Trace Reconstruction | every package component and terminal outcome reconstructs |
| Explainability | qualification rationale is faithful and contains no answer |
| Security and Tenant | injection, poisoning, substitution, tampering, and cross-Tenant paths fail closed |
| Observability and Performance | audit correlation, workload bounds, and safe degradation hold |
| Request Package | determinism, explanation, traceability, single package binding, and prohibited-content checks pass |
| Human Review | clarification and unsupported outcomes are understandable without recommendation |

## Acceptance

Each test maps requirement, Rule Identity, Query and package versions, inputs, expected states and outcome, observed result, Trace evidence, limitations, and disposition. Critical Tenant, security, integrity, Trace, or boundary failure blocks readiness.

## Rules

- **QTEST-001:** Every normative Phase 15 rule must map to a validation method.
- **QTEST-002:** Forbidden transitions and prohibited outcomes require negative tests.
- **QTEST-003:** Ambiguity and missing-information classes require distinct cases.
- **QTEST-004:** Test evidence must remain versioned, Tenant-safe, reproducible, and traceable.
- **QTEST-005:** Architecture tests must remain distinct from Runtime tests.
- **QTEST-006:** Aggregate pass rate cannot waive a critical invariant failure.

## Boundaries

No test code, framework, CI, fixture, model evaluation, benchmark, or production claim is created.
