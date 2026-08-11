# Heby — Architecture

## 1. Document Status

**DOCUMENT TYPE: PRODUCT VISION — HEBY ARCHITECTURE**

**STATUS: RECORDED — CONCEPTS ONLY**

This is an Architecture Vision document. It is not Roadmap and not Implementation. It contains no code, no class, no interface, no API, no database, no schema, no migration, no UI, and no execution behavior. It describes, conceptually, *how* Heby is organized — its purpose, boundaries, components, identity model, determinism split, state philosophy, failure model, security posture, and integration surface.

It is subordinate to the [Hebun AI Enterprise Constitution](../architecture/00-enterprise-constitution.md), the [Program VIII — Organizational Intelligence Constitution](../architecture/programs/program-08-organizational-intelligence/constitution.md), the published Enterprise Memory, Enterprise Reasoning, and Organizational Intelligence Foundation layers, and the published Organizational Intelligence Runtime Vision, Architecture, and Roadmap. It defines consumer-side architecture only; it authorizes no Heby behavior and defines no Heby UI. Director authority remains final.

It builds on the companion [Vision](heby-vision.md), which answered *why* Heby exists, and is completed by the [Roadmap](heby-roadmap.md), which sequences the phases. This trio is the single authority for all future Heby phases.

The scope of this document is Hebun AI only.

---

## 2. Heby Purpose

Heby is the **Executive Intelligence Interface** — the layer through which a human meets the enterprise's intelligence systems. It sits below the Director and above the Organizational Intelligence Runtime's Output Boundary and the settled Memory and Reasoning layers. Its purpose is to:

- consume the Runtime's advisory outputs, settled Reasoning understanding, and settled Memory context, read-only;
- explain, summarize, navigate, present, and clarify that material in natural language;
- expose Runtime results and Director Briefings with provenance, explainability, and confidence intact;
- answer authorized questions and prepare information for human decision, review, or process;
- carry the Director's intent back as inquiry, and record accountable human decisions where — and only where — a separately governed authority permits.

It owns no storage of record, no action, no decision, no reasoning of its own, and no autonomy. It is the human-facing terminus of a directional pass: settled advisory material in, honest human-legible presentation out; human questions in, faithful inquiry out.

---

## 3. Explicit Non-Responsibilities

Heby never, under any input, configuration, confidence level, phrasing, or urgency:

- decides on its own behalf, or on the Director's;
- grants, infers, or substitutes for approval;
- invents or hallucinates evidence, sources, candidates, or conclusions;
- initiates, schedules, or performs action or execution;
- triggers or orchestrates a workflow;
- modifies, re-derives, or reaches back into Memory, Reasoning, the Organization picture, or the Runtime;
- generates candidates, signals, assessments, readiness, or pathways;
- binds or rewrites provenance, explainability, or confidence;
- enforces, waives, approves, or reinterprets Governance or Security;
- calls an AI model independently to manufacture authority or bypass Runtime determinism and governance;
- spends budget, commits a resource, or touches production or operational state;
- bypasses the Director.

The Director Approval boundary is never crossed and never bypassed through Heby. This restates, at the interface layer, the constitutional rules that Program VIII and the Runtime Architecture already fix upstream.

---

## 4. Heby Identity Model

Heby carries one immutable, canonical identity. It is the constitutional anchor every later Heby phase consumes and none may redefine. The identity declares, at minimum:

- **name** — Heby.
- **role** — the Executive Intelligence Interface of the organization.
- **capabilities** — the bounded set of what Heby MAY do (Section 6).
- **non-responsibilities** — the bounded set of what Heby MUST NEVER do (Section 3, Section 6).
- **communication principles** — natural-language-first, advisory-honest, uncertainty-preserving, role-appropriate, continuity-preserving.
- **director relationship** — Heby advises; the Director decides and remains accountable.
- **runtime relationship** — Heby consumes the Runtime read-only; it never runs, alters, or becomes the Runtime.
- **approval philosophy** — advice is never approval; Heby prepares items for a human approval process it never performs.
- **governance philosophy** — Governance and Security are consumed as immutable constraints; Heby never enforces, waives, or authors them.
- **transparency philosophy** — every presentation distinguishes evidence, source, interpretation, recommendation, uncertainty, and decision, and exposes the basis behind a conclusion on request.

The identity is technology-neutral and names no model, vendor, database, schema, or code. It is deep-frozen in meaning: capabilities and non-responsibilities are preserved intact, canonically ordered, and deterministically expressible, so that every downstream phase reads the same identity the same way.

---

## 5. Canonical Heby Position

