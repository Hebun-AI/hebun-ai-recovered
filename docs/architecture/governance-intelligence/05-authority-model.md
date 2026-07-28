# 05 — Authority Model

## Purpose

The Authority Model validates whether authority references and reserved rights are represented and applicable without exercising or transferring authority.

## Authority Reference

Each Authority Reference records source, holder or seat reference, authority type, decision or review right, Scope, Tenant, organization, domain, lifecycle, version, effective interval, delegation evidence when explicit, restrictions, conflicts, provenance, and validation.

## Required Distinctions

- Authority ≠ Ownership
- Authority ≠ Permission
- Authority ≠ Capability
- Authority ≠ Priority
- Authority ≠ Confidence
- Authority Reference ≠ Authority Exercise
- Review Requirement ≠ Decision

Ownership can establish accountability but not decision rights automatically. A system-originated Query or Reasoning Result cannot create authority.

## Applicability

Authority applicability is validated against the exact declared use, subject, decision class, Scope, Tenant, version, lifecycle, and time. Missing or conflicting authority yields Insufficient Governance Basis or Review Required.

## Rules

- **AUTHORITY-001:** Every authority claim must map to a canonical, applicable Authority Reference.
- **AUTHORITY-002:** Authority and ownership must remain distinct.
- **AUTHORITY-003:** Governance Intelligence must not create, transfer, delegate, infer, amplify, or exercise authority.
- **AUTHORITY-004:** Permission must not be inferred from authority applicability.
- **AUTHORITY-005:** Priority, confidence, repetition, recency, or Runtime behavior cannot establish authority.
- **AUTHORITY-006:** Authority conflict and missing authority must remain explicit.
- **AUTHORITY-007:** Review Required identifies a reserved right without recommending or making a decision.

## Enterprise Example

A department owns a process but the Director retains architecture exception authority. Governance records ownership and authority separately and marks an exception-related use Review Required.

## Boundaries

No identity proofing, authentication, authorization, delegation workflow, permission service, or organization-management implementation is defined.
