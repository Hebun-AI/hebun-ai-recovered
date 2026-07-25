# Phase 6D — Memory Integrity & Governance

## Purpose

This directory defines the **integrity and governance architecture of Organizational Memory** — the rules that keep memory trustworthy and the discipline that keeps it accountable. Phase 6A designed how an organization remembers; 6B fixed the canonical memory objects; 6C defined their semantics and retrieval boundaries. This phase (6D) defines what makes a body of memory **valid** and how memory is **governed** over its life.

It is **design only**. It defines integrity rules, governance principles, failure scenarios, and the architectural interaction with future runtime. It defines no runtime, storage, retrieval, database, or API. It modifies no Phase 5, 6A, 6B, or 6C artifact.

## The integrity and governance layer

```
Memory Contracts (6B) + Semantics (6C)   (what memory is and means)
        │
        ▼
Memory Integrity & Governance (6D)        (what keeps it valid and accountable)  ← this phase
        │
        ▼
Future Memory Runtime                     (records and serves valid, governed memory)
```

Integrity answers *"is this body of memory sound?"* — no rewritten facts, no missing provenance, no orphaned or cross-tenant memory. Governance answers *"is this body of memory accountable?"* — owned, retained, auditable, compliant. Together they are the guarantees a future runtime must uphold so that memory can be trusted as the organization's record of the past.

## Documents

| Document | Covers |
|---|---|
| [01 — Integrity Philosophy](01-integrity-philosophy.md) | Why memory needs integrity; valid vs invalid memory |
| [02 — Integrity Rules](02-integrity-rules.md) | The invariants a valid body of memory must satisfy |
| [03 — Governance](03-governance.md) | Ownership, retention, compliance, auditability, AI-memory governance |
| [04 — Failure Scenarios](04-failure-scenarios.md) | Concrete invalid-memory cases and the expected response |
| [05 — Future Runtime](05-future-runtime.md) | How runtime upholds integrity and governance, architecturally |

## Relationship to prior phases

- **Phase 5** — the frozen entities and graph memory references. Integrity enforces that memory's references into Phase 5 stay valid and workspace-bounded; it modifies nothing in Phase 5.
- **Phase 6A** — the memory principles (append-first, never-rewrite, provenance, ownership). This phase expands those principles into enforceable integrity invariants and governance rules.
- **Phase 6B** — the canonical objects. Integrity is checked against these objects; governance applies to them.
- **Phase 6C** — semantics and retrieval boundaries. Integrity guarantees the soundness that the semantic and retrieval layers assume.

## Director Gate

This phase defines only integrity and governance architecture. No runtime, storage, retrieval, or APIs. **Phase 6E (Architecture Review & Final Closure) proceeds under Director direction.**
