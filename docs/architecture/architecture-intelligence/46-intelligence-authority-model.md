# 46 — Architecture Intelligence Authority Model

## Definition

The **Intelligence Authority Model** governs how Architecture Intelligence evaluates sources and claims without confusing authority, evidence, confidence, or truth.

Authority is the recognized, scoped basis for normative force. Intelligence observes authority metadata and evidence; it neither creates nor transfers authority.

## Authority Ordering

The following ordering governs normative use. A lower layer may inform analysis but cannot override a higher applicable layer:

| Level | Knowledge class | Permitted use | Normative authority |
|---:|---|---|---|
| 1 | **Director-approved canonical architecture** | Governs applicable architectural meaning and boundaries | Highest within declared scope |
| 2 | **Approved architecture decisions** | Governs the explicit choice, scope, version, and lifecycle recorded | Authoritative within decision scope |
| 3 | **Normative architecture rules** | Constrains conclusions and conformance when source authority is valid | Inherited from applicable canonical source |
| 4 | **Derived representations** | Supports structured analysis with source provenance | None independently |
| 5 | **Knowledge Graph assertions** | Supports connected navigation and analysis when traced to Representation and source | None independently |
| 6 | **Runtime observations** | Supplies operational evidence or divergence signals | No architectural authority |
| 7 | **Model-generated interpretations** | Supplies explicitly labelled analysis | No canonical authority |
| 8 | **Hypotheses and recommendations** | Supplies bounded options for review | No canonical authority |

Ordering does not mean every higher item automatically applies. Scope, lifecycle, version, supersession, exception, evidence, and recognized authority must be resolved for each claim.

## Authority Resolution

Authority resolution must determine:

- source identity and source class;
- approval evidence;
- applicable Scope;
- Lifecycle and Version;
- supersession, exception, or conflict;
- statement type and normative force;
- provenance completeness;
- whether Director review is required.

Failure to resolve any required element prevents the claim from governing the answer.

## Confidence and Truth

- Authority ≠ Confidence
- Confidence ≠ Truth
- Evidence ≠ Authority
- Runtime Observation ≠ Architecture Decision
- Recommendation ≠ Approved Rule

Confidence describes assessed support for a conclusion. It cannot upgrade source authority, make inference canonical, or resolve conflict.

Evidence supports verification but gains normative force only through an applicable authoritative source and statement.

## Conflict Precedence

Architecture Intelligence must not resolve a conflict merely by:

- choosing the most recent timestamp;
- selecting the highest-confidence interpretation;
- counting supporting sources;
- preferring a Graph assertion;
- privileging Runtime behavior;
- assuming organizational rank;
- combining incompatible statements.

Explicit governance evidence is required. Otherwise the outcome is `Conflicted` or `Director Decision Required`.

## Model Output Boundary

No model-generated output can become canonical authority automatically. Repetition, approval likelihood, adoption, confidence, apparent correctness, or operational use does not change this rule.

A model output may become input to a governed architecture proposal. Only the established Director-controlled architecture process can approve and canonize that proposal.

## Director Authority

The Director retains exclusive final authority over:

- canonical architecture approval and modification;
- normative conflict resolution;
- exceptions and supersession;
- Scope expansion;
- acceptance of architecture recommendations;
- authorization of committing action.

Architecture Intelligence may request, inform, and explain a Director decision. It cannot simulate or pre-empt that decision.

## Enterprise Example

A Knowledge Graph assertion and current Runtime behavior suggest that a Department authorizes a Capability realization, while the applicable canonical rule grants authorization only to the Director. The canonical rule governs. The Graph assertion is checked for provenance, the Runtime observation is recorded as possible drift, and the conclusion reports a conflict or violation. Confidence in observed practice does not create authority.

## Failure Behavior

When authority is missing, ambiguous, stale, conflicting, or outside scope, the system must:

1. preserve the evidence;
2. state the unresolved authority condition;
3. avoid a normative conclusion;
4. return `Insufficient Evidence`, `Conflicted`, or `Director Decision Required`;
5. perform no mutation or execution.

## Related Architecture

- [Phase 11 Source of Truth](../architecture-ingestion/04-source-of-truth.md)
- [Phase 11 Cross-Architecture Alignment](../architecture-ingestion/40-cross-architecture-alignment.md)
- [Phase 7 Director Intelligence Closure](../director-review/10-phase-7-final-closure.md)
- [45 — Intelligence Principles](45-intelligence-principles.md)

