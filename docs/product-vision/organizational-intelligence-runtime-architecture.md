# Organizational Intelligence Runtime — Architecture

## 1. Document Status

**DOCUMENT TYPE: PRODUCT VISION — RUNTIME ARCHITECTURE**

**STATUS: RECORDED — CONCEPTS ONLY**

This is an Architecture Vision document. It is not Roadmap and not Implementation. It contains no code, no class, no interface, no API, no database, no schema, no migration, no UI, and no execution behavior. It describes, conceptually, *how* the Organizational Intelligence Runtime is organized — its purpose, boundaries, components, determinism split, state philosophy, failure model, security posture, and integration surface.

It is subordinate to the [Program VIII — Organizational Intelligence Constitution](../architecture/programs/program-08-organizational-intelligence/constitution.md), the published Phase 44–47 architectures, and the published Enterprise Memory, Enterprise Reasoning, and Organizational Intelligence Foundation layers. It defines constitutional-consumer architecture only; it authorizes no Runtime behavior. Director authority remains final.

The scope of this document is Hebun AI only. It builds on the companion [Vision](organizational-intelligence-runtime-vision.md), which answered *why* the Runtime exists.

---

## 2. Runtime Purpose

The Organizational Intelligence Runtime is the layer that executes the published Organizational Intelligence Foundation in real, repeatable processes. It sits above settled Memory and settled Reasoning and below human decision. Its purpose is to:

- consume assembled Memory context and assembled Reasoning understanding, read-only;
- assemble a bounded, attributable picture of the organization;
- produce Learning candidates, Optimization candidates, Awareness signals and assessments, and Evolution readiness and pathways;
- carry every output forward with provenance, explainability, and confidence;
- prepare advisory briefings for the Director and explanations for Heby.

It owns no storage of record, no action, no decision, and no autonomy. It is a directional pass: settled inputs in, grounded advisory candidates out.

---

## 3. Explicit Non-Responsibilities

The Runtime never, under any input, configuration, confidence level, or urgency:

- decides on its own behalf;
- grants, infers, or substitutes for approval;
- initiates, schedules, or performs action or execution;
- spends budget or commits a resource;
- restructures the organization, assigns people, or transfers responsibility;
- creates, reprioritizes, or executes Work;
- amends the roadmap or opens Programs or phases;
- enforces, waives, or bypasses Governance or Security;
- touches production systems or operational state;
- runs hidden automation or self-authorizes.

The Director Approval boundary is never crossed and never bypassed. This restates, at the Runtime layer, constitutional rules PVIII-004 through PVIII-007 and PVIII-020.

---

## 4. Canonical Runtime Flow

The Runtime realizes one directional flow. It mirrors the Foundation's phase chain (44 → 45 → 46 → 47), each stage consuming settled inputs and the qualified outputs of the stage before it, read-only:

```text
Enterprise Memory
        ↓
Memory Query / Selection / Context
        ↓
Reasoning Understanding
        ↓
Organization Assembly
        ↓
Organizational Intelligence Runtime
        ↓
Learning Candidates
        ↓
Optimization Candidates
        ↓
Awareness Signals and Assessments
        ↓
Evolution Readiness and Pathways
        ↓
Director Briefing / Heby Explanation
        ↓
Director Decision
        ↓
Future Planning / Execution   (separately governed — outside this Runtime)
```

There is no direct execution path anywhere in this flow. Every stage below "Organization Assembly" produces attributable, non-authoritative material. The only edge that turns intelligence into action is "Director Decision," and it is a human act outside the Runtime.

---

## 5. Runtime Boundaries

The Runtime is defined by a sequence of boundaries. Each is described by what it *does* and what it *must not do*.

- **Input Boundary.** *Does:* accept assembled Memory context and Reasoning understanding as settled, versioned, read-only inputs; verify eligibility and provenance before admission. *Does not:* mutate, re-derive, or reach back into memory or reasoning; fabricate inputs; admit anything missing identity, scope, or provenance.

