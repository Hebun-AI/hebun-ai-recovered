# Heby — Roadmap

## 1. Document Status

**DOCUMENT TYPE: PRODUCT VISION — HEBY ROADMAP**

**STATUS: RECORDED — CONCEPTS ONLY**

This is a Roadmap document. It sequences *conceptual* phases for the future Heby Executive Intelligence Interface. It is not Implementation. It contains no code, no class, no interface, no API, no database, no schema, no migration, no UI, and no execution behavior. It opens no phase and authorizes no work. Each phase is a unit of meaning to be separately authorized under Director governance.

It is subordinate to the [Hebun AI Enterprise Constitution](../architecture/00-enterprise-constitution.md), the [Program VIII — Organizational Intelligence Constitution](../architecture/programs/program-08-organizational-intelligence/constitution.md), the published Enterprise Memory, Enterprise Reasoning, and Organizational Intelligence Foundation layers, and the published Organizational Intelligence Runtime Vision, Architecture, and Roadmap. It builds on the companion [Vision](heby-vision.md) and [Architecture](heby-architecture.md).

Together with the Vision and Architecture, this Roadmap is the single authority for all future Heby phases. No Heby phase may begin, and no Heby scope may be claimed, except as sequenced here and separately authorized by the Director.

The scope of this document is Hebun AI only.

---

## 2. Sequencing Rationale

The phase order follows Heby's own position in the enterprise's directional pass and the boundary order fixed in the [Architecture](heby-architecture.md): Identity → Input/Context → Presentation/Explanation → Grounding → Intent → Approval/Director → Governance → Director Briefing → Integration Closure.

The nine-phase order below was checked against the published Runtime and Foundation and is kept in this order because:

- Heby's immutable identity must exist before any capability consumes it — nothing can be presented, grounded, or bounded against an identity that is not yet fixed (Phase 1);
- inputs and context must be admissible read-only before anything can be presented (Phase 2);
- presentation and explanation must exist before grounding can be enforced over what is presented (Phase 3);
- grounding — the defense against invention and hallucination — is hardened as its own phase before natural-language intent is allowed to shape presentation (Phase 4);
- natural-language intent interpretation, the first model-assisted surface, is introduced only after grounding and presentation are safe (Phase 5);
- approval preparation and the Director boundary are fixed before any governance or briefing surface can route to a human decision (Phase 6);
- governance and security constraint enforcement (consume-only) gate everything before the briefing surface (Phase 7);
- the Director briefing and interaction surface come last before closure, because they route to the accountable human (Phase 8);
- integration and composition closure prove the whole interface end-to-end (Phase 9).

One deliberate note on ordering: grounding, provenance carriage, and boundary compliance are *bound in principle* from Phase 1 onward — no phase may ever present ungrounded or unbounded material — but Phase 4 is where anti-hallucination grounding is unified and hardened as a cross-cutting concern. Earlier phases satisfy the boundary locally; Phase 4 makes it consistent and complete. Material before Phase 4 is never ungrounded; it is grounded per-phase and then consolidated.

---

## 3. Phases

### Phase 1 — Identity Foundation

- **Purpose:** Establish Heby's immutable, canonical identity and its closed capability boundary — the constitutional anchor every later phase consumes.
- **Scope:** Define name, role, capabilities (MAY), non-responsibilities (MUST NEVER), communication principles, director relationship, runtime relationship, approval philosophy, governance philosophy, and transparency philosophy; define the identity boundary that holds them immutable and deep-frozen.
- **Inputs:** Heby Vision and Architecture; the published Runtime Vision, Architecture, and Roadmap; Program VIII constitution; the Heby Architecture Mapping.
- **Outputs:** The canonical Heby identity definition and identity boundary — deterministic, deep-frozen, canonically ordered.
- **Dependencies:** Published Organizational Intelligence Runtime; this Vision and Architecture.
- **Non-responsibilities:** No input consumption, no presentation, no explanation, no intent interpretation, no approval, no governance enforcement, no AI, no execution.
- **Exit criteria:** Identity is immutable and deep-frozen; capabilities and non-responsibilities are preserved intact and canonically ordered; the MAY set is entirely presentational/interrogative and the MUST-NEVER set entirely excludes authority and action; output is deterministic and stable across serialization.
- **Test requirements:** Identity integrity; immutability and deep freeze; canonical ordering; boundary validation; capabilities preserved; non-responsibilities preserved; deterministic output; serialization and encoding stability.
- **Publication boundary:** Opens nothing downstream; separate Director gate required for Phase 2.

