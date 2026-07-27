# 65 — Query Intent Resolution

## Definition

**Intent Resolution** determines the architectural purpose of a Query while preserving its original meaning, scope uncertainty, constraints, and authority boundary. It decides what kind of analysis may be requested; it does not perform that analysis or grant the requested outcome.

## Intent Types

| Intent | Purpose | Allowed Operations | Forbidden Operations | Routing Target |
|---|---|---|---|---|
| **Information** | Retrieve and present directly supported architecture facts | Resolve scope and authority; select direct evidence; identify exact source statements | Infer unstated implications; treat search results as understanding; decide or approve | Evidence-backed response construction; reasoning only if synthesis becomes necessary |
| **Architecture Explanation** | Explain canonical meaning, relationships, boundaries, lifecycle, or rationale | Assemble authoritative context; request evidence-driven or deductive explanation | Rewrite canonical meaning; invent rationale; simplify away conflicts | Reasoning Engine with explanation objective |
| **Impact Analysis** | Identify possible direct and transitive architectural effects | Select relationships and constraints; request bounded impact reasoning | Approve a change; infer Runtime sequence; authorize action | Reasoning Engine using Impact Analysis |
| **Dependency Analysis** | Explain architectural reliance, direction, reach, and limitations | Select governed relationship evidence; request dependency reasoning | Convert dependency into workflow or execution order | Reasoning Engine using Dependency Analysis |
| **Validation Request** | Assess conformance of a claim or proposal against applicable architecture | Resolve governing rules and evidence; request validation controls | Approve, correct, mutate, or canonize the subject | Reasoning Engine followed by Reasoning Validation |
| **Conflict Review** | Examine an identified or suspected incompatibility | Preserve all positions; resolve versions and authority; classify conflict | Silently choose a winner or perform normative resolution | Conflict Detection and Reasoning Engine; Director escalation when material |
| **Governance Review** | Determine applicable authority, policy, boundary, escalation, or approval requirement | Assemble Authority Context; identify reserved decisions and conformance requirements | Exercise authority, waive rules, grant approval, or change policy | Governance-aware analysis and Director escalation |
| **Director Decision Support** | Prepare evidence, alternatives, impacts, uncertainty, and recommendations for a reserved Director decision | Construct bounded reasoning objectives; preserve conflicts and confidence limits | Make, simulate, predict, or execute the Director decision | Reasoning Engine and governed Director review package |
| **Out of Scope** | Identify a request outside Architecture Intelligence or without resolvable architectural scope | Explain boundary; identify missing scope or proper governance destination when known | Guess, expand scope silently, perform operational action, or fabricate an answer | Refusal, clarification, or explicit external-governance referral |

## Resolution Model

Intent Resolution evaluates:

- the preserved wording and requested outcome;
- Query Context and declared constraints;
- whether the question seeks information, explanation, analysis, validation, governance, or decision support;
- whether multiple intents are materially separable;
- whether the request contains command-like language;
- whether the requested outcome lies within Architecture Intelligence;
- whether Director-reserved authority is required.

The result is Resolved, Multi-intent, Ambiguous, or Out of Scope. Ambiguous material intent requires clarification or a qualified response; it must not be silently guessed.

## Intent Preservation

Resolution may normalize terminology for comparison but must retain the original question and record the rationale for classification. It must not:

- add an unstated objective;
- remove a governance-sensitive part of the request;
- convert a recommendation request into approval;
- convert a question into a command;
- treat urgency as authority;
- infer canonical meaning from conversational wording.

## Multi-intent Queries

A Query may legitimately request explanation and impact analysis, or conflict review and Director decision support. Each intent must retain:

- its own purpose;
- allowed and forbidden operations;
- required evidence;
- routing target;
- validation and response obligations.

Shared scope and evidence may be referenced, but one intent must not weaken another's governance requirements.

## Enterprise Example

“Explain why this dependency exists and approve its replacement” contains Architecture Explanation and an approval request. Intent Resolution routes the explanation for reasoning and marks the approval portion as Governance Review and Director Decision Support. It never treats the combined sentence as authority to approve or execute replacement.

## Boundaries

Intent Resolution classifies and constrains. It does not reason, search autonomously, construct prompts, hold conversations, mutate architecture, make decisions, or execute commands.

