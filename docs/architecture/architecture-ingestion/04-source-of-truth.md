# 04 — Source of Truth

## Definition

The **Canonical Source** is the authoritative architecture document, or explicitly governed document set, from which architectural truth is established for a declared scope and version.

**Derived Knowledge** is a traceable representation produced from canonical sources. **Inference** is an interpretation that goes beyond direct or deterministic source content. Neither is canonical merely because it is useful, searchable, or repeatedly observed.

## Mental Model

```text
Canonical Source
     │ authority remains here
     ├──→ Derived Knowledge
     │       traceable · reproducible · subordinate
     └──→ Inference
             labelled · evidence-backed · non-canonical
```

The branches may help the system understand architecture. They do not move the source of authority.

## Principles

### Canonical Source

- Canonicality must be explicit, scoped, lifecycle-aware, and version-aware.
- Source text and its governance metadata together establish authority.
- A source may be canonical for one scope without being authoritative for another.

### Derived Knowledge

- Derived knowledge must remain traceable to its source evidence.
- It may normalize, index, or relate supported statements without changing their normative meaning.
- It must not become authoritative through repetition, convenience, or system placement.

### Inference

- Inference must be clearly identified as inference.
- It must cite the evidence and assumptions that support it.
- It must never overwrite a canonical statement or fill a canonical gap silently.
- Director Intelligence may evaluate inference, but architectural decisions must remain grounded in canonical architecture and explicit Director authority.

### Synchronization

- Synchronization means maintaining awareness of source identity, lifecycle, version, and derivative freshness.
- It is one-way with respect to authority: canonical source changes may invalidate or refresh derivatives; derivatives never write back automatically.
- A stale derivative must be marked stale rather than presented as current truth.
- Conflicting sources must trigger review, not automatic merging.

### Authority

- Ingestion originates no authority.
- Derived knowledge originates no authority.
- Inference originates no authority.
- Only the governed architecture process and Director approval can establish or change canonical architectural truth.

## Enterprise Example

An Approved document defines that the Director never operates Runtime infrastructure. A derived index may associate that rule with governance and execution boundaries. An inference may suggest a future compliance check. The document remains canonical; the index is derived; the proposed check is inference. Neither derivative may revise the rule.

## Design Notes

- Canonical truth is not equivalent to the most accessible representation.
- Source conflict and source ambiguity are first-class review outcomes.
- Synchronization is a trust/freshness concern in Phase 11A, not a technical transport design.
- Historical versions remain valid evidence about historical architecture even when no longer current.
- Director decisions must expose whether supporting statements are canonical, derived, or inferred.

## Common Mistakes

- Calling an index, summary, or graph the Source of Truth.
- Assuming inference becomes fact after repeated use.
- Allowing derived knowledge to update canonical documents.
- Hiding stale or conflicting evidence.
- Treating generated content as canonical without explicit approval.
- Ignoring source scope when two documents use similar terminology.
