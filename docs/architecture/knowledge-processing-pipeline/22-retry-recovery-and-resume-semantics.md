# 22 — Retry, Recovery, and Resume Semantics

## Purpose

This document defines safe architectural semantics for failures and continuation while leaving Runtime mechanisms deferred.

## Failure Classes

| Class | Meaning | Required Treatment |
|---|---|---|
| Transient Failure | condition may clear without changing canonical inputs | bounded retry may be eligible |
| Permanent Failure | same valid attempt cannot succeed under current constraints | terminate affected scope |
| Partial Completion | separable valid outputs exist alongside incomplete scope | preserve and mark limitations |
| Integrity Failure | artifact, lineage, hash, or transformation cannot be trusted | reject or quarantine |
| Policy Failure | processing conflicts with applicable policy | reject or escalate |
| Trust Failure | source, content, metadata, or tenant boundary is unsafe | quarantine |
| Reserved Judgment | authoritative decision is required | suspend and escalate |

## Retry Boundary

Retry eligibility, maximum attempts, timing class, and escalation threshold are policy declarations. Phase 13 defines no scheduler or timing algorithm. Every retry uses idempotency protection and a new attempt record.

## Checkpoint and Resume

A Resume Checkpoint identifies the Processing Case, stage boundary, valid input and artifact versions, Context version, rules, validation outcomes, unresolved findings, and integrity evidence. A Resume Token is a conceptual reference to that checkpoint, not a bearer credential or implementation format.

## Recovery Handoff

Recovery hands preserved artifacts and a verified checkpoint to the responsible processing boundary. It records failure class, completed scope, remaining obligations, retry eligibility, manual requirements, and descendant impacts.

## Manual Intervention

Human intervention may supply missing authoritative information, release quarantine, correct a source registration, or make a reserved decision through an external governed process. It must not silently edit immutable artifacts or bypass quality gates.

## Rules

- **RECOVERY-001:** Retry must be limited to explicitly recoverable failures.
- **RECOVERY-002:** Every retry must be idempotent, separately auditable, and tenant-bound.
- **RECOVERY-003:** Resume must begin from a verified checkpoint, never an inferred processing position.
- **RECOVERY-004:** Valid artifacts must be preserved across failure, retry, recovery, and resume.
- **RECOVERY-005:** Stage isolation must prevent a local failure from corrupting unaffected artifacts.
- **RECOVERY-006:** Permanent, policy, trust, and reserved-judgment failures must not be retried as transient.
- **RECOVERY-007:** Manual intervention must be authorized, attributable, bounded, and revalidated.

## Boundaries

No backoff, timer, worker, queue, transaction, checkpoint store, or operational runbook is selected.
