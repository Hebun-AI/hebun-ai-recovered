# 03 — Architecture Document Lifecycle

## Definition

The **Architecture Document Lifecycle** is the governed status model that determines how a document may be interpreted at a given time. Phase 11A recognizes four statuses: Draft, Approved, Deprecated, and Archived.

Lifecycle status is source metadata with architectural meaning. Ingestion observes it; ingestion does not assign or change it.

## Mental Model

```text
Draft
  ↓ explicit approval
Approved
  ↓ explicit supersession
Deprecated
  ↓ retention transition
Archived
```

This model expresses normative applicability, not a Runtime state machine. Status transitions occur only through the existing architecture governance process.

## Principles

### Draft

- A Draft is proposed architecture under review.
- It is not canonical truth and must not govern Director decisions as approved architecture.
- It may be ingested for comparison or review only when clearly labelled Draft.

### Approved

- An Approved document is canonical within its declared scope and applicable version.
- It may provide normative evidence for Director Intelligence.
- Approval must be explicit and traceable to the governing authority.

### Deprecated

- A Deprecated document was once applicable but has been superseded or withdrawn from current normative use.
- It remains historical architectural evidence.
- Its replacement or deprecation reference must be preserved where available.

### Archived

- An Archived document is retained for history, audit, or institutional memory.
- It is not active architecture.
- Archival must not erase provenance or prior lifecycle history.

### Version Awareness

- Document identity and document version are distinct.
- Every extracted statement must remain bound to the version that supplied it.
- A later version does not make earlier evidence disappear.
- The currently applicable canonical version must be determined from explicit governance metadata, not guessed from filenames or timestamps.

## Enterprise Example

A Draft proposes a new authority boundary while the current Approved document retains the existing boundary. Both may be visible for review. The Approved version remains the basis for architectural decisions until the proposal receives explicit approval. If approved, the former version may become Deprecated and later Archived without losing its historical provenance.

## Design Notes

- Lifecycle status and source authority are separate checks; an “Approved” label without recognized authority is insufficient.
- Multiple historical versions may coexist without becoming conflicting current truth.
- Deprecated and Archived content may support historical reasoning but must not be mixed into current canonical claims.
- Ingestion must expose lifecycle ambiguity as a validation issue.

## Common Mistakes

- Treating Draft content as approved because it is newer.
- Assuming a file in an archive is still active.
- Deleting deprecated evidence from architectural history.
- Collapsing all versions into one undifferentiated summary.
- Guessing approval from a title, directory, or timestamp.
- Letting ingestion itself perform lifecycle transitions.
