# 05 — Contract Lifecycle

The lifecycle a canonical memory contract travels, from idea to retirement. Each stage has a defined **purpose** and gate. A contract advances only when the prior stage is satisfied. This is a specialization of the platform [Capability Lifecycle](../../architecture-backlog/00-capability-lifecycle.md), applied to a single memory object.

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

**Purpose.** Put forward a new memory object, or a new version of an existing one.

**What it entails.** A definition of the object's purpose, business meaning, and relationships to other memory objects and to Phase 5 — at the conceptual level, consistent with the [contract principles](04-contract-principles.md).

**Gate to advance.** The proposal is complete and coherent against the principles.

## Architecture Review

**Purpose.** Test the proposal against the memory model and principles.

**What it entails.** Checking for overlap with existing objects, correct relationships, adherence to canonical/immutable/owned/workspace-scoped/technology-independent principles, and consistency with Phase 6A architecture and the frozen Phase 5 model.

**Gate to advance.** Architecture review passes. This precedes any code review.

## Director Approval

**Purpose.** Authorize the object to become canonical.

**What it entails.** Explicit Director decision to admit the contract into the canonical memory vocabulary. Per object, at the moment of admission.

**Gate to advance.** **Director approval granted.** Nothing becomes canonical without it.

## Canonical Contract

**Purpose.** The memory object is now an authoritative, immutable definition.

**What it entails.** The object is defined once in the canonical layer, owned there, technology-independent. From this point its meaning and identity are fixed; only versioning can change them.

**Gate to advance.** The contract is available for consumption; memories may be recorded against it.

## Runtime Consumption

**Purpose.** Runtime records, holds, and serves memories conforming to the contract.

**What it entails.** A future Memory Runtime consumes the object as a fixed definition. Runtime evolves freely beneath the contract but never redefines it — consumption reads the canonical meaning, it does not author it.

**Gate to advance.** Remains here for the object's productive life. A change in meaning re-enters the lifecycle at Proposal as a new version.

## Deprecation

**Purpose.** Signal that a memory object is being retired.

**What it entails.** The object is marked deprecated with a defined window. Existing memories recorded against it stay valid and readable; no new memories should be recorded against it. A replacement, if any, is named.

**Gate to advance.** The deprecation window elapses and consumers have a migration path.

## Replacement

**Purpose.** Complete the transition to a successor.

**What it entails.** New memories are recorded against the replacement. The deprecated object is retired but **retained as a permanent record** — never erased, because the memories recorded under it remain part of the organization's history. The vocabulary now reflects the successor.

**End state.** The object's evolution is fully recorded and auditable: proposed, ratified, consumed, deprecated, replaced — with all history preserved.

---

Every stage is auditable and every transition deliberate. No memory object is added, changed, or retired silently. Director approval is mandatory before any object becomes canonical. This document describes purpose and gates only — no implementation.
