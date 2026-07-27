# 59 — Architecture Reasoning Strategies

## Definition

A **Reasoning Strategy** is a governed analytical approach applied to qualified architectural evidence for an explicit objective. Strategy selection must be justified by the question, evidence, and authority boundary. No strategy creates canonical truth or replaces Director authority.

## Normative Strategies

| Strategy | Purpose | When Allowed | When Forbidden | Expected Output | Failure Conditions |
|---|---|---|---|---|---|
| **Deductive** | Derive a necessary implication from applicable premises and rules | Premises are explicit, authoritative for scope, and logically applicable | A required premise is missing, conflicted, out of scope, or merely hypothesized | Traceable implication with premises, rule, scope, and limits | Invalid premise, invalid rule application, contradiction, or incomplete chain |
| **Inductive** | Identify a bounded pattern supported by multiple observations | Observations are relevant, sufficiently covered, independently sourced where claimed, and labeled non-canonical | A pattern would be presented as a universal rule, approval, or canonical truth | Qualified pattern, coverage statement, exceptions, and uncertainty | Biased or insufficient sample, dependent evidence, counterevidence, or scope overreach |
| **Abductive** | Identify plausible explanations for observed architectural evidence | The result is explicitly a hypothesis and alternatives are preserved | An explanation would be asserted as fact or used to bypass missing evidence | Ranked or unordered hypotheses with supporting and contradicting evidence | No plausible explanation, indistinguishable alternatives, missing provenance, or hidden assumption |
| **Constraint-based** | Test a proposition against explicit architecture rules, invariants, and boundaries | Constraints are applicable, current, scoped, and authoritative | Constraints are inferred, deprecated for the scope, or normatively conflicted | Pass, violation, indeterminate, or Director-review finding with cited constraints | Unknown applicability, conflicting constraints, unresolved scope, or insufficient evidence |
| **Consistency-based** | Evaluate compatibility among claims, identities, relationships, versions, and lifecycles | Compared items have resolved scope and semantics | Difference is only historical or cross-scope and is misrepresented as conflict | Consistency findings and typed conflicts | Ambiguous identity, unresolved version, missing relationship semantics, or insufficient comparison basis |
| **Evidence-driven** | Build a conclusion only from traceable, qualified evidence | Every material claim has a provenance path and authority classification | Retrieval relevance, plausibility, or repetition is substituted for evidence | Evidence synthesis with conclusion boundaries and gaps | Missing evidence, broken provenance, authority mismatch, or unsupported leap |
| **Authority-first** | Resolve which sources govern before evaluating competing claims | The question depends on normative meaning, precedence, approval, or decision rights | Authority is inferred from confidence, recency, popularity, or Runtime behavior | Authority-qualified interpretation or explicit authority conflict | Unknown authority, competing governing sources, or invalid lifecycle |
| **Hypothesis Generation** | Produce testable candidate explanations or architectural possibilities | Evidence is incomplete and the output remains non-canonical and clearly hypothetical | A hypothesis would be auto-approved, written back, or treated as a decision | Bounded hypotheses, evidence needs, disconfirming conditions, and escalation | Fabricated premises, unbounded possibilities, no testability, or hidden canonical claim |
| **Impact Analysis** | Identify possible consequences of a proposed or observed architectural change | Dependencies, scope, affected identities, and assumptions are traceable | The analysis is used as change approval or execution authorization | Direct and transitive impacts, uncertainty, affected boundaries, and evidence | Incomplete dependency coverage, unresolved scope, circular ambiguity, or unsupported impact |
| **Dependency Analysis** | Explain reliance, direction, critical paths, and affected architecture relationships | Relationship semantics, endpoints, scope, and versions are known | Runtime sequence or workflow is inferred from architectural dependency alone | Dependency findings with direction, reach, limitations, and conflicts | Invalid relationship, unknown endpoint, missing direction, scope leak, or cycle requiring interpretation |

## Strategy Composition

Strategies may be combined only when each strategy's purpose, premises, and contribution remain visible in the Reasoning Trace. Authority-first reasoning commonly constrains all other strategies. Constraint-based reasoning may validate a deductive result. Abductive reasoning may propose hypotheses that later evidence-driven reasoning evaluates.

Composition must not blur a hypothesis into a deduction, an observation pattern into a rule, or an impact estimate into an approval.

## Strategy Selection Principles

1. Use the narrowest strategy sufficient for the objective.
2. Resolve authority before normative interpretation.
3. Prefer direct evidence over speculative explanation.
4. Preserve alternative hypotheses when evidence does not discriminate.
5. Report failed strategy conditions rather than switching silently.
6. Validate each material result independently.
7. Escalate whenever strategy output requires normative resolution.

## Enterprise Example

To assess a possible capability-boundary violation, authority-first reasoning identifies the governing approved rule, constraint-based reasoning tests the proposed relationship, dependency analysis identifies affected capabilities, and impact analysis explains possible consequences. If evidence cannot distinguish two causes, abductive reasoning records both as hypotheses. The Director retains the decision.

## Boundaries

Strategies do not define model behavior, prompts, algorithms, autonomous planning, technical routing, agent collaboration, or execution. They are normative analytical contracts over canonical architecture and qualified evidence.

