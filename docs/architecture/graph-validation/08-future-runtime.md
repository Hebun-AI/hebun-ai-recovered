# 08 — Future Runtime

How future runtime is expected to interact with the validation rules — **architecturally only**. No APIs, no storage, no graph database, no validation algorithms, no implementation. This document fixes the interaction shape and its boundaries, nothing more.

## Runtime consumes validated graphs

The defining architectural fact: **runtime operates on graphs that validation has already certified.** Validation is the gate; runtime is downstream of it.

```
Graph (authored)
     │
     ▼
Graph Validation      (integrity established here)
     │  valid graphs only
     ▼
Runtime               (traverses, analyzes, reasons — assumes validity)
```

Runtime does not re-establish integrity. It does not defend against invalid graphs, because invalid graphs never reach it. This is the [runtime-independence principle](01-validation-philosophy.md) made concrete: validity is a precondition runtime relies on, not a responsibility runtime carries.

## What runtime relies on

Because a graph reaching runtime is valid, runtime may **assume**, without re-checking:

- Every node is workspace-scoped and every edge is within one workspace.
- Every edge resolves to real, type-compatible nodes.
- Every relationship type is canonical.
- Ownership is unique where required; hierarchies are acyclic and well-typed.
- Governance invariants (accountability, auditability) hold.

These assumptions are what let runtime stay lean — traversal and reasoning are expressed against a trusted structure, free of defensive integrity logic.

## How runtime interacts with the rules

At the architectural level, runtime relates to validation in three ways, none of which is re-implementing validation:

- **Precondition.** Runtime treats validation as an upstream gate already passed. It consumes the result, not the process.
- **Shared vocabulary.** Runtime and validation share the same canonical relationship and integrity definitions. Runtime interprets a valid graph using the same rules validation used to certify it — one source of truth, two readers.
- **Re-validation on change.** When the graph is modified, the modified graph re-enters validation before runtime trusts it again. Runtime never consumes an unvalidated delta.

## What is deliberately not specified

This document does not decide, and must not be read as deciding:

- When or how validation runs — at authoring, at load, continuously.
- How graphs or validation results are stored, indexed, or transported.
- Any API, endpoint, or protocol between validation and runtime.
- Any database or graph-engine technology.
- Any algorithm for validating, traversing, or reasoning.

Those are implementation decisions for the phases after the Director gate, made contracts-first and verified per the [Capability Lifecycle](../../architecture-backlog/00-capability-lifecycle.md). This phase fixes only the **interaction contract**: runtime consumes validated graphs, assumes their integrity, and re-submits changes for validation before trusting them.
