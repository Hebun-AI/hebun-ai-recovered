# 19 — Compliance Evaluation

## Purpose

Compliance Evaluation applies the foundation's compliance dimensions to declared use and produces traceable eligibility findings.

## Evaluation Areas

Policy applicability, authority alignment, architecture preservation, evidence and provenance obligations, privacy and classification, Tenant isolation, lifecycle and version, boundary separation, and required specialized review.

## Outcome Effects

A material failure may yield `DENY`; redaction-only conditions may yield `ALLOW_WITH_REDACTION`; missing bases yield `INSUFFICIENT_POLICY` or `INSUFFICIENT_AUTHORITY`; specialized ambiguity yields `COMPLIANCE_REVIEW`, `LEGAL_REVIEW`, `EXECUTIVE_REVIEW`, or `REVIEW_REQUIRED`.

## Rules

- **CEVAL-001:** Compliance evaluation must establish applicability before conformance.
- **CEVAL-002:** Every finding must cite exact constraint, subject, declared use, and evidence.
- **CEVAL-003:** Missing evidence must never be treated as compliance.
- **CEVAL-004:** Critical failure cannot be offset by other compliant dimensions.
- **CEVAL-005:** Compliance does not imply business value, approval, permission, recommendation, or execution.
- **CEVAL-006:** Governance must not correct, enforce, certify, or decide compliance externally.

## Enterprise Example

A package is policy-aligned but lacks required retention metadata. Governance may mark it `COMPLIANCE_REVIEW` or `DENY` for the declared use without changing metadata.

## Boundaries

No control automation, audit certification, compliance platform, scoring, or enforcement service is selected.
