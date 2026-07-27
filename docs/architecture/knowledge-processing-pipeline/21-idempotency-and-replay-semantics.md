# 21 — Idempotency and Replay Semantics

## Purpose

This document defines deterministic, side-effect-safe repetition of Phase 13 processing without prescribing Runtime retry or storage technology.

## Request Idempotency

Equivalent submissions with the same validated idempotency identity, Tenant, purpose, Scope, source set, policy versions, and acceptance criteria refer to the same logical Processing Request outcome. Materially different inputs require a distinct request version or identity.

## Artifact Idempotency

An artifact production attempt is idempotent when equivalent governed inputs, transformation rule versions, and Context produce the same semantic artifact identity and materially equivalent content. Attempts remain separately auditable even when their result is reused.

## Stage Replay

Replay re-evaluates one stage from a verified checkpoint using declared input versions and rule versions. It must preserve prior outputs, distinguish replay from original processing, and validate all descendants affected by a changed result.

## Duplicate Submission

Duplicate submission may return or reference an existing eligible outcome, join the same logical case under policy, or be rejected when equivalence cannot be established. It must not create duplicate side effects or conceal distinct evidence.

## Safe Reprocessing

Reprocessing uses a new attempt identity, immutable prior artifacts, bounded inputs, explicit rule versions, replay protection, and downstream impact analysis. External mutation, authorization, notification, or execution is outside processing.

## Rules

- **IDEMPOTENCY-001:** Every admitted request must have a tenant-scoped idempotency identity or explicit non-equivalence basis.
- **IDEMPOTENCY-002:** Idempotency comparison must include Context, inputs, policy and rule versions, and acceptance criteria.
- **IDEMPOTENCY-003:** Repeated processing must not duplicate external side effects.
- **IDEMPOTENCY-004:** Replay must preserve original attempts, outputs, and audit evidence.
- **IDEMPOTENCY-005:** Changed inputs or rules must create new artifact versions and trigger impact validation.
- **IDEMPOTENCY-006:** Replay protection must reject or isolate stale, unauthorized, cross-tenant, or mismatched attempts.
- **IDEMPOTENCY-007:** Determinism must be declared per transformation boundary; non-deterministic uncertainty must remain explicit.

## Boundaries

No key format, lock, queue, cache, transaction, delivery guarantee, or retry service is defined.
