# 09 — Recovery Authority

## Purpose

Define who may authorize restoration of valid operation and the constitutional boundaries recovery must preserve.

## Recovery Identity

Recovery is a policy-governed, explicitly authorized effort to restore valid operation, responsibility, evidence integrity, or safe continuity after failure or degradation.

Recovery is not retry, self-healing, orchestration, control loop, rollback implementation, re-planning, new execution authorization, policy exception, or authority creation.

## Recovery Eligibility

Eligibility requires classified failure, preserved evidence, applicable policy, authorized recovery class, accountable owner, Scope, safety constraints, expected restoration meaning, Human Override boundary, termination condition, and audit obligations.

## Recovery Authority

Recovery authority derives from existing constitutional authority and applicable policy. It must never be inferred from failure detection, operational urgency, technical capability, past success, Alert severity, or Runtime availability.

## Rules

- **P24-RECOVERY-001:** Recovery restores operation but never creates authority.
- **P24-RECOVERY-002:** Recovery must remain policy-governed.
- **P24-RECOVERY-003:** Recovery must remain auditable and attributable.
- **P24-RECOVERY-004:** Recovery must never reinterpret constitutional authority.
- **P24-RECOVERY-005:** Recovery must not rewrite evidence, history, Memory, or policy.
- **P24-RECOVERY-006:** Recovery ≠ Retry and Recovery ≠ Self-Healing.
- **P24-RECOVERY-007:** Recovery mechanisms and algorithms remain outside Phase 24.

## Enterprise Example

An authorized recovery may restore a constrained Runtime responsibility. It cannot broaden Scope or silently repeat failed work.
