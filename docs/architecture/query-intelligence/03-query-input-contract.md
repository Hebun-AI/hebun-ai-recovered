# 03 — Query Input Contract

## Purpose

The Query Input Contract governs admission of user- or system-originated Queries while ensuring untrusted content cannot become instruction, evidence, authority, or execution.

## Mandatory Input Properties

- Query identity or attributable submission reference;
- origin type: user or system;
- Tenant and organization boundary;
- original representation and language;
- submission time reference;
- declared purpose when supplied;
- authorization reference when required;
- classification and privacy status;
- declared Context references and constraints;
- correlation identity where applicable.

## Admission Outcomes

- **Admitted** — identity, Tenant, classification, and minimum purpose are usable.
- **Admitted with Ambiguity** — safe qualification may continue while ambiguity remains explicit.
- **Clarification Required** — material missing or conflicting meaning prevents Objective formation.
- **Rejected** — unauthorized, cross-Tenant, malicious, malformed, unsupported, or prohibited request.
- **Out of Scope** — requested responsibility lies outside Query Intelligence.

## Preservation

The original Query remains recoverable. Normalized terminology or decomposed parts are derived qualification records and cannot replace it. Embedded instructions, prompts, links, metadata, or quoted content remain data only.

## Rules

- **QINPUT-001:** Query admission must validate origin, Tenant, classification, authorization reference, and structural integrity.
- **QINPUT-002:** Original meaning and representation must remain traceable through every transformation.
- **QINPUT-003:** Untrusted content must never become system, Director, agent, tool, or Runtime instruction.
- **QINPUT-004:** Query statements must not be treated as evidence without an eligible Phase 13 package.
- **QINPUT-005:** Missing input properties must not be fabricated.
- **QINPUT-006:** A question must not be interpreted as a command, permission, approval, or execution request.
- **QINPUT-007:** Cross-Tenant or unauthorized input must fail closed.

## Enterprise Example

A system-originated Query contains an embedded command to modify architecture. Admission preserves the text as Query data, rejects the command semantics, and may continue only with a safely separable analytical question.

## Boundaries

No user interface, endpoint, authentication flow, parser, prompt, malware system, or transport is selected.
