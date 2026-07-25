# 05 — Open Issues

Unresolved architectural issues identified during the Phase 6 review. Each is a deliberate deferral or a minor note, not a defect blocking readiness. For each: description, impact, priority, and recommended resolution phase.

---

## OI-1 — Object-name usage varies by layer

**Description.** The semantics (6C) and integrity (6D) bodies discuss memory concepts partly in lowercase prose ("event", "timeline", "context") rather than always using the CamelCase canonical object names from 6B.

**Impact.** Cosmetic. Meaning is unaffected; the concepts map cleanly to the objects. A reader could momentarily wonder whether "timeline" means the `MemoryTimeline` object — it does.

**Priority.** Low.

**Recommended resolution phase.** Editorial pass during the memory-contract implementation phase; align prose to canonical object names where precision helps.

---

## OI-2 — Two progressions may be conflated

**Description.** 6A uses data → knowledge → memory → experience → wisdom (value progression); 6C uses data → information → memory → meaning → knowledge → context (semantic progression). Both are labeled, but a reader could conflate them.

**Impact.** Low. Each is clearly scoped where introduced. Risk is reader confusion, not architectural contradiction.

**Priority.** Low.

**Recommended resolution phase.** A brief cross-note linking the two progressions could be added in an editorial pass; not required for correctness.

---

## OI-3 — MemoryContext integrity is generic only

**Description.** MemoryContext is covered by whole-memory integrity rules but has no context-specific integrity rule (e.g. context completeness).

**Impact.** Minor. A memory with invalid context already fails validity because context is constitutive (6B). An explicit rule would add precision, not close a hole.

**Priority.** Low.

**Recommended resolution phase.** The integrity implementation phase, alongside defining how integrity is checked.

---

## OI-4 — Governance composes with not-yet-designed engines

**Description.** 6D governance (access, compliance) composes with the future Policy and Permission engines, which are backlog items not yet designed.

**Impact.** None on Phase 6 completeness. Governance principles are defined; their enforcement engines are correctly deferred and marked future.

**Priority.** Low.

**Recommended resolution phase.** The Policy Engine and Permission Engine design phases.

---

## Summary

| ID | Issue | Priority | Resolve in |
|---|---|---|---|
| OI-1 | Object-name usage varies by layer | Low | Editorial / implementation pass |
| OI-2 | Two progressions may be conflated | Low | Editorial pass |
| OI-3 | MemoryContext integrity generic only | Low | Integrity implementation |
| OI-4 | Governance needs future engines | Low | Policy / Permission phases |

**No blocking issues were identified.** Every open item is a deliberate deferral or a low-priority editorial note. None requires Phase 6 rework, and none prevents a readiness verdict.