### Phase 2 — Input and Context Consumption

- **Purpose:** Realize the Input Consumer and Context Binder — admit intelligence-system outputs read-only and bind authorized enterprise context.
- **Scope:** Admit Runtime advisory outputs, settled Reasoning understanding, and settled Memory context through the Input Boundary; bind the person's role, domain, subject, authority basis, and applicable Governance/Security/privacy/classification constraints.
- **Inputs:** Phase 1 identity; Runtime Output Boundary; settled Memory context; settled Reasoning understanding.
- **Outputs:** Validated, attributable, read-only admitted inputs bound to a declared context.
- **Dependencies:** Phase 1; published Runtime Output Boundary; published Memory Context Assembly; published Reasoning Understanding.
- **Non-responsibilities:** No presentation, no explanation, no intent interpretation, no mutation of any source, no decision, no execution.
- **Exit criteria:** Inputs admitted read-only with provenance verified; Input and Context boundaries enforced; fail-closed on missing provenance, stale input, or unauthorized context.
- **Test requirements:** Read-only admission proven; provenance preserved; unqualified or stale inputs rejected; context binding attributable and scope-bound.
- **Publication boundary:** Separate Director gate required for Phase 3.

### Phase 3 — Presentation and Explanation

- **Purpose:** Realize the Presentation Assembler and Explanation Surface — render admitted material honestly.
- **Scope:** Compose explanations, summaries, and navigations with evidence, sources, confidence, and uncertainty attached and distinguished; expose the "why / evidence / sources / assumptions / uncertainty / what-changed" continuation from the basis the Runtime already carries.
- **Inputs:** Phase 2 admitted inputs and bound context.
- **Outputs:** Attributable, scope-bound, non-authoritative presentations and explanations.
- **Dependencies:** Phase 2.
- **Non-responsibilities:** No invention of rationale, no exposure of protected information, no prescription of implementation, no decision, no execution.
- **Exit criteria:** Presentations distinguish evidence, interpretation, recommendation, uncertainty, and decision; provenance and confidence carried intact; nothing asserted as truth beyond its declared confidence.
- **Test requirements:** Uncertainty preserved and marked; provenance carried through presentation; protected information never exposed; presentation is non-authoritative.
- **Publication boundary:** Separate Director gate required for Phase 4.

### Phase 4 — Grounding and Anti-Hallucination

- **Purpose:** Unify and harden the Grounding Validator across all presentation — the cross-cutting defense against invention and hallucination.
- **Scope:** Verify every presented element traces to a settled source; withhold or clearly mark anything unsupported; consolidate grounding, provenance carriage, and boundary compliance uniformly across all presentation kinds.
- **Inputs:** Presentations and explanations from Phase 3; admitted inputs from Phase 2.
- **Outputs:** Uniformly grounded presentations, ready for intent-shaped interaction.
- **Dependencies:** Phases 2–3.
- **Non-responsibilities:** No new content generation; grounding does not alter meaning; unsupported content is never dressed as grounded.
- **Exit criteria:** No element can be presented without a settled-source trace; hallucination fails closed; grounding is consistent across all presentation kinds.
- **Test requirements:** Ungrounded content withheld or marked; every presented element proven traceable; invention and hallucination fail closed; grounding consistent across kinds.
- **Publication boundary:** Separate Director gate required for Phase 5.

### Phase 5 — Intent and Natural-Language Interaction

