# 27 — Audit Trace

## Purpose

The Governance Audit Trace is the append-only logical record that makes every admission, applicability check, Evaluation Unit, state, and Outcome reconstructable.

## Trace Elements

Input package and hashes; declared use; Scope and Context; Policy, Rule, Authority, Role, Permission, Approval, Compliance, Privacy, Classification, Risk, Redaction, Exception, and Review references; Evaluation Units; state transitions; findings; conflicts; insufficiency; rules; Outcome; and supersession.

## Rules

- **GAUDIT-001:** Every material Outcome statement must map to Trace elements and canonical references.
- **GAUDIT-002:** Trace entries must be append-only within an immutable version.
- **GAUDIT-003:** Failed, denied, conflicted, insufficient, and review paths must remain reconstructable.
- **GAUDIT-004:** Rule versions, applicability, rationale, conditions, and uncertainty must be preserved.
- **GAUDIT-005:** Broken material Trace blocks Outcome release.
- **GAUDIT-006:** Trace access must preserve Tenant, classification, privacy, retention, and disclosure.
- **GAUDIT-007:** Audit Trace is not a workflow, prompt, Runtime log, or enforcement record.

## Boundaries

No event store, logging platform, trace protocol, database, serialization, or audit product is selected.
