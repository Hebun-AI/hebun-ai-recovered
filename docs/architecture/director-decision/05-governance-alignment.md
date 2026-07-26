# 05 — Governance Alignment

## Purpose

Governance Alignment is where decision **ensures the outcome conforms to the organization's governance** — policy, permission, obligation, and the committing-action boundary. A decision that is attractive and well-ranked but violates governance is invalid. Governance alignment is the check that a decision the Director could approve is a decision the Director *may* approve.

## Architectural role

Governance Alignment is the conformance layer of the decision architecture, working with [Decision Validation](06-decision-validation.md) to gate the outcome. It composes with the future governance engines — [Policy](../../architecture-backlog/13-policy-engine.md) and [Permission](../../architecture-backlog/14-permission-engine.md) — and enforces the platform-wide Director Gate: it identifies every committing or irreversible action in the chosen plan and confirms it is marked for the Director's explicit approval ([Director Authority](../director-reasoning/05-director-authority.md)). Governance is a hard bound, not a soft preference.

## Inputs

- The **ranked, risk-balanced alternatives** — the plans under consideration.
- The **governance context** — applicable policy, permission, data-residency and compliance obligations, workspace scope.
- The **committing-action markers** carried from planning ([planning principles](../director-planning/01-planning-principles.md)).

## Outputs

- A **governance verdict per alternative** — aligned, or specifically non-compliant (which policy, which permission, which obligation).
- **Confirmation** that every committing action in a viable plan is flagged for explicit Director approval at execution.
- Rejection of any alternative that **cannot be brought into alignment**, removed from consideration.

## Boundaries

- Governance is a **hard bound** — a decision that would violate policy, permission, or obligation is invalid regardless of its opportunity. Alignment is not negotiable against upside.
- Governance Alignment **checks conformance; it does not enforce or execute** — it verifies alignment and marks gated actions; enforcement engines and the Director's approval do the rest.
- It **produces no action** and **defines no method** — this document establishes that governance alignment exists and its role, not any policy-evaluation algorithm. Governance nodes (Policy, Permission) are future capabilities; this defines how decisions must be shaped to align with them.

## Future direction

As the Policy and Permission engines are designed, Governance Alignment deepens — checking richer policy, finer permission, more precise obligation. The bound is fixed: governance is a hard limit, and every committing action stays gated to the Director. Depth grows; the non-negotiable conformance holds.
