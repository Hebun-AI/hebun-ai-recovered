# 04 — Contract Principles

The principles governing canonical memory contracts. These are binding design constraints, not preferences. Any implementation behind the Director gate must uphold them. They extend the Phase 6A [memory principles](../memory/04-memory-principles.md) from the architecture level to the contract level.

## 1. Canonical

Each memory object has one authoritative definition, owned in the canonical layer and shared by every consumer. There is no second, private definition of `Memory` or `MemoryEvent`. Canonical means: one source of truth for what a memory object is.

## 2. Immutable definition

A memory contract, once ratified, does not change meaning. What `MemoryEvent` denotes is fixed. Immutability applies to the *definition* — the meaning of the object — not to the volume of memories recorded against it. The vocabulary is fixed; the history recorded through it grows freely.

## 3. Stable identity

Each memory object keeps a stable identity across time and across runtime generations. A `Memory` is the same kind of thing today as it was when first defined, regardless of how it is stored or served underneath. Stable identity is what lets a memory recorded years ago stay interpretable now.

## 4. Append-compatible

Memory contracts are shaped so that history grows by accretion, never by rewrite. The contracts support adding memories and superseding prior ones with new records — never editing a recorded fact in place. This carries the Phase 6A append-first principle into the contract definitions themselves: the objects are designed to be added to, not mutated.

## 5. Workspace scoped

Every memory object is bound to a single workspace. A memory belongs to one tenant; a `MemoryReference` does not cross a workspace boundary. This inherits Phase 5's hard tenant isolation — memory is as workspace-bounded as the graph it references.

## 6. Organization owned

Every memory is owned by an organizational entity through `MemoryOwner`. No memory floats unowned. Ownership makes memory governable and ties it to the accountable part of the organization — the memory analogue of the graph's single-sourced ownership.

## 7. Technology independent

Memory contracts define *what memory objects are*, never *how they are stored or served*. No contract references a storage engine, database, index, or retrieval mechanism. The contracts are deliberately implementation-agnostic, so the same objects survive any number of runtime technologies beneath them.

## 8. Versionable

Memory contracts evolve through versioning, not silent edits. A change to an object's meaning produces a new version; the prior version is deprecated on a defined path and retained as a permanent record. Versionability is what reconciles the need for stability with the reality that understanding evolves ([06 — Versioning](06-versioning.md)).

## 9. Provenance-bearing

Every memory carries its origin — its `MemorySource`, its time. This is not optional metadata; it is constitutive. A memory object without provenance is not a valid memory. This inherits directly from the Phase 5A and 6A provenance discipline.

---

These principles are the Phase 5 and 6A discipline — canonical, immutable, owned, workspace-scoped, provenance-bearing — expressed for the memory objects. Memory contracts hold the organizational past to the same standards the entity and relationship contracts hold the present: fixed in meaning, owned, attributed, isolated, and evolvable only by deliberate versioning.