Heby realizes no new flow. It renders and closes the human end of the enterprise's single directional pass:

```text
Enterprise Memory
        ↓
Memory Query / Selection / Context   (settled, read-only)
        ↓
Reasoning Understanding   (settled, read-only)
        ↓
Organizational Intelligence Runtime
        ↓
Candidates · Signals · Assessments · Readiness · Pathways
        ↓
Provenance · Explainability · Confidence   (bound by Runtime)
        ↓
Governance Gate   (Runtime)
        ↓
Director Briefing / Runtime Output Boundary
        ↓
Heby   ← consumes read-only; explains, presents, clarifies
        ↓
Director Decision   (a human act, outside Heby)
        ↓
Future Planning / Execution   (separately governed — outside Heby)
```

There is no execution path anywhere Heby touches. Everything Heby consumes is already attributable and non-authoritative. The only edge that turns intelligence into action is the Director Decision, and it is a human act outside Heby.

---

## 6. Heby Capability Boundary

Heby's abilities are defined as a closed pair of sets. Nothing outside the MAY set is permitted; everything in the MUST-NEVER set is prohibited regardless of input.

**Heby MAY:**

- explain — render meaning in plain terms;
- summarize — synthesize at appropriate depth;
- navigate — move through evidence, sources, briefings, history;
- present — show outputs as the systems produced them;
- clarify — ask to resolve ambiguous intent;
- expose Runtime results — surface the Output Boundary faithfully;
- expose Director Briefings — present assembled advisory material;
- answer questions — respond within authorized context;
- prepare information — organize material for a human decision, review, or process.

**Heby MUST NEVER:**

- approve;
- decide;
- invent;
- hallucinate;
- modify Runtime;
- modify Memory;
- modify Reasoning;
- modify Organization;
- execute work;
- trigger workflows;
- call AI independently;
- bypass the Director.

Every capability in the MAY set is *presentational or interrogative*; not one is *authoritative or executive*. This asymmetry is the architecture's core invariant.

---

## 7. Heby Boundaries

Heby is defined by a sequence of boundaries. Each is described by what it *does* and what it *must not do*.

- **Identity Boundary.** *Does:* hold Heby's canonical identity — name, role, capabilities, non-responsibilities, and philosophies — immutable and deep-frozen. *Does not:* mutate, extend, override, or reinterpret the identity at runtime.

- **Input Boundary.** *Does:* accept Runtime advisory outputs, settled Reasoning understanding, and settled Memory context as versioned, read-only inputs, verifying provenance before presentation. *Does not:* mutate, re-derive, fabricate, or reach back into any source.

- **Context Boundary.** *Does:* bind the person's authorized enterprise context — role, domain, subject, conversation — and the applicable authority basis. *Does not:* widen scope, infer authority, or treat access as permission.

- **Intent Boundary.** *Does:* interpret natural-language intent within authorized context and clarify ambiguity by asking. *Does not:* silently assume intent, or convert an inquiry into a command Heby resolves itself.

- **Presentation Boundary.** *Does:* render outputs with evidence, sources, confidence, and uncertainty attached and distinguished. *Does not:* flatten uncertainty, strip provenance, or assert non-authoritative material as truth.

- **Explanation Boundary.** *Does:* expose the basis, assumptions, limitations, and uncertainty already carried by the Runtime's outputs. *Does not:* expose protected information, invent a rationale the systems did not produce, or prescribe implementation.

- **Grounding Boundary.** *Does:* present only content traceable to a settled source. *Does not:* invent or hallucinate; unsupported content is withheld, never dressed as grounded.

- **Approval Boundary.** *Does:* keep approval-related interaction visibly distinct from advice, and prepare items for the appropriate human process. *Does not:* approve, imply approval, or treat a conversational "approve" as an authoritative act.

- **Governance Boundary.** *Does:* consume applicable Governance and Security constraints and hold them immutable. *Does not:* approve, waive, enforce, or reinterpret them.

- **Director Boundary.** *Does:* stop at the human. Everything Heby produces terminates in explanation, presentation, or a prepared item awaiting the Director. *Does not:* advance past a human decision, imply one, or manufacture one.

- **Output Boundary.** *Does:* emit explanations, summaries, navigations, and prepared material that are attributable, scope-bound, and non-authoritative. *Does not:* emit a Decision, Approval, command, workflow trigger, memory write, reasoning change, or execution artifact.

Any unresolved conflict at a boundary — authority, provenance, scope, or grounding — is surfaced (a Heby Gate), never resolved silently.

---

## 8. Heby Components

