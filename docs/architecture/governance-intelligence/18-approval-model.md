# 18 — Approval Model

## Purpose

The Approval Model represents existing canonical approval evidence and approval requirements without making, predicting, simulating, or requesting a preferred approval.

## Approval Reference

An Approval Reference contains subject, approving authority, decision class, Scope, Tenant, conditions, version, lifecycle, effective interval, expiry, revocation, evidence, provenance, and status.

Approval requirements identify the proper reserved boundary and evidence needed. They do not create a workflow.

## Rules

- **APPROVAL-001:** Existing approval evidence must be canonical, explicit, applicable, current, and traceable.
- **APPROVAL-002:** Permission does not imply approval.
- **APPROVAL-003:** Approval does not imply execution.
- **APPROVAL-004:** Compliance does not imply approval.
- **APPROVAL-005:** Missing or conflicting approval evidence yields `REVIEW_REQUIRED`, specialized review, or `DENY`.
- **APPROVAL-006:** Governance must not grant, revoke, predict, simulate, recommend, or enforce approval.

## Enterprise Example

A result is compliant and the actor has permission to view it, but external publication requires executive approval. Governance produces `EXECUTIVE_REVIEW`; it does not initiate approval or publication.

## Boundaries

No approval workflow, signature, voting, notification, decision process, or authorization mechanism is defined.
