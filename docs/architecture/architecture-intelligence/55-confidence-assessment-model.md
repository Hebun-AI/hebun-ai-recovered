# 55 — Confidence Assessment Model

## Definition

**Confidence Assessment** is a governed explanation of how strongly a proposed architecture-intelligence finding is supported by the available evidence within a resolved scope. It qualifies the support basis; it does not certify reality, confer authority, approve architecture, or replace Director judgment.

Confidence is assessed per material finding. A single global label must not hide weak support for one part of an output.

## Assessment Sources

| Dimension | Architectural Question | Limiting Conditions |
|---|---|---|
| **Evidence Completeness** | Are all material claims supported and are required sources available? | Missing mandatory evidence, broken provenance, or unresolved references limit confidence |
| **Authority Level** | What authority does the supporting evidence hold in this scope? | Derived, observational, conversational, or unknown sources cannot substitute for canonical authority |
| **Consistency** | Is the supporting basis internally compatible with applicable rules, versions, and lifecycle? | Material unresolved conflict prevents unqualified confidence |
| **Agreement** | Do independent eligible sources support compatible findings? | Repetition of one source is not independent agreement; popularity adds no authority |
| **Coverage** | Does the evidence address the full resolved scope and every material part of the finding? | Partial domain, time, version, or relationship coverage must remain explicit |
| **Freshness** | Is the evidence current for the question's declared time and lifecycle? | Recency is relevant only when time matters; newer does not automatically mean more authoritative |

## How Confidence Is Assessed

Confidence is produced through a qualitative, evidence-preserving synthesis:

1. evaluate every dimension independently against the resolved scope;
2. record the evidence and rationale for each evaluation;
3. identify missing, contradictory, stale, partial, or low-authority support;
4. determine whether any material limiting condition prevents a conclusive assessment;
5. synthesize an overall qualification without averaging away a weak material dimension;
6. retain conflicts and uncertainty alongside the qualification;
7. route authority-sensitive or materially indeterminate findings to the Director.

No universal numerical formula is defined. A future implementation may represent qualifications only after a separate architecture decision, but it must preserve the dimensions, rationales, limiting conditions, and governance boundaries defined here.

## Limiting Rules

- A material canonical or authority conflict prevents an unqualified high-confidence conclusion.
- Unknown provenance makes the affected claim unsupported, regardless of apparent plausibility.
- Strong agreement among low-authority sources cannot outrank one applicable canonical source.
- Complete evidence for only part of the scope cannot support confidence for the whole scope.
- Fresh Runtime evidence may support an observation but cannot create confidence in a new canonical rule.
- An indeterminate dimension must remain visible; it must not be replaced with a neutral value.
- Confidence may decrease when new conflict or missing coverage is discovered.
- Confidence alone never triggers execution or canonical change.

## Critical Distinctions

- **Confidence ≠ Truth** — strong support can still be incomplete or wrong.
- **Confidence ≠ Correctness** — correctness requires validation against governing meaning and may remain unresolved.
- **Confidence ≠ Authority** — authority comes from governance, not assessment strength.
- **Confidence ≠ Approval** — approval is an explicit act by the proper authority.
- **Confidence ≠ Director Decision** — it informs the Director and never substitutes for judgment.
- **Confidence ≠ Evidence Quantity** — many dependent or weak sources do not outweigh authoritative evidence.

## Enterprise Example

A finding that an approved rule is represented consistently across canonical documents and the Knowledge Graph may have complete coverage, clear authority, strong consistency, and traceable agreement. A conflicting Runtime observation lowers confidence only in the claim of operational conformity, not in the canonical rule's authority. The output separates these findings and escalates the possible drift; it does not declare the architecture invalid.

## Boundaries

This model defines no scoring algorithm, threshold, statistical calibration, model probability, automated approval rule, ranking engine, or execution trigger. Confidence remains explainable, qualitative at this architecture stage, and subordinate to evidence and authority.

