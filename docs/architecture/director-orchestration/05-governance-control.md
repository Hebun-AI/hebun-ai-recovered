# 05 — Governance Control

## Purpose

Governance Control is where orchestration **enforces the Director Gates and governance across the whole workflow** — ensuring that, however the components collaborate, authority stays with the Director and no committing action escapes explicit approval. Each component respects the authority boundary in its own scope; governance control is what enforces it *across* the components, at the workflow level, where a gap between layers could otherwise let something slip.

## Architectural role

Governance Control is orchestration's guardian function, working with [Phase Coordination](02-phase-coordination.md) (which marks where gates fall) and consuming the committing-action markers that [Information Flow](03-information-flow.md) carries. It upholds the platform-wide Director Authority principle ([Phase 7A](../director-reasoning/05-director-authority.md)) at the seams of the workflow, and composes with the future governance engines — [Policy](../../architecture-backlog/13-policy-engine.md) and [Permission](../../architecture-backlog/14-permission-engine.md). It is where the workflow's gates are actually held.

## Inputs

- The **Director Gates** defined for the workflow — where approval is required.
- The **committing-action markers** carried through the workflow from planning and decision.
- The **governance context** — policy, permission, obligation applicable to the workflow.

## Outputs

- **Enforced gates** — the workflow pauses at each Director gate and does not advance without explicit approval.
- **Governance verdicts at the workflow level** — confirmation that the coordinated outcome, as a whole, stays within governance.
- **Blocked progression** where a gate is unmet or governance would be violated — surfaced, not overridden.

## Boundaries

- Governance is enforced as a **hard control** — orchestration never lets a committing action proceed without the Director's explicit approval, and never bypasses governance ([orchestration principles](01-orchestration-principles.md)). No coordination convenience overrides a gate.
- It **enforces; it does not grant** — orchestration holds the gate; the Director grants approval. Orchestration never approves on the Director's behalf.
- It **controls the workflow's gates; it does not execute** — enforcing a gate stops or permits progression of an advisory workflow; it takes no action in the world.
- It **defines no method** — this document establishes that governance control exists and its role, not any enforcement algorithm.

## Future direction

As the Policy and Permission engines are designed, Governance Control deepens — enforcing richer policy and finer permission across the workflow. The control is fixed: gates are hard, authority stays with the Director, no committing action proceeds unapproved. Depth grows; the non-negotiable enforcement holds.
