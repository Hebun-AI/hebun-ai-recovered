# 06 — Open Issues

Unresolved architectural issues identified during the Execution Architecture review. Each is a deliberate deferral or intentional design choice, not a defect blocking readiness. For each: description, impact, priority, and recommended resolution.

---

## OI-1 — Concrete agents and tools are not yet designed

**Description.** Phase 8C defines the agent *contract* and 8D the tool *contract*; concrete agents, concrete tools, and their transports (which may include MCP, APIs, browser automation) are deliberately deferred.

**Impact.** None on Phase 8 completeness. The contracts are complete; concrete performers and operations are the correct next design, appropriately out of scope.

**Priority.** Low.

**Recommended resolution.** The concrete-agent and concrete-tool design phases.

---

## OI-2 — State & context implementation is not yet defined

**Description.** Phase 8E defines what state and context *are and must support*; storage, serialization, persistence, and any memory substrate are deliberately deferred.

**Impact.** None on Phase 8 completeness. The continuity contract is complete; its implementation is the correct next design.

**Priority.** Low.

**Recommended resolution.** The state/context implementation phase.

---

## OI-3 — Governance engines are referenced but not yet designed

**Description.** Tool governance (8D) and orchestration governance compose with the future **Policy Engine** and **Permission Engine** ([backlog 13](../../architecture-backlog/13-policy-engine.md), [14](../../architecture-backlog/14-permission-engine.md)), which are not yet designed.

**Impact.** None on Phase 8 completeness. Phase 8 defines how execution aligns with and enforces governance; the engines are correctly deferred and marked future.

**Priority.** Low.

**Recommended resolution.** The Policy Engine and Permission Engine design phases.

---

## OI-4 — Layered monitoring/recovery across bodies

**Description.** Monitoring appears in 8A, 8B, 8C, 8D, and 8E; recovery in 8B and 8E ([consistency review](02-consistency-review.md)).

**Impact.** None — on inspection these are deliberate, layered treatments with distinct scopes (each layer records its own; 8E threads them; 8B applies approved recovery, 8E provides the state that makes recovery possible). Noted so future readers understand the layering is intentional.

**Priority.** Informational.

**Recommended resolution.** No action needed; documented here for clarity.

---

## Summary

| ID | Issue | Priority | Resolve in |
|---|---|---|---|
| OI-1 | Concrete agents & tools not yet designed | Low | Concrete agent / tool phases |
| OI-2 | State/context implementation not defined | Low | State implementation phase |
| OI-3 | Governance engines not yet designed | Low | Policy / Permission phases |
| OI-4 | Layered monitoring/recovery | Informational | No action (intentional) |

**No blocking architectural issues were identified.** Every open item is a deliberate deferral, a correct scope boundary, or an intentional design choice. None requires Phase 8 rework, and none prevents a readiness verdict.
