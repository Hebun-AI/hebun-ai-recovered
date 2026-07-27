# 01 — Why Architecture Ingestion

## Definition

**Architecture Ingestion** is the governed, read-only admission of canonical architecture documents into Hebun's architectural knowledge boundary with source identity, lifecycle status, version, provenance, and evidence preserved.

It is not document storage, content generation, Runtime observation, or autonomous interpretation. It establishes the trustworthy entrance through which existing architecture becomes safely available to reasoning without surrendering authority to a derived representation.

### Problem Statement

Hebun's architecture is distributed across normative documents and phases. Without a controlled ingestion boundary, a system may read an obsolete version, mix approved and draft material, lose source context, treat inference as fact, or allow generated summaries to displace canonical documents. The problem is not access to text; it is preserving architectural authority while making the text usable.

### Enterprise Motivation

An AI-native enterprise must understand its own structural commitments without silently rewriting them. Safe ingestion makes architectural decisions discoverable and traceable while protecting governance, lifecycle, ownership, and cross-phase boundaries.

### Director Perspective

The Director requires evidence that every architectural claim comes from an identifiable canonical source with an applicable lifecycle status and version. Architecture Ingestion prepares that evidence. It does not decide, approve, or execute; Director Intelligence reasons over the admitted evidence and the Director retains authority.

### Design Goals

- Preserve canonical sources as authoritative.
- Admit architecture read-only.
- Make extraction repeatable and traceable.
- Distinguish direct source content, derived knowledge, and inference.
- Respect document lifecycle and version.
- Reject unsupported architectural claims.
- Prevent Runtime or generated artifacts from becoming architecture implicitly.

## Mental Model

```text
Architecture Source
  identity · authority · lifecycle · version
                 ↓
        Controlled Read Boundary
                 ↓
       Traceable Derived Knowledge
                 ↓
     Evidence for Director Intelligence
```

The boundary moves knowledge, not authority. Authority remains with the canonical source and its governance regime.

## Principles

1. Ingestion must begin with an identifiable source.
2. Source authority must be known before content is treated as architecture.
3. Reading must not modify the source.
4. Every derived claim must retain a path back to source evidence.
5. Absence of evidence must remain absence, not be filled by invention.
6. Director decisions must distinguish canonical statements from interpretation.
7. Ingestion must stop at knowledge admission; it must not cross into action.

## Enterprise Example

An approved architecture document and an older deprecated version contain different boundary language. Safe ingestion retains both versions and their statuses, but only the approved applicable version supplies current canonical claims. The deprecated document remains historical evidence. The ingestion layer neither merges the texts nor chooses a new architectural rule.

## Design Notes

- Architecture Ingestion complements [Director Verification](../director-verification/README.md) by giving verification traceable source evidence.
- It remains upstream of [Execution Architecture](../execution-review/10-phase-8-final-closure.md); admission of knowledge never authorizes work.
- It inherits enterprise-wide governance and traceability from [Phase 9](../enterprise-review/11-phase-9-final-closure.md).
- It preserves the Architecture/Runtime distinction closed in [Phase 10](../business-capabilities/50-phase-10-closure.md).

## Common Mistakes

- Treating ingestion as copying text without source authority.
- Assuming the newest timestamp is automatically the approved version.
- Turning a summary into the canonical source.
- Filling missing architectural statements with plausible inference.
- Reading logs or Runtime telemetry as architecture.
- Letting ingestion trigger execution or architectural modification.
