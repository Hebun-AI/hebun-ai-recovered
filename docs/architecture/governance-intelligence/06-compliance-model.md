# 06 — Compliance Model

## Purpose

The Compliance Model defines read-only assessment of whether a declared use satisfies applicable governance constraints. Compliance states eligibility alignment, not correctness, approval, authorization, or enforcement.

## Compliance Dimensions

| Dimension | Evaluation Question |
|---|---|
| Policy Applicability | Are all applicable policies identified and current for Scope? |
| Authority Alignment | Are reserved rights and authority limitations represented correctly? |
| Architecture Preservation | Does the declared use preserve canonical boundaries and non-mutation? |
| Evidence and Provenance | Does the package retain required lineage and support records? |
| Privacy and Classification | Are purpose, minimization, audience, disclosure, and handling constraints satisfied? |
| Tenant Isolation | Is every subject, reference, Trace, and audience Tenant-compatible? |
| Lifecycle and Version | Are all inputs and constraints applicable and non-revoked? |
| Boundary Alignment | Are decision, recommendation, execution, enforcement, and Runtime semantics absent? |

## Outcomes

- **Compliant for Declared Use**
- **Conditionally Compliant**
- **Non-Compliant**
- **Insufficient Governance Basis**
- **Conflicted**
- **Review Required**

No outcome means correct, approved, permitted, authorized, recommended, or executable.

## Findings

Every finding records dimension, subject, constraint, applicability, evidence reference, status, severity, condition, affected use, uncertainty, and Trace mapping. A critical violation cannot be averaged into compliance.

## Rules

- **COMPLY-001:** Applicability must be established before compliance.
- **COMPLY-002:** Every material finding must cite an applicable canonical constraint.
- **COMPLY-003:** Missing governance basis must never be treated as compliance.
- **COMPLY-004:** Strong performance in one dimension cannot cancel a material failure in another.
- **COMPLY-005:** Conditional requirements must propagate to the Outcome Package.
- **COMPLY-006:** Compliance and approval must remain distinct.
- **COMPLY-007:** Compliance evaluation must not enforce, correct, recommend, decide, or execute.

## Enterprise Example

A package is compliant for restricted internal review but non-compliant for public disclosure. The Compliance Model records two declared-use outcomes without judging whether the reasoning is correct.

## Boundaries

No scoring formula, control engine, certification, audit procedure, permission check, or enforcement implementation is selected.
