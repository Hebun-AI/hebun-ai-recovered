# 02 — Integrity Rules

The invariants a valid body of memory must satisfy. Each states **what** must hold and **why**; none defines mechanism. Violation of any rule makes the memory body invalid ([01 — Integrity Philosophy](01-integrity-philosophy.md)). These expand the Phase 6A principles into enforceable invariants.

---

## Rule 1 — Facts are never rewritten

**Invariant.** A recorded memory is immutable. What was recorded stays recorded, unchanged.

**Why.** The core promise of memory is a fixed past. A rewritten fact is a corrupted history — reasoning drawing on it reasons from fiction. Correction happens by recording a *new* memory that supersedes the old, with both retained, never by editing the old.

## Rule 2 — Memory is append-only

**Invariant.** Memory grows by addition. Existing memories are not edited or deleted in place; the history only accretes.

**Why.** Append-only is what makes the timeline a faithful record rather than a mutable draft. Deleting or editing memory would create silent gaps and break historical continuity ([timeline](../memory-semantics/03-memory-timeline.md)).

## Rule 3 — Provenance is complete

**Invariant.** Every memory carries a resolvable `MemorySource` and time.

**Why.** A memory with no traceable origin cannot be trusted or governed — it is rumor, not memory. Provenance is constitutive of a valid memory, not optional metadata ([Phase 6B principle](../memory-contracts/04-contract-principles.md)).

## Rule 4 — Every memory is owned

**Invariant.** Every memory has exactly one `MemoryOwner`, resolving to a Phase 5 entity.

**Why.** Unowned memory is ungovernable and unaccountable — no part of the organization is answerable for it. Single ownership mirrors the graph's single-sourced ownership and is the anchor for governance ([03 — Governance](03-governance.md)).

## Rule 5 — References resolve

**Invariant.** Every `MemoryReference` resolves — to an existing Phase 5 graph element or an existing memory.

**Why.** A dangling reference points at nothing; it corrupts the clusters and event chains reasoning relies on. Memory that references a deleted entity or a nonexistent memory is broken. References must stay valid across the life of the things they point at.

## Rule 6 — The timeline is consistent

**Invariant.** Memories are temporally coherent — ordering respects the times they carry, sequences and event chains do not contradict, and no memory claims to precede its own cause.

**Why.** The timeline is where order becomes meaning ([timeline](../memory-semantics/03-memory-timeline.md)). An inconsistent timeline makes trajectory and causation unreadable, undermining the experience that reasoning distills from history.

## Rule 7 — Memory is workspace-isolated

**Invariant.** Every memory belongs to one workspace; no `MemoryReference` and no ownership crosses a workspace boundary.

**Why.** Memory inherits Phase 5's hard tenant boundary. A memory referencing or owned across workspaces is a tenant leak — the most severe integrity failure, categorically worse than any intra-workspace inconsistency.

## Rule 8 — Supersession is explicit and preserved

**Invariant.** When a memory supersedes another (a correction or update), the supersession is an explicit reference and the superseded memory is retained.

**Why.** Correction must not masquerade as rewrite. Explicit supersession keeps both the old understanding and the new, with the relationship between them recorded — preserving history while allowing understanding to evolve ([versioning discipline](../memory-contracts/06-versioning.md)).

---

## Character of the rules

- **Whole-body invariants.** Each constrains a body of memory, not a single record in isolation.
- **Binary.** A memory body either satisfies a rule or does not; there is no partial validity.
- **Declarative.** The rules state conditions, not procedures. How they are checked is deferred behind the Director gate.
- **Non-recovering.** A rule states what valid looks like; it prescribes no repair. Response to violation is in [04 — Failure Scenarios](04-failure-scenarios.md).
