# 08 — Decision Log

## Purpose

Record the decisions made during the review — what was checked, what was concluded, and why — so the review's judgments are themselves auditable.

## Decisions

### D-1 — Treat the seven domains as one system, not seven isolated reviews
**Decision:** Review Phases 9A–9G as a single enterprise architecture, auditing the seams between domains as well as each domain.
**Rationale:** Most risk in a layered architecture lives at the boundaries (ownership nesting, authority delegation, structural-vs-operational). Isolated review would miss cross-domain contradictions.

### D-2 — Run a genuine mechanical audit before writing prose
**Decision:** Extract and resolve every internal link, scan for leakage terms, and count files before writing any review document.
**Rationale:** Findings must be evidence-based, not asserted. The link check (0 broken of 56 files) and leakage scan are reproducible facts, not opinions.

### D-3 — Classify ``` fences and boundary-term hits as non-leakage
**Decision:** The ``` fences (ASCII structure diagrams) and the `workflow`/`algorithm`/`runtime` occurrences (all in exclusion statements) are **not** leakage.
**Rationale:** Verified each: the fences contain diagrams, not code; the terms appear only in "no runtime / not a workflow" boundary statements. Flagging them would be a false positive.

### D-4 — Make no changes to existing architecture
**Decision:** Modify no Phase 9, Phase 7, or Phase 8 document.
**Rationale:** The mandate permits modification *only* for a critical inconsistency. None was found ([Open Issues](07-open-issues.md)). Therefore the review is documentation-only, as required.

### D-5 — Record naming variations as observations, not defects
**Decision:** Log filename/naming variation across review and governance documents as non-blocking observations ([O-1](07-open-issues.md)).
**Rationale:** The variations are intentional and semantically correct; all links resolve. They are navigational notes, not inconsistencies.

### D-6 — Assess readiness as READY, not merely "no blockers"
**Decision:** Conclude the architecture is implementation-ready, not just defect-free.
**Rationale:** Completeness, consistency, boundaries, and governance all passed, and the extension model (occupant-agnostic seats + invariants + uniform gate) is clean. Readiness is positively established, not assumed from absence of defects.

## Verdict

Six decisions, all in service of an evidence-based, non-redesigning review. The review's own conclusions are traceable to the checks that produced them.
