# 07 — State Semantics

## Purpose

Define how operational condition is interpreted without creating transition logic.

## Semantic Components

State includes:

- bounded subject and Runtime admission;
- condition classification;
- effective and observed time context;
- supporting Event and observation references;
- provenance and attribution;
- Scope, Tenant, classification, and Governance context;
- version and prior-State relationship;
- uncertainty, limitations, and conflict;
- validity and supersession meaning.

## Current Condition

“Current” means the latest constitutionally valid condition for a declared subject and observation boundary. It does not mean universal truth, real-time availability, scheduling priority, authority, or permanent validity.

## State Relationships

A State may be consistent with, supersede, conflict with, or remain indeterminate relative to another State. These relationships describe evidence; they do not execute transitions.

## Rules

- **P22-STATE-SEMANTICS-001:** State meaning must be explicit for its subject and time boundary.
- **P22-STATE-SEMANTICS-002:** Latest observation must not automatically become valid current State.
- **P22-STATE-SEMANTICS-003:** Conflicting State evidence must remain attributable.
- **P22-STATE-SEMANTICS-004:** State aggregation must preserve source boundaries and uncertainty.
- **P22-STATE-SEMANTICS-005:** State relationships must not become transition commands.
- **P22-STATE-SEMANTICS-006:** State must remain distinct from Runtime health, Governance status, and Memory lifecycle.

## Enterprise Example

Two observations may support conflicting current conditions because they have different effective times. State semantics preserves the conflict rather than choosing by arrival order.
