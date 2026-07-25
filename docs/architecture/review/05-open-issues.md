# 05 — Open Issues

Unresolved architectural issues identified during the Phase 5B review. Each is a **deliberate deferral or a minor forward-looking note**, not a defect blocking readiness. For each: description, impact, priority, and the recommended phase for resolution.

---

## OI-1 — Design vocabulary not yet reconciled with the frozen enum

**Description.** Nine relationships (`contains`, `belongs_to`, `manages`, `governs`, `supports`, `provides`, `uses`, `depends_on`, `collaborates_with`) are specified as Phase 5B.1 Candidate Relationship Contracts extending the frozen `ORGANIZATIONAL_RELATIONSHIP_TYPES` enum. They are designed and specified but not yet ratified into the canonical enum.

**Impact.** The "canonical" relationship vocabulary is partly proposed. No downstream design depends on ratification yet, so impact is currently zero; it becomes blocking only when graph contracts are implemented.

**Priority.** Medium.

**Recommended resolution phase.** The relationship-contract implementation phase (post-gate, the first implementation step after 5B.4). Ratify aliases and enum extensions there, contracts-first.

---

## OI-2 — LegalEntity lacks explicit validation treatment

**Description.** LegalEntity is covered for purpose, relationship, and specification, but graph-validation addresses it only through generic node rules, with no called-out legal/compliance example.

**Impact.** Minor. Generic rules already validate LegalEntity as any node; the gap is illustrative depth, not missing enforcement.

**Priority.** Low.

**Recommended resolution phase.** The governance-capability design phases (Policy / Permission engines), where legal and compliance validation naturally deepens.

---

## OI-3 — Governance relationships target not-yet-defined nodes

**Description.** `governs` targets Policy and `uses` targets Tool — future backlog nodes, not Phase 5A entities. The relationships are specified but cannot be exercised until those nodes exist.

**Impact.** None on Phase 5A entity coverage. The relationships are correctly staged and marked "(future)".

**Priority.** Low.

**Recommended resolution phase.** The phases that introduce the Tool Registry and Policy Engine (Foundation backlog items).

---

## OI-4 — `DELEGATES_TO` present in the frozen enum, thin in the design vocabulary

**Description.** Phase 5A's `ORGANIZATIONAL_RELATIONSHIP_TYPES` includes `DELEGATES_TO`. The Phase 5B design vocabulary treats delegation only in passing (mentioned in the contract lifecycle and relationship notes) rather than as a first-class specified relationship with an endpoint-matrix row.

**Impact.** Minor. The frozen contract already supports delegation; the specification simply has not yet elevated it to a full entry. No conflict — the enum is not modified — but the design vocabulary and the frozen enum are not one-to-one on this name.

**Priority.** Medium.

**Recommended resolution phase.** The relationship-contract implementation phase, alongside OI-1 reconciliation — decide whether `DELEGATES_TO` gets a full specification entry or remains a reserved enum member.

---

## Summary

| ID | Issue | Priority | Resolve in |
|---|---|---|---|
| OI-1 | Vocabulary not reconciled with frozen enum | Medium | Relationship-contract implementation |
| OI-2 | LegalEntity validation implicit only | Low | Governance-capability phases |
| OI-3 | Governance relationships target future nodes | Low | Tool Registry / Policy Engine phases |
| OI-4 | `DELEGATES_TO` thin in design vocabulary | Medium | Relationship-contract implementation |

**No blocking issues were identified.** Every open item is a deliberate deferral consistent with the lifecycle (design now, ratify at implementation) or a minor forward-looking note. None requires Phase 5B to be reworked, and none prevents a readiness verdict.
