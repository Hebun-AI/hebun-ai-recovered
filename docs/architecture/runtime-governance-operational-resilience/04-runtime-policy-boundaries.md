# 04 — Runtime Policy Boundaries

## Purpose

Define how approved policy constrains Runtime without becoming implementation or Director authority.

## Policy Identity

A Runtime Policy is an approved, versioned constitutional constraint defining permitted, required, prohibited, or review-bound Runtime behavior for a declared Scope.

Policy is not implementation, code, configuration, management preference, Metric, Monitoring condition, Alert, control execution, recovery mechanism, or Director authority.

## Applicability

Applicability requires policy identity and version, approving authority, effective period, subject, Scope, Tenant, classification, purpose, conditions, precedence, exceptions, and evidence requirements.

## Enforcement Boundary

Policy enforcement means preserving the policy's constitutional constraint in Runtime admission, realization, control, degradation, recovery, and closure. It does not define an enforcement engine, control loop, API, automation, or infrastructure mechanism.

## Rules

- **P24-POLICY-001:** Only approved and applicable policy may constrain Runtime.
- **P24-POLICY-002:** Policy constrains Runtime but never replaces Director authority.
- **P24-POLICY-003:** Missing, expired, conflicting, or ambiguous policy must fail closed.
- **P24-POLICY-004:** Policy exceptions must be explicit, authorized, versioned, and auditable.
- **P24-POLICY-005:** Monitoring conditions and Metrics must not silently become policy.
- **P24-POLICY-006:** Policy must remain distinct from implementation.

## Enterprise Example

A policy may prohibit continued realization after a classification violation. It does not specify a circuit breaker or perform termination.
