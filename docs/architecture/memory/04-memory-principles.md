# 04 — Memory Principles

The architectural principles that govern Organizational Memory. These are binding design constraints, not preferences. Any implementation behind the Director gate must uphold them. They are what make memory trustworthy as a record of the past.

## 1. Memory is append-first

New memory is added; existing memory is not edited in place. The organization's history grows by accretion. Correcting or updating an understanding produces a *new* memory that supersedes the old, with both retained. Append-first is what lets the timeline be a faithful record rather than a mutable draft.

## 2. Memory preserves history

The past is kept, not compacted away. Superseded decisions, prior states, and abandoned directions remain in memory. History is the point — an organization that discards its past to save space discards its ability to learn from it. Retention is deliberate and complete.

## 3. Memory never rewrites facts

A recorded fact is immutable. What was true at a time stays recorded as having been true then, even after it ceases to be true. Memory does not retroactively alter the past to match the present. A changed reality is a *new* memory layered over the old, never an edit of the old — this mirrors the Phase 5 principle that records are inert and permanent.

## 4. Memory has provenance

Every memory carries its origin — its Source, its time, and how it came to be known. Nothing is remembered anonymously. Provenance is what separates memory from rumor: a memory whose origin cannot be traced cannot be trusted or governed. This inherits directly from the Phase 5A provenance model.

## 5. Memory supports reasoning

Memory exists to be reasoned over. It is structured, provenance-rich, and time-ordered specifically so that reasoning — Director judgment, learning, simulation — can consume it. Memory is not an archive for its own sake; it is the past made usable. Its shape serves the reasoning layers that read it.

## 6. Memory is organization-centric

Memory is structured around the organization's own entities and relationships (Phase 5), not around generic records. What is remembered is meaningful to *this* organization — its roles, capabilities, parties, and decisions. Memory is anchored to the organizational model, so history is always history *of something* the organization recognizes.

## 7. Memory survives personnel changes

Memory belongs to the organization, not to the individuals who created it. When a person leaves, their contributions to organizational memory remain — owned by the organization, attributed by provenance, but not lost. Institutional knowledge outlives the people who formed it. This is memory's core promise: continuity across the churn of who happens to be present.

## 8. Memory is owned and governable

Every memory has an Owner — a Phase 5 entity accountable for it. No memory floats unowned. Ownership makes memory governable: it can be scoped, retained, and audited under clear accountability, and it stays within its workspace boundary exactly as the graph does.

## 9. Memory is bounded

Not everything is memory. Runtime state, cache, and transient context are explicitly outside it ([05 — Memory Boundaries](05-memory-boundaries.md)). Memory is the durable, meaningful past — keeping its boundary sharp is what prevents it from degrading into an undifferentiated log.

---

These principles echo the Phase 5 discipline — inert records, provenance, ownership, workspace scope — extended into the time dimension. Memory is the graph's history held to the same standards the graph itself is held to: permanent, attributed, owned, and coherent.
