# 21 — Temporal Reasoning

## Purpose

Temporal Reasoning evaluates order, duration, overlap, applicability, version, lifecycle, and change across time-bounded evidence.

## Temporal Elements

- source event time, observation time, registration time, and processing time;
- effective-from, effective-until, supersession, revocation, and archival intervals;
- before, after, overlaps, during, contains, and disjoint relations;
- known, estimated, conflicting, and unknown temporal values;
- current-as-of Scope and historical reconstruction.

## Integrity

Processing time does not replace source or effective time. Later evidence does not automatically have higher authority. Missing time cannot be inferred from file order or retrieval order. Temporal conflict remains explicit.

## Rules

- **TEMPORAL-001:** Every temporal finding must declare the time dimension and applicable interval.
- **TEMPORAL-002:** Event, observation, registration, processing, and effective times must remain distinct.
- **TEMPORAL-003:** Version and lifecycle applicability must be checked before temporal inference.
- **TEMPORAL-004:** Unknown or conflicting time must constrain dependent Results.
- **TEMPORAL-005:** Recency must not create authority or truth.
- **TEMPORAL-006:** Temporal order must not be treated as causation or execution sequence.

## Enterprise Example

A policy was approved after a capability version was retired. Temporal reasoning may determine that the policy did not govern that historical version, while preserving uncertainty if effective dates conflict.

## Boundaries

No scheduler, clock service, temporal database, event stream, prediction, or Runtime sequencing is defined.
