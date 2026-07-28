# 15 — Authority Resolution

## Purpose

Authority Resolution determines whether canonical authority references apply to the exact declared use and reserved review question.

## Resolution Dimensions

Authority source, holder or seat, authority type, decision class, Scope, Tenant, organization, domain, delegation, lifecycle, version, effective interval, restrictions, conflict, and provenance.

## Outcomes

`Applicable Authority Identified`, `Multiple Authorities`, `Authority Conflict`, `Insufficient Authority`, `Expired or Revoked`, or `Review Required`.

Resolution observes authority. It never exercises, transfers, delegates, or converts authority into permission.

## Rules

- **ARESOLVE-001:** Every authority conclusion must cite an applicable canonical Authority Reference.
- **ARESOLVE-002:** Authority, ownership, role, permission, and approval must remain distinct.
- **ARESOLVE-003:** Missing authority yields `INSUFFICIENT_AUTHORITY`, never inferred authority.
- **ARESOLVE-004:** Authority conflict must remain visible and cannot be resolved by confidence or seniority assumptions.
- **ARESOLVE-005:** Delegation must be explicit, scoped, current, and traceable.
- **ARESOLVE-006:** Authority Resolution must not grant permission, approval, decision, or execution.

## Enterprise Example

An accountable owner is identified, but exception authority belongs to an executive seat. Governance records both and produces `EXECUTIVE_REVIEW` rather than treating ownership as approval.

## Boundaries

No identity proofing, authentication, authorization, delegation workflow, or permission service is defined.
