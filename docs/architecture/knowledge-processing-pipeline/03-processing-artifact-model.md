# 03 — Processing Artifact Model

## Definition

A **Processing Artifact** is a technology-independent, non-canonical representation created or qualified within a Processing Case to preserve one stage's governed output for the next stage.

Artifacts organize knowledge. They do not replace canonical sources, become reasoning conclusions, or acquire authority through processing.

## Canonical Artifact Set

| Artifact | Purpose | Required Content | Prohibited Interpretation |
|---|---|---|---|
| **Candidate Evidence Set** | Preserve potentially relevant source and derived material before eligibility decisions | identity, source, provenance, proposed relevance, scope, lifecycle, version | Eligible evidence or canonical truth |
| **Qualified Evidence Set** | Hold evidence that passed relevance, source, scope, lifecycle, version, and authority qualification | inclusion rationale, exclusions, authority class, findings | Conclusion or complete coverage |
| **Normalized Evidence View** | Present comparable forms without altering source meaning | normalized form, original reference, variance, equivalence status, rationale | Rewritten source or interpretation |
| **Context Package** | Organize qualified evidence into canonical Context classes | Canonical, Derived, Runtime, Historical, Conversation, Authority Context and isolation metadata | Memory, prompt, or authority-neutral collection |
| **Consistency Finding Set** | Preserve identity, terminology, relationship, lifecycle, version, and scope findings | finding type, evidence, affected artifacts, severity, uncertainty | Correction or conflict resolution |
| **Conflict Set** | Preserve typed incompatible claims or conditions | all positions, evidence, authority, scope, severity, escalation | Normative resolution |
| **Confidence Assessment** | Qualify support for each material processing assertion | dimensions, evidence, limitations, conflicts, rationale | Truth, correctness, authority, or approval |
| **Processing Output Package** | Provide the complete governed basis for later reasoning | Request, Scope, artifacts, lineage, findings, conflicts, confidence, validation, limitations | Reasoning Result, Query answer, decision, or action |

## Common Artifact Contract

Every artifact must retain:

- stable identity and artifact type;
- Processing Case and Request identity;
- producing stage;
- source artifacts and canonical-source references;
- scope, lifecycle, and applicable version;
- authority classification;
- provenance and evidence;
- creation rationale;
- validation and integrity status;
- conflicts, uncertainty, and limitations;
- owner and responsible stage;
- supersession or invalidation references.

## Lineage

Artifact lineage is directed from source evidence toward the Processing Output Package. Each transformation must identify its inputs, meaning-preserving operation, rationale, output, and validation result.

Lineage cannot point to an unknown source or skip an unrecorded material transformation.

## Artifact Lifecycle

```text
Proposed
→ Formed
→ Validated
→ Eligible, Limited, Conflicted, or Invalid
→ Superseded or Retained with Processing Case
```

This lifecycle expresses semantic status, not Runtime state.

## Artifact Ownership

Ownership identifies accountability for artifact integrity and interpretation. It does not transfer ownership of canonical sources or grant decision authority.

## Required Distinctions

- Artifact ≠ Canonical Source
- Artifact ≠ Memory
- Artifact ≠ Runtime State
- Lineage ≠ Workflow
- Confidence Assessment ≠ Truth
- Processing Output Package ≠ Reasoning Result

## Boundaries

No schema, serialization, storage, graph technology, database, cache, API, or Runtime representation is defined.

