# 06 — Runtime Control

## Purpose

Define Control as an authorized constraint on Runtime behavior while preserving separation from execution and implementation.

## Control Identity

A Runtime Control is a bounded, policy-grounded, evidence-supported restriction, allowance, interruption, suspension, termination, isolation requirement, or continuation constraint applied to admitted Runtime responsibility.

Control is not execution, management, policy, Governance, automation, recovery, retry, orchestration, tool invocation, or implementation mechanism.

## Control Eligibility

Eligibility requires applicable policy, evidence, accountable owner, authorized control class, Scope, subject, Tenant, classification, duration, expected effect, Human Override boundary, and audit obligations.

Governance may qualify or authorize control within existing authority. Execution of a control remains a separate operational responsibility.

## Rules

- **P24-CONTROL-001:** Every Control must have explicit authority, policy, evidence, Scope, and accountable owner.
- **P24-CONTROL-002:** Control eligibility must remain distinct from Control execution.
- **P24-CONTROL-003:** Control must use the least constitutionally sufficient restriction.
- **P24-CONTROL-004:** Control must not broaden Runtime authority or responsibility.
- **P24-CONTROL-005:** Control effects, limitations, and termination basis must remain visible.
- **P24-CONTROL-006:** Control semantics must not prescribe automation or implementation.

## Enterprise Example

Governance may authorize a bounded suspension control after evidence confirms policy incompatibility. Phase 24 does not define how suspension is technically performed.