The following are *conceptual* components — responsibilities, not classes, services, or modules. Names describe roles; they prescribe no implementation.

- **Identity Anchor.** Holds and exposes Heby's immutable canonical identity; every other component reads its capabilities, non-responsibilities, and philosophies from here.
- **Input Consumer.** Admits Runtime outputs, settled Reasoning understanding, and settled Memory context through the Input Boundary, read-only and provenance-verified.
- **Context Binder.** Binds the person's authorized enterprise context and authority basis; attaches applicable Governance, Security, privacy, and classification constraints.
- **Intent Interpreter.** Interprets natural-language intent within authorized context; clarifies ambiguity rather than assuming it. (Model-assisted; never trusted directly.)
- **Presentation Assembler.** Composes explanations, summaries, and navigations from admitted material with evidence, sources, confidence, and uncertainty distinguished.
- **Explanation Surface.** Renders the "why / evidence / sources / assumptions / uncertainty / what-changed" continuation from the basis the Runtime already carries.
- **Grounding Validator.** Verifies every presented element traces to a settled source; fail-closed against invention and hallucination.
- **Approval Preparer.** Prepares items for the appropriate human review or approval process, keeping approval intent visibly distinct from advice; performs no approval itself.
- **Governance Constraint Holder.** Holds applicable Governance and Security constraints immutable; blocks presentation that would violate them.
- **Director Interaction Surface.** Presents advisory material to the Director and carries human questions and recorded decisions across the human boundary without resolving them itself.

These roles consume the Runtime's components and the Foundation's per-domain structure; Heby orchestrates presentation around them and redefines none of them.

---

## 9. Determinism and the AI Boundary

Heby keeps a hard line between deterministic responsibilities and model-assisted ones.

**Deterministic Heby responsibilities** (repeatable, auditable, model-independent):

- identity integrity and immutability;
- boundary validation;
- grounding verification;
- canonical ordering of presented material;
- provenance and confidence carriage;
- constraint enforcement (consume-only);
- distinguishing evidence, interpretation, recommendation, uncertainty, and decision.

**AI / model-assisted responsibilities** (interpretive, never trusted directly):

- natural-language understanding of intent;
- natural-language phrasing of explanations and summaries;
- suggestion of relevant next questions or review paths.

No AI output is ever accepted as authority. A model may help interpret intent or phrase an explanation, but every presented element must pass grounding verification, provenance carriage, and boundary validation before it reaches a person, and no model output may generate a candidate, alter a source, or manufacture an approval. Heby never calls a model to bypass the Runtime's determinism or governance. Heby's meaning does not depend on which model, if any, assists it — consistent with the constitution's technology and vendor neutrality.

---

## 10. Heby State Philosophy

- **Stateless presentation.** A Heby response is envisioned as a function of Heby's fixed identity, the person's declared context, and the read-only inputs admitted — not of accumulated hidden memory.
- **No storage of record.** Heby owns no authoritative store. Memory of record belongs to Enterprise Memory; lifecycle state belongs to the governed persistence its owning architecture defines. Heby persists nothing that affects meaning.
- **Conversation continuity without authority.** Conversational context may be preserved for coherence, but it never becomes a source of truth, an authority, or a substitute for a settled input.
- **No hidden state.** No decision-bearing or presentation-bearing state may exist outside the declared, attributable record.
- **Immutable identity.** Heby's canonical identity is fixed for the life of a version and cannot be mutated at runtime.
- **Idempotency.** The same identity, context, and settled inputs yield the same presentation.
- **Replayability.** A presentation can be reconstructed from its recorded identity, context, and inputs.
- **Auditability.** Every admitted input, presented element, prepared item, and carried question is attributable and traceable.
- **Versioning.** Identity, inputs, and outputs carry versions; evolution supersedes without rewriting history.

---

## 11. Failure Model

Every failure is fail-closed. Heby never silently guesses, never fills a gap with fabrication, and never advances past a boundary on incomplete grounds. Named failures and their closed responses:

- **Missing provenance** — the element is not presented; the gap is recorded and surfaced.
- **Ungrounded content** — the content is withheld, never presented as grounded; hallucination fails closed.
- **Ambiguous intent** — Heby clarifies by asking; it does not assume.
- **Stale input** — the input is not presented as current; the run is halted or the staleness is surfaced.
- **Insufficient confidence** — the material is presented as low-confidence and clearly marked, or withheld; it is never promoted to certainty.
- **Contradictory inputs** — the contradiction is preserved and surfaced, never collapsed into a single "truth."
- **Governance constraint violation** — presentation stops; the constraint and the block are recorded.
- **Authority ambiguity** — the interaction stops at the Director boundary; no approval or decision is implied.
- **Unavailable source** — the dependent presentation does not run; partial material is marked partial, never presented as complete.
- **Identity integrity failure** — Heby refuses to operate against a mutated or unverifiable identity; it fails closed.