- **Purpose:** Realize the Intent Interpreter — the first model-assisted surface — under the determinism and AI boundary.
- **Scope:** Interpret natural-language intent within authorized context; clarify ambiguity by asking rather than assuming; keep model assistance strictly interpretive and never trusted directly.
- **Inputs:** Phase 4 grounded presentations; Phase 2 bound context; Phase 1 identity.
- **Outputs:** Interpreted, clarified intent routed only to grounded, bounded presentation.
- **Dependencies:** Phases 1–4.
- **Non-responsibilities:** No candidate generation, no reasoning-as-authority, no independent AI authority, no assumption of ambiguous intent, no decision, no execution.
- **Exit criteria:** No AI output accepted as authority; ambiguous intent triggers clarification; every model-shaped response still passes grounding and boundary validation; Heby never calls a model to bypass Runtime determinism or governance.
- **Test requirements:** AI output never trusted directly; ambiguity fails to clarification, not assumption; model-shaped presentation remains grounded and bounded; identity and non-responsibilities preserved under interpretation.
- **Publication boundary:** Separate Director gate required for Phase 6.

### Phase 6 — Approval Preparation and Director Boundary

- **Purpose:** Realize the Approval Preparer and the Director Boundary — keep approval intent distinct and terminate at the human.
- **Scope:** Prepare items for the appropriate human review or approval process; keep approval-related interaction visibly distinct from advice; ensure every interaction terminates at the Director without implying a decision.
- **Inputs:** Phase 3–5 grounded, interpreted presentations; Phase 1 approval philosophy.
- **Outputs:** Prepared review/approval items, visibly distinct from advice, awaiting a human process.
- **Dependencies:** Phases 1–5.
- **Non-responsibilities:** No approval, no decision, no implied authority, no workflow trigger, no execution.
- **Exit criteria:** Advice never presented as approval; a conversational "approve" never treated as an authoritative act; every path terminates at the Director boundary.
- **Test requirements:** Approval intent distinct from advice; no path advances past a human decision; authority remains visible; consequences understandable before confirmation.
- **Publication boundary:** Separate Director gate required for Phase 7.

### Phase 7 — Governance and Security Constraint Enforcement

- **Purpose:** Realize the Governance Constraint Holder — consume Governance and Security constraints as immutable and block violating presentation.
- **Scope:** Hold applicable Governance and Security constraints immutable (consume-only); enforce tenant and organization isolation, evidence eligibility, classification, and no-secret-exposure across all presentation.
- **Inputs:** Phase 2 bound constraints; Phase 3–6 presentations and prepared items.
- **Outputs:** Presentation gated against Governance and Security violations; blocks recorded.
- **Dependencies:** Phases 1–6.
- **Non-responsibilities:** No approval, no waiver, no authorship or reinterpretation of Governance/Security, no decision, no execution.
- **Exit criteria:** Constraint violation stops presentation and is recorded; constraints held immutable; no cross-tenant or cross-organization leakage; no secret exposure.
- **Test requirements:** Violations fail closed and are recorded; isolation enforced; classification rides every rendered element; Heby never approves, waives, or authors a constraint.
- **Publication boundary:** Separate Director gate required for Phase 8.

### Phase 8 — Director Briefing and Interaction Surface

- **Purpose:** Realize the Director Interaction Surface — present assembled advisory material to the accountable human.
- **Scope:** Present the briefing, grounded evidence, reasoning, risk, opportunity, options, uncertainty, history, and audit; carry human questions and recorded decisions across the human boundary without resolving them.
- **Inputs:** Phase 7 gated presentations and prepared items; Runtime Director Briefings.
- **Outputs:** Director-facing advisory presentation awaiting a human decision, fully attributable.
- **Dependencies:** Phases 1–7.
- **Non-responsibilities:** No decision, no approval, no execution, no UI design authority beyond conceptual presentation.
- **Exit criteria:** Briefing terminates at the Director Approval boundary; a presented finding is never an approval; the full audit trail accompanies every briefing.
- **Test requirements:** No path advances past a human decision; briefings carry full audit; recorded decisions immutable except by attributable supersession; authority preserved throughout.
- **Publication boundary:** Separate Director gate required for Phase 9.

