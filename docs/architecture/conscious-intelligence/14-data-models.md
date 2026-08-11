# 14 — Logical Data Models

## Scope

These are technology-independent information contracts, not database schemas, storage choices, or implementation classes.

## Common Governed Record

Every durable record includes:

- stable identity;
- record type;
- owner and subject;
- source and provenance;
- created, occurred, reviewed, and effective time as applicable;
- scope and purpose of use;
- evidence references;
- confidence and uncertainty;
- sensitivity classification;
- consent or authority basis;
- retention policy;
- lifecycle and review status;
- version and supersession links;
- revocation status;
- integrity findings;
- audit references.

## Core Logical Records

| Record | Meaning | Principal Relationships |
|---|---|---|
| **ContinuitySubject** | Person or authorized organization whose continuity is represented | owns scopes, consent, and access boundaries |
| **ContinuityEvent** | Evidence-linked occurrence on a timeline | recorded by Memory; related to goals, decisions, people, projects |
| **ContinuityMemory** | Governed durable record conforming to canonical memory contracts | source, owner, context, evidence, timeline |
| **Annotation** | Versioned human or derived interpretation attached to a record | annotates without rewriting; may be revoked |
| **ValueStatement** | User-approved expression of a value | evaluated by AlignmentAssessment |
| **AlignmentAssessment** | Evidence-bound observation of alignment, tension, or unknown | references values, actions, evidence |
| **DecisionRecord** | Historical record of an important decision | alternatives, assumptions, outcomes, lessons |
| **GrowthObjective** | User-defined direction of development | milestones, evidence, reflections |
| **PurposeStatement** | User-authored or approved long-term meaning | connects to vision, objectives, goals, tasks |
| **RelationshipContext** | Consent-bound context about collaboration or commitments | parties, preferences, meetings, follow-ups |
| **LegacyArtifact** | Attributed preserved work or knowledge | versions, contributors, access, succession |
| **ContinuityPackage** | Temporary, purpose-bound relevant context assembly | references eligible records; not durable by default |
| **FlourishingReflection** | User-centered balance observation | domains, evidence, uncertainty, questions |
| **IntegrityFinding** | Result of validation or contradiction checks | applies to any governed record |
| **ConsentDirective** | User authorization, restriction, or revocation | controls purposes, scopes, retention, access |

## Relationship Semantics

Important relationships include `records`, `derived-from`, `supports`, `contradicts`, `supersedes`, `annotates`, `relates-to`, `contributes-to`, `reviewed-by`, `approved-by`, `revoked-for-use`, `archived-as`, and `restored-under`.

Relationships retain direction, evidence, authority, time, and scope.

## Immutability and Revocation

Historical facts and original records are append-only under existing Memory Integrity. User correction creates supersession. Revocation changes eligibility for future use and access; it does not silently alter the historical record. Where deletion is legally required, the deletion event and minimal non-content audit proof must be governed separately.

## Boundaries

Logical record ≠ table, relationship ≠ database foreign key, package ≠ prompt, confidence ≠ probability, and lifecycle ≠ Runtime state machine.

