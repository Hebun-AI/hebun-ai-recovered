# 04 — Contract Lifecycle

A relationship contract travels a fixed path from idea to retirement. Each stage has a defined purpose and gate. A contract advances only when the prior stage is satisfied. This lifecycle is a specialization of the platform [Capability Lifecycle](../../architecture-backlog/00-capability-lifecycle.md), applied to a single relationship type.

## Lifecycle

```
Proposal
  ↓
Architecture Review
  ↓
Director Approval
  ↓
Canonical Contract
  ↓
Runtime Consumption
  ↓
Deprecation
  ↓
Replacement
```

---

## Proposal

**Purpose.** Put forward a new relationship, or a new version of an existing one.

**What it entails.** A written definition: canonical name, category, direction, multiplicity, ownership, and the organizational fact it asserts. Where it extends the frozen Phase 5A enum, it is labeled a Phase 5B.1 Candidate Relationship Contract.

**Gate to advance.** The proposal is complete and self-consistent against the [contract guidelines](03-contract-guidelines.md).

## Architecture Review

**Purpose.** Test the proposal against the vocabulary and principles.

**What it entails.** Checking for overlap with existing relationships, correct category placement, naming and direction conformance, and alignment with the [design principles](../relationship-graph/06-design-principles.md) — no duplicated ownership, cycles only where intended, single-stated edges.

**Gate to advance.** Architecture review passes. This precedes any code review, per the lifecycle rule.

## Director Approval

**Purpose.** Authorize the relationship to become canonical.

**What it entails.** Explicit Director decision to admit the contract into the canonical vocabulary. Per relationship, at the moment of admission.

**Gate to advance.** **Director approval granted.** Nothing becomes canonical without it.

## Canonical Contract

**Purpose.** The relationship is now an authoritative, immutable definition.

**What it entails.** The contract is defined once in the canonical layer, owned there, carrying provenance. From this point its meaning, direction, and multiplicity are fixed; only versioning can change them.

**Gate to advance.** The contract is available for consumption; edges may be created against it.

## Runtime Consumption

**Purpose.** Runtime reads and reasons over the contract.

**What it entails.** Traversal, impact analysis, and future capabilities consume the relationship. Runtime never redefines it — consumption is read-only against the canonical definition ([06 — Future Runtime](06-future-runtime.md)).

**Gate to advance.** Remains here for the contract's productive life. A semantic change need re-enters the lifecycle at Proposal as a new version.

## Deprecation

**Purpose.** Signal that a relationship is being retired.

**What it entails.** The contract is marked deprecated with a defined window. It stays readable and traversable so existing edges keep conforming; no new edges should be created against it. A replacement, if any, is named.

**Gate to advance.** The deprecation window elapses and consumers have a migration path.

## Replacement

**Purpose.** Complete the transition to a successor.

**What it entails.** Edges migrate to the replacement contract per the documented path. The deprecated contract is retired but **retained as a permanent record** — never erased. The vocabulary now reflects the successor.

**End state.** The relationship's evolution is fully recorded: proposed, ratified, consumed, deprecated, replaced — every step auditable.

---

Every stage is auditable and every transition is deliberate. No relationship is added, changed, or removed silently. Director approval is mandatory before any relationship becomes canonical, and again for any production step in the implementation phase that follows this design.
