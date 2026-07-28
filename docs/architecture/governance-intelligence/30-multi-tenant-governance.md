# 30 — Multi-Tenant Governance

## Purpose

This document ensures every Governance Case, reference, Evaluation Unit, Trace, review package, and Outcome remains isolated by Tenant.

## Isolation Requirements

Tenant identity propagates from Reasoning Output Package through Scope, Context, policies, roles, permissions, approvals, compliance, privacy, risks, audit, observability, and Outcome. Cross-Tenant references are prohibited unless an explicit canonical shared-governance contract applies.

## Rules

- **GTENANT-001:** Tenant identity is mandatory and immutable for every Governance record version.
- **GTENANT-002:** Cross-Tenant evaluation, reference reuse, Trace access, and Outcome disclosure are prohibited by default.
- **GTENANT-003:** Shared references require independent authorization, Scope, classification, and audit per Tenant.
- **GTENANT-004:** Tenant mismatch yields `DENY`, withholding, or specialized review.
- **GTENANT-005:** Tenant must not be inferred solely from content or user metadata.
- **GTENANT-006:** No governance stage may weaken Tenant isolation.
- **GTENANT-007:** Future cache, index, storage, and observability must preserve isolation.

## Enterprise Example

A policy is globally named but has Tenant-specific versions. Governance cannot apply one Tenant's version to another.

## Boundaries

No partitioning, account model, identity provider, cache, encryption, or infrastructure is defined.
