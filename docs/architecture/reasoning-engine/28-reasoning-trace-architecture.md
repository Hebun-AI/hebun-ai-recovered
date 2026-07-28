# 28 — Reasoning Trace Architecture

## Purpose

The Reasoning Trace is the append-only logical record that makes every material analytical dependency reconstructable from package admission through Output Package release.

## Trace Elements

- Case, input package, Objective, Scope, and Context identities;
- evidence admissions, exclusions, citations, and roles;
- Hypothesis and Assumption versions;
- Inference Units, classes, premises, transformations, and findings;
- branch, convergence, alternative, contradiction, and failure records;
- weighting, uncertainty, confidence propagation, and validation;
- state transitions, rule versions, time references, and responsible reasoning role;
- Result and Output Package mappings.

## Reconstruction

Reconstruction must reproduce the declared analytical basis and verify evidence references, hashes, lineage, Scope, rule versions, Unit dependencies, status transitions, uncertainty, confidence rationale, validation, and output mapping. Reconstruction does not require reproducing hidden model internals.

## Immutability and Supersession

A finalized Trace version is immutable. Re-analysis creates a new Trace version linked to predecessor, changed inputs, changed rules, and affected Results. Retention and disclosure inherit package and Tenant constraints.

## Rules

- **RTRACE-001:** Every material Result statement must map to Trace elements and immutable evidence.
- **RTRACE-002:** Trace entries must be append-only within a version and independently identifiable.
- **RTRACE-003:** Failed, rejected, conflicted, and alternative branches must remain reconstructable.
- **RTRACE-004:** Trace must preserve rule versions, assumptions, uncertainty, confidence, and validation.
- **RTRACE-005:** A broken material evidence or Unit path blocks affected Result release.
- **RTRACE-006:** Trace access must preserve Tenant, classification, privacy, and disclosure controls.
- **RTRACE-007:** Trace is not a workflow, prompt, hidden chain, model transcript, or Runtime log.
- **RTRACE-008:** Supersession must preserve historical reconstruction.

## Boundaries

No log format, event store, tracing protocol, graph database, serialization, or retention service is selected.