- **Context Boundary.** *Does:* bind the declared organizational context — purpose, scope, organization, tenant, authority basis — and attach applicable Governance, Security, privacy, and classification constraints. *Does not:* widen scope, infer authority, or treat access as permission.

- **Analysis Boundary.** *Does:* run the Foundation's effectiveness analysis, signal detection, and assessment logic over eligible evidence. *Does not:* conclude as truth, decide, or act; treat analysis capability as authority.

- **Candidate Generation Boundary.** *Does:* form Learning, Optimization, Awareness, and Evolution candidates as attributable, uncertainty-preserving proposals. *Does not:* emit any candidate as a finding-of-record, a command, or an approval.

- **Validation Boundary.** *Does:* check every candidate for context completeness, evidence eligibility, provenance, scope adherence, explanation, and boundary compliance. *Does not:* certify truth, admit memory, approve governance, or admit anything to execution.

- **Explanation Boundary.** *Does:* preserve sufficient basis, assumptions, limitations, and uncertainty for constitutional explanation. *Does not:* expose protected information or prescribe implementation.

- **Confidence Boundary.** *Does:* attach and carry declared confidence and uncertainty. *Does not:* let confidence become permission, ranking-as-command, or a threshold that auto-advances anything.

- **Governance Boundary.** *Does:* consume applicable Governance and Security constraints and hold them immutable. *Does not:* approve, waive, enforce, or reinterpret them.

- **Director Approval Boundary.** *Does:* stop at the human. Everything the Runtime produces terminates in advisory material awaiting Director consideration. *Does not:* advance past a human decision, imply one, or manufacture one.

- **Output Boundary.** *Does:* emit briefings and explanations that are attributable, scope-bound, and non-authoritative. *Does not:* emit a Decision, Approval, command, roadmap amendment, Runtime command, or execution artifact.

Any unresolved conflict at a boundary — ownership, authority, evidence, or dependency — is surfaced (an Architecture Gate), never resolved silently.

---

## 6. Runtime Components

The following are *conceptual* components — responsibilities, not classes, services, or modules. Names describe roles; they prescribe no implementation.

- **Organizational Context Loader.** Loads and binds the declared context and its constraints; admits settled Memory context and Reasoning understanding through the Input Boundary.
- **Organization Assembly Runtime.** Composes the bounded organization picture (observations, constraints, capabilities, opportunities, risks, objectives) from eligible evidence, using the published Organization Assembly vocabulary.
- **Learning Candidate Runtime.** Realizes the Phase 44 flow: identifies and preserves attributable learning candidates.
- **Optimization Candidate Runtime.** Realizes the Phase 45 flow: effectiveness analysis, opportunity identification, and bounded analytic prioritization — never Work prioritization.
- **Awareness Signal Runtime.** Realizes Phase 46 signal detection: attributable observations of position, change, risk, opportunity, drift, and dependency.
- **Awareness Assessment Runtime.** Realizes Phase 46 assessment: attributable evaluation of state, health, readiness, and alignment, with uncertainty.
- **Evolution Readiness Runtime.** Realizes Phase 47 readiness assessment: readiness, constraints, continuity, and sustainability.
- **Evolution Pathway Runtime.** Realizes Phase 47 pathway description: attributable, non-authoritative guidance — never a Plan, roadmap, or Decision.
- **Provenance Binder.** Binds source, attribution, version, effective period, and lifecycle to every candidate and its basis; keeps this provenance distinct from Memory and Knowledge provenance.
- **Explainability Binder.** Binds basis, assumptions, limitations, contradictions, and uncertainty for constitutional explanation.
- **Confidence Binder.** Binds declared confidence and uncertainty without letting either become authority.
- **Runtime Validator.** Applies the Validation Boundary across all candidate kinds; fail-closed.
- **Governance Gate.** Holds Governance and Security constraints immutable and blocks progression on any rejection.
- **Director Briefing Assembler.** Assembles the advisory briefing — evidence, reasoning, risk, opportunity, confidence, uncertainty, options, history — for Director consideration and Heby explanation.

