# 30 — Architecture Decision Records

## Purpose

These concise Architecture Decision Records capture the major irreversible boundaries of Phase 13. All decisions are canonical for Phase 13 unless superseded through the repository's architecture authority.

## ADR-13-001 — Processing Is Separate from Reasoning

**Decision:** Processing prepares governed evidence packages; it does not infer conclusions.  
**Rationale:** Evidence preparation and conclusion formation require different authority, validation, and lifecycle boundaries.  
**Consequence:** Future reasoning consumes but must not rewrite Processing Output Packages.

## ADR-13-002 — Original Evidence Is Immutable

**Decision:** Extracted, normalized, or generated representations never overwrite original evidence.  
**Rationale:** Auditability and correction require recoverable source material.  
**Consequence:** Corrections and reprocessing create new artifact versions.

## ADR-13-003 — Transformations Preserve Lineage

**Decision:** Every derived artifact records parents, actor, rule version, time, hashes, anchors, and validation.  
**Rationale:** Derived representations must be reconstructable.  
**Consequence:** Broken lineage blocks affected use.

## ADR-13-004 — Confidence Is Not Truth

**Decision:** Confidence communicates bounded evidence support only.  
**Rationale:** A score cannot create correctness, authority, or approval.  
**Consequence:** Confidence is dimensional and always carries limitations.

## ADR-13-005 — Contradictions Are Preserved

**Decision:** Conflicting evidence remains independently visible.  
**Rationale:** Silent merging fabricates consensus.  
**Consequence:** Packages carry conflict records and downstream limitations.

## ADR-13-006 — Uncertain Correlation Is Not Asserted

**Decision:** Possible matches remain uncertain until canonical criteria confirm them.  
**Rationale:** False identity contaminates every descendant artifact.  
**Consequence:** Correlation classes and evidence are explicit.

## ADR-13-007 — Retries Must Be Idempotent

**Decision:** Retry, replay, and reprocessing preserve prior attempts and prevent duplicate side effects.  
**Rationale:** Recovery must not change logical meaning accidentally.  
**Consequence:** Attempts have independent audit identity and verified checkpoints.

## ADR-13-008 — Tenant Boundaries Are Mandatory

**Decision:** Every Phase 13 record is tenant-bound; cross-tenant use is prohibited by default.  
**Rationale:** Isolation is a primary integrity and confidentiality boundary.  
**Consequence:** Tenant mismatch causes rejection or quarantine.

## ADR-13-009 — Untrusted Content Cannot Become Instruction

**Decision:** Source content, metadata, and embedded directives are data only.  
**Rationale:** Content-controlled processing would transfer authority to untrusted input.  
**Consequence:** Prompt injection and active content are isolated and never executed.

## ADR-13-010 — Processing Output Package Is Not a Decision

**Decision:** A package contains evidence, provenance, quality, conflict, confidence, and limitations—not recommendation, approval, or execution choice.  
**Rationale:** Director and future reasoning authority must remain separate.  
**Consequence:** Package acceptance confirms contract fitness only.

## Rules

- **ADR-001:** Each Phase 13 design and future implementation must conform to ADR-13-001 through ADR-13-010.
- **ADR-002:** A conflict with an ADR must be escalated; it must not be resolved through silent reinterpretation.
- **ADR-003:** ADR supersession requires explicit authority, replacement identity, rationale, and impact analysis.
