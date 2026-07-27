# 52 — Knowledge Processing Stages

## Definition

Knowledge Processing Stages are ordered logical responsibility boundaries that prepare architecture evidence for a governed output. They define what must be established and preserved, not how software runs.

Each stage is independently auditable. A later stage must not repair, conceal, or reinterpret an unresolved failure from an earlier stage.

## Stage Contract

| Stage | Purpose | Input | Output | Responsibilities | Failure Conditions | Allowed Operations | Forbidden Operations |
|---|---|---|---|---|---|---|---|
| **Scope Resolution** | Establish the exact architectural boundary of the request | Request and declared constraints | Resolved scope or unresolved-scope finding | Identify enterprise, domain, document set, lifecycle, version, time, and question boundary | Ambiguous, incompatible, or unavailable scope | Constrain, classify, request clarification | Assume scope; expand it silently |
| **Authority Resolution** | Determine the authority applicable to every source | Resolved scope and candidate sources | Authority-qualified source set | Apply canonical ordering; identify approvals, decisions, derived assertions, observations, and interpretations | Missing authority, competing authorities, invalid lifecycle | Classify, compare, expose uncertainty | Promote popularity, confidence, or recency into authority |
| **Evidence Resolution** | Select evidence that directly bears on the question | Authority-qualified sources | Relevant evidence set with provenance | Link claims to source statements; preserve identity, version, lifecycle, and scope | Unsupported claim, missing provenance, inaccessible required evidence | Include, exclude with reason, mark missing | Fabricate evidence; use an untraceable summary as canonical |
| **Evidence Normalization** | Make eligible evidence comparable without changing meaning | Resolved evidence | Normalized evidence view plus original references | Align terminology, reference form, and metadata presentation; retain originals | Meaning loss, unresolved alias, incompatible scope or version | Normalize representation, annotate differences | Rewrite normative meaning; collapse disagreement |
| **Context Assembly** | Organize evidence into isolated context classes | Normalized evidence and declared supporting context | Governed context package | Separate Canonical, Derived, Runtime, Historical, Conversation, and Authority Context | Context leakage, missing provenance, mixed authority, stale context without label | Group, order, link, annotate | Merge classes into an undifferentiated memory; build a prompt |
| **Consistency Check** | Test internal compatibility against canonical contracts | Governed context package | Consistency findings | Check identity, terminology, scope, version, lifecycle, relationships, and invariants | Contradiction, unresolved reference, invalid relationship, insufficient basis | Compare, validate, record findings | Correct sources; suppress exceptions |
| **Conflict Detection** | Identify materially incompatible claims or conditions | Context and consistency findings | Typed conflict records | Classify conflict, identify evidence and affected scope, assign severity, identify escalation | Conflict cannot be classified; evidence or authority is insufficient | Detect, classify, preserve alternatives | Resolve normatively; silently choose a side |
| **Confidence Assessment** | Assess support quality for each proposed finding | Evidence, contexts, consistency and conflict records | Confidence assessment with rationale | Evaluate completeness, authority, consistency, agreement, coverage, and freshness | Missing dimensions, unresolved material conflict, misleading aggregation | Assess, qualify, mark indeterminate | Declare truth, correctness, authority, approval, or certainty |
| **Output Preparation** | Create a traceable and bounded intelligence result | Findings, conflicts, confidence, provenance | Structured output candidate | Preserve question, scope, evidence, assumptions, findings, uncertainty, and escalation | Omitted evidence, hidden conflict, unsupported conclusion, lost provenance | Structure, summarize, cross-reference | Add new facts; convert recommendations into decisions |
| **Governance Validation** | Verify conformance before release | Structured output candidate and governing rules | Validated output or governance failure | Validate canonical protection, authority separation, boundary compliance, explainability, and required escalation | Rule violation, unauthorized conclusion, missing audit basis | Validate, reject, return findings | Waive a normative rule; approve architecture |
| **Director Escalation** | Route matters requiring normative authority | Validated output and escalation record | Director review package | State decision required, alternatives, evidence, conflict, uncertainty, and impact | Escalation lacks scope, evidence, alternatives, or decision question | Package, notify conceptually, await decision | Make the decision; execute or mutate architecture |

## Ordering Principles

1. Scope must be resolved before authority and relevance can be judged.
2. Authority must be known before evidence can be combined.
3. Evidence must remain source-linked through normalization and assembly.
4. Context must be assembled before consistency and conflict are assessed.
5. Conflict must be visible before confidence is synthesized.
6. Governance validation must precede any Director-facing release.
7. Director Escalation is a governance boundary, not a processing shortcut.

## Failure Semantics

A failure is a structured finding, not permission to guess. Processing may continue only when the unresolved condition is explicitly represented and cannot distort the outcome. A material scope, authority, provenance, or governance failure prevents a conclusive output and requires clarification, refusal, or Director escalation.

## Enterprise Example

A cross-domain architecture question cites an approved policy, a deprecated document, a Knowledge Graph assertion, and a recent operational observation. The stages first establish the applicable versions and authority. The deprecated document remains historical context, the Graph assertion remains derived, and the observation remains Runtime context. Any disagreement is reported before confidence is assessed.

## Boundaries

These stages do not prescribe agents, tasks, queues, transitions, orchestration engines, APIs, storage, prompts, or execution order at Runtime. Logical ordering expresses dependency of meaning, not a workflow implementation.