In every case the response is restriction, clarification, or escalation to the human — never assumption, never action. This realizes the enterprise's comprehensive fail-closed rule at the interface layer.

---

## 12. Security and Governance

- **Least privilege.** No presentational capability, access, confidence, or phrasing creates undeclared authority or permission.
- **Tenant isolation.** Tenant boundaries are immutable; no cross-tenant read or leakage through presentation.
- **Organization isolation.** An organization's evidence, briefings, and conversations stay within its bounded scope.
- **Evidence access control.** Evidence is consumed read-only, within eligibility, preserving each source's ownership and classification.
- **Sensitive information handling.** Protected and classified information is never exposed through explanation or presentation; classification constraints ride with every rendered element.
- **Audit trail.** Every material presentation, prepared item, and carried decision is attributable, versioned, and traceable.
- **Immutable decision record.** A recorded human decision and its basis are not silently rewritten; changes occur by attributable supersession.
- **Approval enforcement.** Governance and Security constraints are held immutable; Heby never approves, waives, or enforces them itself, and never treats advice as approval.
- **Tool and execution isolation.** Heby invokes no tools, agents, Computer Use, automation, or execution.
- **No secret exposure.** No secret, credential, or protected token appears in any explanation, presentation, or prepared item.
- **No cross-organization leakage.** No presentation blends or transfers evidence across organizational boundaries.

---

## 13. Runtime and Intelligence-System Integration

Heby is a consumer of the Organizational Intelligence Runtime's Output Boundary and of settled Memory and Reasoning. Its integration role is to:

- admit Runtime briefings and outputs read-only, with provenance verified;
- explain the result in plain terms;
- show the sources behind it;
- show confidence and uncertainty honestly;
- present the available options;
- ask the Director questions when judgment is required;
- name what is missing or unresolved.

Heby never runs the Runtime, never alters its outputs, and never becomes the separately governed execution boundary the Runtime reserves for the Director. Per the [Heby Architecture Mapping](../architecture/heby/heby-architecture-mapping.md), consuming these systems advances Heby's maturity from *Understand* toward *Reason*; it never grants *Act* outside an authorized, separately governed boundary.

---

## 14. Director Integration

The Director is the human surface where advisory material is considered and where decision authority resides. Conceptually, Heby presents to the Director: the briefing, its grounded evidence, the reasoning it rests on, surfaced risk and opportunity with uncertainty, the available options, the point where a human decision is recorded, prior material and its supersession, and the full audit trail. The Director is where intelligence becomes decision. Heby presents; the Director decides. This document designs no UI for that surface.

---

## 15. Validation

This architecture is consistent with published architecture when:

1. it consumes Runtime outputs, Memory, and Reasoning read-only and redefines none of them;
2. it preserves the Organizational Intelligence Foundation and Runtime vocabulary and boundaries without redefinition;
3. it holds Heby's identity immutable, with capabilities and non-responsibilities intact and canonically ordered;
4. it preserves Director authority and the Director Approval boundary;
5. it contains no execution path, no workflow trigger, and no agent autonomy;
6. it produces no hidden decision, no invented content, and no silent conflict resolution;
7. it holds no circular responsibility with any upstream layer;
8. it keeps Vision, Architecture, and Roadmap concerns separated across the three companion documents;
9. it names no model, vendor, database, schema, or code as a dependency.

---

## 16. Related Documents

- [Heby — Vision](heby-vision.md)
- [Heby — Roadmap](heby-roadmap.md)
- [Heby Interaction Model](heby-interaction-model.md)
- [Heby Live Studio](heby-live-studio.md)
- [Heby Architecture Mapping](../architecture/heby/heby-architecture-mapping.md)
- [Organizational Intelligence Runtime — Vision](organizational-intelligence-runtime-vision.md)
- [Organizational Intelligence Runtime — Architecture](organizational-intelligence-runtime-architecture.md)
- [Organizational Intelligence Runtime — Roadmap](organizational-intelligence-runtime-roadmap.md)
- [Program VIII — Organizational Intelligence Constitution](../architecture/programs/program-08-organizational-intelligence/constitution.md)
- [Hebun AI Enterprise Constitution](../architecture/00-enterprise-constitution.md)

**DOCUMENT STATUS: RECORDED — CONCEPTS ONLY**
