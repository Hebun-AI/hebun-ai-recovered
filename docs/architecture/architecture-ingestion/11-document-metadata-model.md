# 11 — Document Metadata Model

## Definition

**Architecture Document Metadata** is the governed descriptive and administrative context required to identify, classify, steward, evaluate, review, and preserve an Architecture Document without replacing its content.

Canonical properties are **Identity, Title, Type, Phase, Domain, Authority, Lifecycle, Version, Owner, Maintainer, Approval, Supersedes, Superseded By, Evidence, Review, and Archive**.

Metadata is not document content, a Knowledge Graph, Runtime state, inference, or proof by itself. A metadata assertion requires canonical support and remains unresolved when evidence is absent.

## Why

Architectural prose cannot be interpreted safely without knowing which governed object it belongs to, whether it is applicable, who stewards it, and what approval or historical relationships exist. Metadata supplies context while preventing administrative labels from being mistaken for normative architecture.

## Mental Model

```text
Document Content                 Document Metadata
architectural meaning            governed context
definitions and rules            identity, status, stewardship

Together support interpretation; neither substitutes for the other.
```

## Core Components

- **Identity** stably distinguishes the document.
- **Title** is a human-readable label, not identity.
- **Type** classifies the governed source kind.
- **Phase** records architecture phase association.
- **Domain** declares architectural domain.
- **Authority** records normative basis and limits.
- **Lifecycle** records Draft, Approved, Deprecated, or Archived applicability.
- **Version** identifies the governed revision.
- **Owner** records accountable governance ownership.
- **Maintainer** records stewardship without inheriting approval authority.
- **Approval** records explicit approval evidence and disposition.
- **Supersedes** identifies explicitly replaced material.
- **Superseded By** identifies the approved replacement.
- **Evidence** records provenance supporting metadata.
- **Review** records governed review status or requirements.
- **Archive** records archival disposition and historical context.

## Principles

1. Metadata must be canonically evidenced or unresolved.
2. It must not be hallucinated from filenames, folders, timestamps, formatting, or convention.
3. Identity, title, path, and version remain distinct.
4. Owner, Maintainer, Approver, and Director authority remain distinct.
5. Lifecycle and approval remain separate; Approved requires approval evidence.
6. Version order does not establish normative precedence without governance evidence.
7. Supersession is explicit and traceable where evidence permits.
8. Archive metadata preserves historical provenance.
9. Metadata changes do not silently rewrite normative content.
10. Content must not be treated as metadata for convenience.
11. Runtime observations must not populate canonical document metadata.

## Enterprise Example

A filename includes “final,” but no recognized approval exists. Its Title may contain that word while Approval and Lifecycle remain unresolved. It must not be promoted to Approved. A later Director-approved closure may supply evidence, but Director authority is not transferred to the document Maintainer.

## Design Notes

- This defines semantic properties, not front matter, schema, syntax, or validation software.
- Inapplicable and unknown are different and must not be collapsed.
- Metadata evidence may reside in the document or another governed source.
- Review metadata records a governance fact; it does not conduct review.
- Archive and supersession preserve history.

## Common Mistakes

- Treating a path or title as identity.
- Inferring Approved from “final” or timestamps.
- Treating Maintainer as approver.
- Trusting generated front matter as canonical.
- Copying Runtime state into lifecycle.
- Guessing missing metadata.
- Allowing a metadata index to become Source of Truth.

## Related Architecture

- [03 — Architecture Document Lifecycle](03-document-lifecycle.md)
- [04 — Source of Truth](04-source-of-truth.md)
- [07 — Architecture Document Model](07-architecture-document-model.md)
- [10 — Architecture Reference Model](10-architecture-reference-model.md)
- [Phase 9 — Enterprise Architecture Closure](../enterprise-review/11-phase-9-final-closure.md)

