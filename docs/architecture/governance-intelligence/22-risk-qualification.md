# 22 — Risk Qualification

## Purpose

Risk Qualification describes governance risk attached to a declared use without calculating business value, recommending treatment, making a decision, or operating risk controls.

## Risk Dimensions

Authority, policy, compliance, privacy, Tenant, legal, canonical architecture, disclosure, reversibility, scope, evidence sufficiency, and boundary integrity.

Each risk record contains identity, source finding, affected asset and use, likelihood class when explicitly supported, impact class, uncertainty, existing constraint, residual risk, review level, and Trace.

## Rules

- **RISKQ-001:** Every risk qualification must map to governance findings and canonical constraints.
- **RISKQ-002:** Risk must not be inferred from confidence or popularity alone.
- **RISKQ-003:** Unknown likelihood or impact must remain unknown.
- **RISKQ-004:** Risk qualification must not recommend treatment or choose a response.
- **RISKQ-005:** Critical Tenant, authority, or Director-control risk cannot be averaged down.
- **RISKQ-006:** Risk status must propagate to conditions, review requirements, and Outcome.

## Enterprise Example

External disclosure has material privacy and authority risks. Governance records them and may issue `LEGAL_REVIEW` or `DENY`; it does not recommend mitigation.

## Boundaries

No risk engine, scoring formula, appetite decision, control selection, remediation, or monitoring implementation is defined.
