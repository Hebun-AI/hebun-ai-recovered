# 17 — Permission Model

## Purpose

The Permission Model represents canonical permission evidence relevant to declared-use eligibility while ensuring Governance Intelligence never grants or enforces permission.

## Permission Reference

Each reference contains subject, action or use, resource, Scope, Tenant, conditions, authority source, lifecycle, version, effective interval, delegation, restrictions, revocation, provenance, and validation.

## Required Distinctions

- Authority ≠ Permission
- Role ≠ Permission
- Ownership ≠ Permission
- Capability ≠ Permission
- Compliance ≠ Permission
- Permission Evidence ≠ Permission Decision

## Rules

- **PERMISSION-001:** Permission evidence must be explicit, applicable, current, scoped, and traceable.
- **PERMISSION-002:** Authority, role, ownership, or capability must not imply permission.
- **PERMISSION-003:** Missing permission evidence yields review, denial, or insufficiency—not fabricated permission.
- **PERMISSION-004:** Conditions and revocation must propagate to the Outcome.
- **PERMISSION-005:** Governance must not grant, revoke, modify, or enforce permission.
- **PERMISSION-006:** Permission does not imply approval, business value, or execution.

## Enterprise Example

A role has authority to review architecture but no explicit permission for external disclosure. Governance cannot infer disclosure permission and may produce `DENY` or `REVIEW_REQUIRED`.

## Boundaries

No authorization service, RBAC, ABAC, access policy, token, entitlement store, or enforcement is defined.
