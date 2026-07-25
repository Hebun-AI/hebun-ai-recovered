# 06 — Governance Validation

Beyond structural integrity, a valid graph must be **governable**: accountable, auditable, and compatible with the rules an organization operates under. This document describes governance validation architecturally — the conditions that keep the graph answerable to policy, permission, and compliance. No implementation.

Governance nodes (Policy, Permission) are future capabilities; the validation principles below define how the graph must be shaped so those capabilities can attach cleanly when they arrive.

## Policy compatibility

**Principle.** The graph must not represent a state that a governing policy forbids.

Policy expresses constraint — financial limits, data residency, tool restrictions. A valid graph is one whose relationships are consistent with the policies that govern its nodes. Governance validation checks that `governs` edges attach to nodes that can be governed, and that no relationship asserts something a binding policy prohibits. The graph and its policies must be able to coexist.

## Permission compatibility

**Principle.** Relationships must be consistent with the authorization model.

Permission answers *who may act*. A valid graph does not encode a relationship that authorization would forbid — an actor assigned a responsibility it has no permission to hold, an agent playing a role outside its permission scope. Governance validation ensures participation and accountability edges are compatible with the permission structure, so the graph never asserts authority that permission denies.

## Capability ownership

**Principle.** Every capability is owned, and owned once.

Capabilities are organizational abilities; an unowned capability is ungoverned — no one accountable for its use, scope, or retirement. Governance validation reinforces [integrity rule 6](02-integrity-rules.md) specifically for capabilities: each has exactly one owner, making it a governable, accountable asset rather than a free-floating ability.

## Executive accountability

**Principle.** Senior responsibilities trace to an accountable actor.

Accountability must not dead-end. A critical responsibility or a managed unit must trace, through roles, to an actor who is answerable for it. Governance validation guards against accountability gaps — a high-criticality responsibility with no assigned role, an executive role left unfilled while its duties persist. Someone is always answerable.

## Auditability

**Principle.** Every relationship's origin and history is recoverable.

Governance depends on being able to ask *who established this, when, and on what basis.* Every edge carries provenance and lifecycle, per Phase 5A. Governance validation treats missing or incoherent provenance as a validity concern — an unauditable relationship cannot be governed, because its accountability cannot be traced.

## Compliance

**Principle.** The graph can demonstrate conformance to external obligations.

Compliance regimes (data residency, regulatory scope) impose obligations the graph must be able to evidence. Governance validation ensures the graph carries the relationships needed to demonstrate conformance — residency bound to the correct workspace, regulated entities linked to their obligations — so compliance is a property the graph can show, not merely claim.

## Graph evolution

**Principle.** Change preserves governance invariants.

The graph is not static; nodes and edges are added, deprecated, replaced. Governance validation applies **across change**: an evolution that would orphan accountability, duplicate ownership, or break a compliance link is invalid, even if each individual edit looks benign. Governance is validated on the graph *after* a change, not only on the change in isolation — the organization stays governable as it evolves.

---

Governance validation is architectural: it defines the governable shape a graph must keep. The engines that will consume these guarantees — [Policy](../../architecture-backlog/13-policy-engine.md), [Permission](../../architecture-backlog/14-permission-engine.md) — are separate, gated capabilities. This phase specifies the conditions; it builds none of them.
