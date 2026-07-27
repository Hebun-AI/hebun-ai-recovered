# 17 — Artifact Versioning and Supersession

## Purpose

This document defines immutable artifact versioning and explicit change semantics so that correction and reprocessing never erase processing history.

## Versioning Model

An Artifact Identity denotes the conceptual record within a Processing Case; an Artifact Version denotes immutable content and metadata at a point in its lifecycle. Any material change creates a new version with its own hash, lineage, validation, and status.

## Change Semantics

| Change | Required Treatment |
|---|---|
| Correction | new version linked to corrected version and rationale |
| Reprocessing | new derived versions under recorded request, rules, and inputs |
| Supersession | prior version retained and marked superseded by a named version |
| Withdrawal | producer removes current-use claim without deleting history |
| Revocation | authorized authority prohibits declared future use |
| Invalidation | validation determines artifact cannot support affected use |
| Reinstatement | explicit authority, reason, and full revalidation |

## Derived Artifact Impact

A material parent change triggers impact analysis across descendants. Affected artifacts become `Revalidation Required`, `Invalid`, `Withdrawn`, or `Superseded`; they never remain silently current. Unaffected branches may remain valid when separability is demonstrated.

## Lineage Reconstruction

For any time or package version, the system must be able to identify then-current artifacts, superseded ancestors, transformation rules, validation outcomes, and revocation or withdrawal effects.

## Rules

- **VERSION-001:** Existing artifact versions must never be silently overwritten.
- **VERSION-002:** Every material correction or reprocessing result must create a new immutable version.
- **VERSION-003:** Supersession must identify predecessor, successor, reason, actor, and time.
- **VERSION-004:** Withdrawal, revocation, and invalidation must remain distinct.
- **VERSION-005:** Parent changes require deterministic descendant impact analysis.
- **VERSION-006:** Historical Processing Output Packages must remain reconstructable with their then-applicable evidence.
- **VERSION-007:** Deletion obligations may remove content while preserving the minimum lawful tombstone and audit evidence.

## Boundaries

No source-control mechanism, storage layout, event-sourcing implementation, or retention technology is selected.
