# 27 — Representation Lifecycle

## Definition

The **Representation Lifecycle** is the governed applicability and disposition model for an Architecture Knowledge Representation. It contains the statuses Created, Validated, Approved, Deprecated, Archived, Superseded, and Rejected.

Representation Lifecycle is not Architecture Document Lifecycle, Entity Lifecycle, Relationship Lifecycle, or Runtime state. A change in one does not silently change another.

## Why

Representations may be created, reviewed, superseded, or rejected independently of the documents they represent. Conflating lifecycles would allow representation processing to approve source architecture, deprecate documents, or present stale knowledge as current.

## Mental Model

```text
Source Document Lifecycle        Representation Lifecycle
Draft / Approved / ...           Created / Validated / ...
         │                                 │
         └── provenance relationship ──────┘

They influence applicability checks.
They remain governed separately.
```

## Core Components

- **Created:** Representation identity and declared scope exist, but validation is incomplete.
- **Validated:** required checks have completed and their findings are recorded; validation does not imply approval.
- **Approved:** recognized authority has approved the Representation as conformant for declared scope and version.
- **Deprecated:** Representation is no longer preferred for current use but remains historically traceable.
- **Archived:** Representation is retained for audit or history and is not active.
- **Superseded:** another explicitly governed Representation replaces it within declared scope.
- **Rejected:** Representation failed acceptance or governance review and must not be presented as approved.

## Principles

1. Every lifecycle status must be explicit, evidenced, and authority-aware.
2. Status must not be guessed from filenames, timestamps, or source lifecycle.
3. Validated must not be treated as Approved.
4. Approved Representation status must not approve or change source documents.
5. Deprecation, archival, rejection, and supersession must preserve provenance and history.
6. Superseded must identify the replacing Representation and scope where available.
7. A source change may make a Representation stale but does not silently transition its lifecycle.
8. Lifecycle compatibility must be evaluated before current use.
9. Representation Version and Lifecycle must remain distinct.

## Enterprise Example

An Approved Representation is based on an Approved document set. When one source document receives a new approved version, the Representation becomes potentially stale and requires review. It does not automatically become Deprecated or Superseded. Governance creates and validates a revised Representation, then explicitly supersedes the earlier one while preserving both histories.

## Design Notes

- This is a status model, not a Runtime state machine or workflow.
- Transition authority and operational process are outside this phase.
- Rejected Representations remain valuable audit evidence but have no approved applicability.
- Created and Validated Representations may support review only when visibly labelled.
- Source freshness is an integrity concern, not an automatic lifecycle mutation.

## Common Mistakes

- Copying Document Lifecycle status into Representation Lifecycle.
- Treating validation as approval.
- Auto-deprecating a Representation after source change.
- Deleting Rejected or Superseded history.
- Using the latest timestamp as current applicability.
- Treating lifecycle status as Runtime state.
- Assuming approval transfers source authority.

## Related Architecture

- [03 — Architecture Document Lifecycle](03-document-lifecycle.md)
- [11 — Document Metadata Model](11-document-metadata-model.md)
- [23 — Extraction Validation Model](23-validation-model.md)
- [25 — Architecture Knowledge Representation Model](25-knowledge-representation-model.md)

