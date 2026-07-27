# 06 — Processing Integrity and Validation

## Definition

Processing Integrity is the set of invariants that makes a Processing Case trustworthy. Processing Validation assesses those invariants and produces findings; it does not correct artifacts, authorize reasoning, or approve a conclusion.

### Canonical Source Preservation

Canonical Source Preservation requires every processing transformation to retain source identity, authority, lifecycle, version, scope, and material wording. A derived artifact never replaces, edits, or silently upgrades its canonical source.

## Validation Categories

| Category | Validation Question | Failure Meaning |
|---|---|---|
| **Request Integrity** | Is the Request traceable, bounded, non-conclusive, and within Phase 13? | Processing basis is ambiguous or exceeds scope |
| **Scope Integrity** | Are enterprise, domain, identity, lifecycle, version, time, and exclusions explicit? | Evidence eligibility and output applicability are unsafe |
| **Authority Integrity** | Is every authority classification applicable and preserved? | Processing may misrepresent normative force |
| **Evidence Integrity** | Are source, provenance, relevance, lifecycle, version, and supporting statements complete? | Artifact rests on unsupported or unusable evidence |
| **Artifact Integrity** | Does each artifact satisfy its common and type-specific contract? | Artifact cannot be trusted as a handoff basis |
| **Lineage Integrity** | Can every output assertion be traced through recorded transformations to eligible evidence? | Output is not reproducible or auditable |
| **Normalization Integrity** | Are original meaning and material variance preserved? | Processing has altered evidence |
| **Context Integrity** | Are Context classes explicit and isolated? | Authority or evidence classes may leak |
| **Handoff Integrity** | Did entry, exit, validation, limitation, and responsibility conditions hold? | A stage accepted an invalid or ambiguous artifact |
| **Conflict Integrity** | Are all material positions, evidence, severity, and escalation preserved? | Processing hides normative uncertainty |
| **Confidence Integrity** | Does assessment reflect completeness, authority, consistency, agreement, coverage, and freshness? | Support is overstated or misleading |
| **Output Integrity** | Is the Processing Output Package complete for acceptance criteria and explicit about limitations? | Downstream reasoning basis is unsafe |

## Validation Outcomes

- **Valid** — every applicable integrity category passes.
- **Valid with Limitations** — permitted limitations are explicit and acceptance criteria allow bounded use.
- **Partially Valid** — separable valid artifacts exist, but the complete requested output is unavailable.
- **Conflicted** — material claims or authorities remain incompatible.
- **Insufficient Evidence** — required evidence or lineage is missing.
- **Invalid** — one or more non-negotiable integrity rules fail.
- **Director Review Required** — normative resolution or scope/authority decision is reserved.

## Non-negotiable Failures

The following prevent a valid output:

- fabricated source, evidence, identity, or authority;
- broken required provenance;
- cross-scope or cross-tenant leakage;
- canonical source mutation;
- hidden material conflict;
- loss of original evidence;
- unrecorded material transformation;
- reasoning conclusion embedded as processing output;
- downstream repair of an upstream failure.

## Validation Record

Every record preserves category, affected artifact, expected condition, observed finding, evidence, severity, limitation, responsible stage, and required escalation.

## Required Distinctions

- Validation ≠ Correction
- Validation ≠ Authorization
- Integrity Finding ≠ Artifact Mutation
- Valid Output ≠ Correct Reasoning
- Valid with Limitations ≠ Complete
- Director Review Required ≠ Director Decision

## Boundaries

No test implementation, validation engine, scoring formula, repair process, Runtime gate, or enforcement technology is defined.
