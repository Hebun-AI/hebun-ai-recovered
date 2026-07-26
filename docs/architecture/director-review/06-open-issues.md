# 06 — Open Issues

Unresolved architectural issues identified during the Director Intelligence review. Each is a deliberate deferral or a minor forward-looking note, not a defect blocking readiness. For each: description, impact, priority, and recommended resolution.

---

## OI-1 — Governance engines are referenced but not yet designed

**Description.** Governance alignment (7E) and governance control (7G) compose with the future **Policy Engine** and **Permission Engine** ([backlog 13](../../architecture-backlog/13-policy-engine.md), [14](../../architecture-backlog/14-permission-engine.md)), which are not yet designed.

**Impact.** None on Phase 7 completeness. Phase 7 defines *how decisions and the workflow must align with governance*; the enforcement engines are correctly deferred and marked future throughout.

**Priority.** Low.

**Recommended resolution.** The Policy Engine and Permission Engine design phases.

---

## OI-2 — Execution interface is defined only from the reasoning side

**Description.** Phase 7 ends at a verified, decision-ready outcome with committing actions marked, approved by the Director. The **Execution** domain that consumes this is a future phase; the hand-off is defined from Phase 7's side only.

**Impact.** Minor and expected. Phase 7's stop point is deliberate and consistent; the execution side of the interface is the next domain's design, not a Phase 7 gap.

**Priority.** Low.

**Recommended resolution.** The Execution architecture phase, which defines the consuming side of the hand-off.

---

## OI-3 — Layered risk and validation appear in multiple bodies

**Description.** Risk is weighed in reasoning, decision, and verification; validation appears in planning, decision, verification, and orchestration ([consistency review](02-consistency-review.md)).

**Impact.** None — on inspection these are deliberate, layered defense-in-depth with distinct scopes, not duplication. Noted only so future readers understand the layering is intentional.

**Priority.** Informational.

**Recommended resolution.** No action needed; documented here for clarity.

---

## Summary

| ID | Issue | Priority | Resolve in |
|---|---|---|---|
| OI-1 | Governance engines not yet designed | Low | Policy / Permission phases |
| OI-2 | Execution interface defined one-sided | Low | Execution architecture phase |
| OI-3 | Layered risk/validation across bodies | Informational | No action (intentional) |

**No blocking architectural issues were identified.** Every open item is a deliberate deferral, a correct scope boundary, or an intentional design choice. None requires Phase 7 rework, and none prevents a readiness verdict.
