# 06 — Decision Log

The major architectural decisions made across Phase 6, with rationale. Permanent records — a superseded decision is recorded and replaced, never rewritten.

---

## D-1 — Memory as a first-class capability

**Decision.** Treat Organizational Memory as a distinct architectural pillar alongside entities (5A) and the relationship graph (5B), not as a datastore, cache, or log.

**Why.** An organization that cannot remember relives every decision. Making memory first-class — with its own philosophy, model, and principles — is what lets the platform reason with continuity rather than from a blank slate.

## D-2 — Architecture, contracts, semantics, integrity as separate layers

**Decision.** Split memory into distinct phases: architecture (6A), canonical contracts (6B), semantics (6C), integrity & governance (6D).

**Why.** Each layer answers a different question (how / what / meaning / validity) and evolves at a different rate. Separating them keeps contracts stable while semantics and runtime evolve, and keeps integrity a distinct guarantee rather than scattered logic.

## D-3 — Append-first, never-rewrite facts

**Decision.** Memory grows by accretion; recorded facts are immutable; correction is supersession, not editing.

**Why.** The core promise of memory is a fixed, trustworthy past. Rewriting would make history fiction. Supersession preserves both the old understanding and the new, with the relationship recorded.

## D-4 — Provenance and ownership mandatory

**Decision.** Every memory carries complete provenance and exactly one owner.

**Why.** Memory without traceable origin is rumor; memory without an owner is ungovernable. Provenance and ownership are constitutive of a valid memory — the basis of both trust and governance.

## D-5 — Technology independence

**Decision.** Memory contracts and semantics define what memory is and means, never how it is stored or retrieved.

**Why.** Memory is permanent; storage technology is not. Keeping the definitions technology-independent lets a memory recorded today stay interpretable across any number of future runtime generations.

## D-6 — Contracts stable, runtime free

**Decision.** Memory contracts are immutable definitions changed only by versioning; runtime that consumes them may evolve freely.

**Why.** Consumers depend on meaning, not mechanism. This asymmetry lets memory be both permanent in meaning and modern in implementation — the load-bearing separation of the memory domain.

## D-7 — Integrity as a distinct guarantee layer

**Decision.** Define integrity as whole-body invariants that a future runtime upholds before memory is trusted, rather than checks scattered through runtime.

**Why.** Individually valid records can form an untrustworthy history. Establishing integrity as a distinct upstream guarantee means reasoning consumes sound memory and stays free of defensive logic.

## D-8 — Reference-only dependence on Phase 5

**Decision.** Memory references Phase 5 entities and the graph (via MemoryOwner, MemoryReference) but never modifies them.

**Why.** Phase 5 is frozen. Memory adds the time axis over the frozen structure as a clean, one-directional layer — the structure is unaware of and unchanged by the memories that reference it.

## D-9 — Workspace isolation for memory

**Decision.** Every memory is workspace-scoped; no ownership or reference crosses a workspace.

**Why.** Memory inherits Phase 5's hard tenant boundary. A cross-workspace memory is a tenant leak — the most severe integrity failure. Isolation is enforced at the memory level, not merely assumed.

## D-10 — Build 6D and 6E before closing Phase 6

**Decision.** During the Phase 6 closure request, Phase 6D (Integrity & Governance) and Phase 6E (this review) did not yet exist; they were built before closure rather than recording them as complete without artifacts.

**Why.** A closure document must reflect real deliverables. Recording phases as complete without their artifacts would falsify the historical record. The Director directed building them first; this decision preserves the integrity of the closure itself.

---

Every decision is traceable to a Phase 6 design body and consistent with the platform lifecycle. None has been reversed; D-10 records a process correction rather than hiding it.
