# 15 — Conceptual APIs and Contracts

## Scope

This document defines semantic interaction contracts only. It does not select a protocol, endpoint style, serialization, authentication mechanism, deployment, or implementation technology.

## Contract Envelope

Every interaction carries:

- caller identity and authority;
- subject and workspace boundary;
- declared purpose;
- consent basis;
- requested scope;
- sensitivity ceiling;
- evidence and provenance requirements;
- expected response class;
- retention and audit obligations;
- correlation identity;
- failure and escalation semantics.

## Conceptual Contracts

| Contract | Responsibility | Preconditions | Result |
|---|---|---|---|
| **ProposeMemory** | Submit a candidate memory | source, owner, purpose, evidence, sensitivity, retention | candidate only; never permanent before integrity and approval |
| **ApprovePermanentMemory** | Authorize eligible personal memory for long-term use | user authority, integrity pass, informed scope | versioned approval or refusal |
| **RevokeMemoryUse** | Withdraw future use permission | owner/subject authority and resolved scope | eligibility change, propagation obligation, audit record |
| **AnnotateRecord** | Add a versioned interpretation | access, source, annotation type | linked annotation; original unchanged |
| **AssembleContinuity** | Request minimum relevant context | valid purpose, consent, scope, sensitivity | temporary Continuity Package or refusal |
| **ConstructTimeline** | Build an evidence-linked temporal view | eligible events and time scope | chronology with gaps, conflicts, confidence |
| **AssessValueAlignment** | Compare evidence to approved values | user-approved value statement | observation, tension, unknown, questions |
| **ReviewDecision** | Compare expected and actual outcomes | decision authority/access and evidence | review with lessons and uncertainty |
| **ReflectGrowth** | Produce user-centered trajectory reflection | user-defined objective and approved evidence | progress interpretation, gaps, questions |
| **EvaluatePurposeLinks** | Examine task-to-purpose relationships | approved purpose hierarchy | alignment, weak links, conflicts, unknowns |
| **PrepareRelationshipContext** | Assemble consent-bound collaboration context | purpose, party boundaries, sensitivity | minimal context or refusal |
| **PreserveLegacyArtifact** | Register an attributable legacy record | ownership, rights, consent, retention | versioned artifact record |
| **AssessFlourishing** | Reflect across user-selected domains | explicit opt-in and sensitive-data controls | non-diagnostic reflection |
| **ArchiveRecord** | Make a record inactive | authority and retention validation | archived status; no silent deletion |
| **RestoreRecord** | Re-enable eligible archived context | renewed purpose, consent, integrity, authority | restored version or refusal |

## Failure Contract

Interactions fail safely with explicit outcomes such as Unauthorized, Consent Required, Scope Unresolved, Integrity Failed, Insufficient Evidence, Conflict Detected, Sensitivity Prohibited, Retention Conflict, Out of Scope, or Human Review Required.

## Idempotency and Audit

Repeated requests must not create duplicate permanent memories or approvals. Every accepted, rejected, revoked, archived, restored, or disclosed operation requires an auditable governance record.

## Boundaries

These contracts never imply autonomous execution. No contract may bypass Memory Integrity, privacy, security, constitutional, or human-approval gates.