### Phase 9 — Integration and Composition Closure

- **Purpose:** Prove the full interface end-to-end and close Heby's composition.
- **Scope:** Compose all phases into one stateless presentation over fixed identity, bound context, and settled read-only inputs; verify the complete path from Runtime/Memory/Reasoning to Director presentation.
- **Inputs:** All prior phases.
- **Outputs:** A verified, reproducible end-to-end Heby composition.
- **Dependencies:** Phases 1–8.
- **Non-responsibilities:** No execution path introduced by composition; no hidden state; no autonomy; no bypass of the Director.
- **Exit criteria:** End-to-end presentation is idempotent, replayable, and auditable; every boundary holds under composition; identity remains immutable throughout; no circular responsibility; Director authority preserved.
- **Test requirements:** Full-path replay and reconstruction; boundary conformance under composition; fail-closed under every named failure mode; identity integrity under composition.
- **Publication boundary:** Closure of the Heby roadmap; opens nothing further without separate Director authorization.

---

## 4. Roadmap Validation

The roadmap is consistent with published architecture when:

1. every phase consumes only fixed identity, bound context, and settled read-only inputs;
2. the phase order matches Heby's boundary order and never precedes identity with any consuming capability;
3. no phase introduces an execution path, a workflow trigger, agent autonomy, or a hidden decision;
4. grounding, provenance, and boundary compliance are bound from Phase 1, with Phase 4 consolidating anti-hallucination grounding;
5. model assistance is introduced only after grounding and presentation are safe, and is never trusted directly;
6. governance, approval, and the Director boundary gate everything before closure;
7. Vision, Architecture, and Roadmap concerns remain separated across the three companion documents;
8. no model, vendor, database, schema, or code is named as a dependency.

---

## 5. Long-Term Evolution

Beyond Phase 9, Heby's evolution is bounded by the same invariant that defines it: Heby may grow richer as an interface, never as an authority. Future Director Decisions may extend Heby's interaction depth — conversation modes, explainability patterns, command and palette concepts, accessibility, and multimodal interaction as recorded in the [Heby Interaction Model](heby-interaction-model.md), and richer presentation surfaces as explored in [Heby Live Studio](heby-live-studio.md).

Every such extension must preserve, without exception:

- the immutable identity and its closed capability boundary;
- the read-only relationship to Memory, Reasoning, Organization, and Runtime;
- the anti-invention and anti-hallucination grounding discipline;
- the visible distinction between advice, review, and approval;
- the Director Approval boundary and human accountability.

As the enterprise publishes further architecture, Heby's maturity for those concepts may advance from *Understand* toward *Reason* through the [Heby Architecture Mapping](../architecture/heby/heby-architecture-mapping.md); it never reaches *Act* except within a separately authorized, separately governed Runtime boundary that Heby consumes but never becomes. No future phase may amend this Roadmap's invariants except by an explicit Director Decision that updates this trio of documents.

---

## 6. Related Documents

- [Heby — Vision](heby-vision.md)
- [Heby — Architecture](heby-architecture.md)
- [Heby Interaction Model](heby-interaction-model.md)
- [Heby Live Studio](heby-live-studio.md)
- [Heby Architecture Mapping](../architecture/heby/heby-architecture-mapping.md)
- [Organizational Intelligence Runtime — Vision](organizational-intelligence-runtime-vision.md)
- [Organizational Intelligence Runtime — Architecture](organizational-intelligence-runtime-architecture.md)
- [Organizational Intelligence Runtime — Roadmap](organizational-intelligence-runtime-roadmap.md)
- [Program VIII — Organizational Intelligence Constitution](../architecture/programs/program-08-organizational-intelligence/constitution.md)
- [Hebun AI Enterprise Constitution](../architecture/00-enterprise-constitution.md)

**DOCUMENT STATUS: RECORDED — CONCEPTS ONLY**
