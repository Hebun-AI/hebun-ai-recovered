# 05 — Future Runtime

How a future Memory Runtime is expected to uphold integrity and governance — **architecturally only**. No APIs, no storage, no retrieval, no algorithms. This document fixes the interaction shape and its boundaries.

## Runtime upholds; it does not decide the rules

The defining architectural fact: **runtime enforces the integrity and governance guarantees defined in this phase; it does not author them.** The invariants ([02](02-integrity-rules.md)) and governance principles ([03](03-governance.md)) are fixed here. Runtime is downstream, obligated to uphold them.

```
Integrity Rules + Governance (6D)   (the guarantees — fixed)
        │
        ▼
Memory Runtime                      (records, holds, serves — upholding the guarantees)
        │  valid, governed memory only
        ▼
Semantic / Retrieval / Reasoning    (consume trusted memory)
```

Runtime is the layer that makes the guarantees real, but it never relaxes or reinterprets them.

## What runtime is obligated to uphold

- **Immutability and append-only.** Runtime records new memory and supersession; it never edits or deletes a recorded fact. The append-only history is a runtime obligation, not a runtime choice.
- **Provenance and ownership completeness.** Runtime admits only memory that carries complete provenance and an owner. It never fabricates either to force admission.
- **Reference and workspace validity.** Runtime keeps references resolvable and every memory within its workspace. It never bridges tenants or follows a dangling reference.
- **Timeline consistency.** Runtime maintains temporal coherence; it never reorders memory to hide a contradiction.
- **Governance obligations.** Runtime honors access, retention, and auditability governance — no silent deletion, no ungoverned access, full traceability.

## What runtime relies on

Because integrity and governance are established here, the layers above runtime may **assume** the memory they receive is sound and accountable, without re-checking. The semantic, retrieval, and reasoning layers ([6C](../memory-semantics/README.md)) consume trusted memory and stay free of defensive integrity logic. This is the same independence pattern the platform uses throughout: guarantees established once, upstream, relied on downstream.

## What is deliberately not specified

This document does not decide, and must not be read as deciding:

- When or how integrity is checked — at recording, at load, continuously.
- How memory is stored, indexed, or served.
- Any API, endpoint, or protocol.
- Any database, storage engine, or retrieval mechanism.
- Any algorithm for validation, supersession, or audit.

Those are implementation decisions for the phases after the Director gate, made contracts-first and verified per the [Capability Lifecycle](../../architecture-backlog/00-capability-lifecycle.md). This phase fixes only the **obligation**: runtime upholds the integrity and governance guarantees; it never authors, relaxes, or silently violates them.
