# 05 — Ingestion Boundaries

## Definition

The **Architecture Ingestion Boundary** determines which information may enter Hebun's architectural knowledge boundary, under what classification, and with what authority. Admission does not mean canonical approval. Every admitted source must retain its type, scope, lifecycle, version, provenance, and authority status.

## Mental Model

```text
Eligible governed documents
   Architecture · Policy · Runbook · Specification
                    ↓ classified admission
        Architecture Knowledge Boundary

Excluded operational streams
   Logs · Runtime Telemetry · Execution State
                    ✕
```

Generated artifacts may enter only as derived, non-canonical evidence unless separately governed and approved as canonical sources.

## Principles

### Architecture Documents

- May be ingested when source identity, scope, lifecycle, version, and authority are known.
- Approved architecture supplies canonical architectural truth.
- Draft, Deprecated, and Archived architecture remains clearly status-labelled.

### Policies

- May be ingested as governed policy sources.
- A Policy is not automatically an architecture document.
- Policy authority and architectural authority must remain distinguishable.

### Runbooks

- May be admitted as operational guidance when relevant to architectural understanding.
- Runbooks are not canonical architecture unless explicitly approved as such.
- Procedure steps must not be promoted into architecture principles.

### Specifications

- May be ingested with explicit classification.
- Architecture specifications may carry normative architectural content.
- Technical or implementation specifications remain implementation evidence, not architecture by default.

### Generated Artifacts

- Summaries, indexes, projections, reports, and generated diagrams are derived artifacts.
- They are non-canonical unless they pass a separate explicit architecture approval process.
- Their source evidence and generation context must remain traceable.

### Logs

- Logs are not ingested as architecture.
- They describe events or operations, not normative structural commitments.
- Historical logs may become evidence in another future architecture, but not through Phase 11A.

### Runtime Telemetry

- Runtime telemetry is not ingested as architecture.
- It represents operational condition, not architectural truth.
- Telemetry may later inform governed evidence models, but it cannot define architecture.

### Execution and Runtime State

- Execution plans, task state, checkpoints, tool results, and Runtime state are outside the Architecture Ingestion boundary.
- Architecture Ingestion must not read active execution as canonical architecture or alter it.

## Enterprise Example

An Approved boundary document, a policy governing access, a recovery runbook, and Runtime logs all mention “authority.” Safe ingestion classifies them separately. The architecture document supplies the canonical structural boundary; the policy supplies governed constraints; the runbook supplies operational guidance; the logs remain excluded from architectural truth.

## Design Notes

- Source type and authority must be established before semantic use.
- “Readable” does not mean “eligible,” and “eligible” does not mean “canonical.”
- Mixed documents require explicit classification of the relevant evidence; they must not be normalized into one authority class.
- Runtime and Execution exclusions preserve the Phase 8 boundary.
- Generated visualization remains a projection and never becomes the Source of Truth.

## Common Mistakes

- Treating every Markdown file as canonical architecture.
- Promoting a Runbook procedure into a normative architecture rule.
- Using logs to infer architecture without an approved source.
- Treating telemetry as current architecture.
- Assuming a generated diagram is authoritative.
- Mixing Policy authority with architecture authority.
- Allowing ingestion to observe or control active execution.
