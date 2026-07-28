# 03 — Reasoning Input Contract

## Purpose

The Reasoning Input Contract ensures that Phase 14A begins only from a valid, bounded, immutable Phase 13 Processing Output Package.

## Sole Admissible Input

The sole substantive reasoning input is one Processing Output Package version produced under Phase 13. A question, conversation, document, Runtime observation, tool result, user statement, or raw source cannot enter reasoning directly. Such material must first satisfy the appropriate canonical upstream architecture.

## Mandatory Package Content

An admissible package provides:

- Processing Request, purpose, Scope, Tenant, Context, and acceptance criteria;
- package identity, version, lifecycle state, classification, and authorization reference;
- qualified evidence and original-source references;
- provenance and parent-child lineage;
- normalized evidence views and transformation records;
- duplicate and correlation classifications;
- conflicts and contradictions;
- quality-gate outcomes and validation findings;
- confidence dimensions, uncertainty, exclusions, and limitations;
- supersession, revocation, retention, and disclosure constraints.

## Admission Outcomes

- **Eligible** — mandatory content and critical Phase 13 gates pass.
- **Eligible with Limitations** — declared use permits explicit, separable limitations.
- **Rejected** — package is invalid, revoked, out of Scope, unauthorized, or fails mandatory fitness.
- **Quarantined** — trust, Tenant, security, classification, or integrity risk blocks use.
- **Insufficient** — required evidence or metadata is absent and cannot support the Objective.
- **Review Required** — an external authority question blocks safe admission.

## Immutability

Reasoning binds the exact package version and content hashes. Any package correction, supersession, revocation, Context change, or material validation change invalidates the binding and requires a new admission assessment.

## Rules

- **RINPUT-001:** Raw or unprocessed information must never bypass the Processing Output Package.
- **RINPUT-002:** Package admission must validate identity, version, Scope, Tenant, authorization, classification, lineage, quality, conflict, and lifecycle.
- **RINPUT-003:** Reasoning must bind immutable references rather than copy or rewrite Processing Artifacts.
- **RINPUT-004:** Rejected or quarantined packages must not support substantive inference.
- **RINPUT-005:** Eligible-with-limitations status must constrain every affected Unit and Result.
- **RINPUT-006:** Material package change requires re-admission and new reasoning lineage.
- **RINPUT-007:** Admission is fitness validation, not approval or truth certification.

## Enterprise Example

A package has complete provenance but contains an unresolved conflict and an explicit Conditional Pass for one domain. It may be admitted only for reasoning whose Objective accepts that limitation; every affected Result must retain the conflict and conditional status.

## Boundaries

This contract defines semantic eligibility, not an endpoint, payload, queue, authentication mechanism, or ingestion path.
