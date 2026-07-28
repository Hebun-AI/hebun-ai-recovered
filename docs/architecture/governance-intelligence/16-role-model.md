# 16 — Role Model

## Purpose

The Role Model represents canonical organizational role and accountable-seat references needed for eligibility evaluation without implementing access control or management.

## Role Reference

A Role Reference contains identity, organization, Tenant, domain, responsibilities, accountable seat, authority references, permission references when separately canonical, lifecycle, version, effective interval, restrictions, delegation, provenance, and conflicts.

Role labels do not prove identity, ownership, authority, permission, approval, or current assignment.

## Rules

- **ROLE-001:** Every applied role must map to a canonical, versioned Role Reference.
- **ROLE-002:** Role, person, seat, ownership, authority, permission, and approval must remain distinct.
- **ROLE-003:** Query or package metadata must not create role assignment.
- **ROLE-004:** Expired, ambiguous, multiple, or conflicting roles must constrain eligibility.
- **ROLE-005:** Governance must not assign roles, work, responsibility, or management action.
- **ROLE-006:** Role evaluation must preserve Tenant and organization Scope.

## Enterprise Example

“Security Lead” appears in a package, but two canonical seats share that label. Governance marks role ambiguity and cannot infer which actor holds review authority.

## Boundaries

No directory, HR system, RBAC implementation, identity mapping, or management hierarchy is designed.