These roles map onto the Foundation's existing per-domain structure (each Organizational Intelligence domain already carries a boundary, normalization, rules, types, and validation shape); the Runtime orchestrates them and binds meaning around them. It redefines none of them.

---

## 7. Determinism and the AI Boundary

The Runtime keeps a hard line between deterministic responsibilities and model-assisted ones.

**Deterministic runtime responsibilities** (repeatable, auditable, model-independent):

- validation;
- canonical ordering;
- deduplication;
- assembly;
- evidence linking;
- provenance linking;
- policy enforcement;
- lifecycle transitions.

**AI / model-assisted responsibilities** (interpretive, never trusted directly):

- candidate generation;
- pattern interpretation;
- natural-language explanation;
- hypothesis formation.

No AI output is ever accepted directly. Every AI-produced candidate must pass, in order, through validation, evidence grounding, provenance binding, explainability binding, confidence binding, and the governance gate before it can appear in a briefing. A model's confidence is an input to the Confidence Binder, never a substitute for validation, and never a permission. The Runtime's meaning does not depend on which model, if any, assists it — consistent with the constitution's technology and vendor neutrality.

---

## 8. Runtime State Philosophy

- **Stateless orchestration.** The Runtime's flow is envisioned as stateless orchestration over settled inputs. A run is a function of its declared context and its read-only inputs, not of accumulated hidden memory.
- **Where lifecycle state lives.** Persisted lifecycle state — a candidate's progression through identified, preserved, validated, qualified, reviewed, evolved/superseded/retired — belongs to the governed persistence its owning architecture already defines, not to the orchestration layer. This document defines no store, schema, or migration.
- **No hidden state.** No decision-bearing state may exist outside the declared, attributable record. Nothing that affects an output may be invisible to audit.
- **Cache limit.** Caching may only accelerate re-derivation of the same result from the same settled inputs; it may never become a source of truth or outlive the provenance of what it holds.
- **Retry limit.** Retries are bounded and attributable; exhaustion fails closed.
- **Idempotency.** The same declared context over the same settled inputs yields the same qualified outputs.
- **Replayability.** A run can be replayed from its recorded inputs and context.
- **Auditability.** Every material input, transformation, candidate, and output is attributable and traceable.
- **Versioning.** Inputs and outputs carry versions; evolution supersedes without rewriting history.
- **Deterministic reconstruction.** The deterministic portion of any run can be reconstructed exactly from its recorded inputs and context, independent of any model.

---

## 9. Failure Model

Every failure is fail-closed. The Runtime never silently guesses, never fills a gap with fabrication, and never advances a stage on incomplete grounds. Named failures and their closed responses:

- **Missing evidence** — the candidate is not formed; the gap is recorded and surfaced.
- **Invalid understanding** — the input is rejected at the Input Boundary; no assembly proceeds.
- **Contradictory inputs** — the contradiction is preserved and surfaced, never collapsed into a single "truth."
- **Stale context** — the run is halted or deferred; stale inputs are not treated as current.
- **Insufficient confidence** — the candidate is retained as low-confidence and clearly marked, or withheld from the briefing; it is never auto-promoted.
- **Unavailable dependency** — the dependent stage does not run; partial results are not presented as complete.
- **Partial candidate generation** — partial output is marked partial; it is never presented as a full result.
- **Validation failure** — the candidate is blocked; it cannot reach a briefing.
- **Governance rejection** — progression stops; the rejection is recorded.
- **Timeout** — the run fails closed at the point reached; nothing downstream is inferred.
- **Retry exhaustion** — the run terminates closed and is escalated.

In every case the response is restriction, deferral, or escalation — never assumption, never action. This realizes the constitution's comprehensive fail-closed rule at the Runtime layer.

---

## 10. Security and Governance

