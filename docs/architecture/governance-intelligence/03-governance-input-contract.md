# 03 — Governance Input Contract

## Purpose

The Governance Input Contract ensures that evaluation begins from one immutable Phase 14 Reasoning Output Package and a complete pre-qualified governance-reference set.

## Review Subject

The sole evaluated subject is one Reasoning Output Package version. Query text, raw sources, Runtime observations, tool results, conversations, or unprocessed content cannot substitute for it.

## Mandatory Input Content

- Reasoning Output Package identity, version, hashes, lifecycle, Tenant, classification, and declared use;
- input Processing Output Package and Query provenance;
- Objective, Scope, Results, Evidence Map, Reasoning Trace, Hypotheses, Assumptions, conflicts, validation, confidence, limitations, and review requirements;
- applicable Policy, Authority, Compliance, Privacy, and Governance Rule references;
- each reference's identity, source, authority, version, lifecycle, Scope, provenance, and conflict status;
- audience, purpose, retention, disclosure, jurisdiction, and organization Context.

## Admission Outcomes

`Eligible for Evaluation`, `Eligible with Input Limitations`, `Rejected`, `Quarantined`, `Insufficient Governance Basis`, or `Review Required`.

## Immutability

Governance binds exact versions and hashes. Input correction, supersession, revocation, declared-use change, constraint change, or material applicability change requires new admission and evaluation lineage.

## Rules

- **GINPUT-001:** Governance must evaluate only an immutable Reasoning Output Package version.
- **GINPUT-002:** Admission must validate identity, Tenant, classification, lineage, lifecycle, declared use, Scope, and integrity.
- **GINPUT-003:** Governance references must be pre-qualified, canonical, applicable, and traceable.
- **GINPUT-004:** Governance must not retrieve, fabricate, repair, or reinterpret missing references.
- **GINPUT-005:** Rejected or quarantined inputs cannot enter evaluation.
- **GINPUT-006:** Input limitations must constrain every affected Evaluation Unit and Outcome.
- **GINPUT-007:** Admission validates review eligibility, not correctness, approval, or authorization.

## Enterprise Example

A Reasoning Output Package is intact, but no current privacy policy reference exists for the declared external audience. Admission returns Insufficient Governance Basis rather than inferring a policy.

## Boundaries

No endpoint, payload, retrieval mechanism, policy registry, queue, or Runtime handoff is defined.