- **Least privilege.** No analytic capability, access, confidence, or feasibility creates undeclared authority or permission.
- **Tenant isolation.** Tenant boundaries are immutable; no cross-tenant read or leakage.
- **Organization isolation.** An organization's evidence, candidates, and briefings stay within its bounded scope.
- **Evidence access control.** Evidence is consumed read-only, within eligibility, preserving each source's ownership and classification.
- **Sensitive memory handling.** Protected and classified information is never exposed through explanation or briefing; classification constraints ride with every derived artifact.
- **Audit trail.** Every material act is attributable, versioned, and traceable.
- **Immutable decision record.** Once recorded, an advisory output and its basis are not silently rewritten; changes occur by attributable supersession.
- **Approval enforcement.** Governance and Security constraints are held immutable; the Runtime never approves, waives, or enforces them itself, and never treats a finding as approval.
- **Tool and execution isolation.** The Runtime invokes no tools, agents, Computer Use, automation, or execution.
- **No secret exposure.** No secret, credential, or protected token appears in any candidate, explanation, or briefing.
- **No cross-organization leakage.** No output blends or transfers evidence across organizational boundaries.

---

## 11. Heby Integration

Heby is a consumer of the Runtime's Output Boundary. Heby's role is to:

- explain the result in plain terms;
- show the sources behind it;
- show confidence and uncertainty honestly;
- present the available options;
- ask the Director questions when judgment is required;
- name what is missing or unresolved.

Heby does not decide. Per the Heby Architecture Mapping, this Runtime advances Heby's maturity for Organizational Intelligence concepts from *Understand* toward *Reason*; it never grants *Act* outside a separately governed, authorized Runtime boundary. This document defines no Heby UI.

---

## 12. Director Integration

The Director Workspace is the human surface where advisory material is considered. Conceptually it presents:

- **Briefing** — the assembled advisory summary;
- **Evidence** — the grounded, attributable basis;
- **Reasoning** — the understanding the briefing rests on;
- **Risk** — surfaced risks and their uncertainty;
- **Opportunity** — surfaced opportunities and their uncertainty;
- **Approvals** — where the Director's decision is recorded (a human act);
- **History** — prior advisory outputs and their supersession;
- **Audit** — the full attributable trail.

The Director is where intelligence becomes decision. The Runtime prepares; the Director decides. This document designs no UI for that surface.

---

## 13. Validation

This architecture is consistent with published architecture when:

1. it consumes Memory and Reasoning outputs read-only and redefines neither;
2. it preserves the Organizational Intelligence Foundation Phase 1–6 vocabulary and boundaries without redefinition;
3. it preserves Director authority and the Director Approval boundary;
4. it contains no execution path and no agent autonomy;
5. it produces no hidden decision and no silent conflict resolution;
6. it holds no circular responsibility with any upstream layer;
7. it keeps Vision, Architecture, and Roadmap concerns separated across the three companion documents;
8. it names no model, vendor, database, schema, or code as a dependency.

---

## 14. Related Documents

- [Organizational Intelligence Runtime — Vision](organizational-intelligence-runtime-vision.md)
- [Organizational Intelligence Runtime — Roadmap](organizational-intelligence-runtime-roadmap.md)
- [Program VIII — Organizational Intelligence Constitution](../architecture/programs/program-08-organizational-intelligence/constitution.md)
- [Phase 44 — Organizational Learning Architecture](../architecture/programs/program-08-organizational-intelligence/phase-44-organizational-learning-architecture/architecture.md)
- [Phase 45 — Organizational Optimization Intelligence](../architecture/programs/program-08-organizational-intelligence/phase-45-organizational-optimization-intelligence/architecture.md)
- [Phase 46 — Strategic Awareness Architecture](../architecture/programs/program-08-organizational-intelligence/phase-46-strategic-awareness-architecture/architecture.md)
- [Phase 47 — Strategic Enterprise Evolution](../architecture/programs/program-08-organizational-intelligence/phase-47-strategic-enterprise-evolution/architecture.md)
- [Reasoning Foundation — Architecture Vision](reasoning-foundation-architecture.md)
- [Heby Architecture Mapping](../architecture/heby/heby-architecture-mapping.md)

**DOCUMENT STATUS: RECORDED — CONCEPTS ONLY**
