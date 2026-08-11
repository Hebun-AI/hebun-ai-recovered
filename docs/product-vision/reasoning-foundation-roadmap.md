# Reasoning Foundation — Development Roadmap

## 1. Document Status

**DOCUMENT TYPE: PRODUCT VISION — ROADMAP**

**STATUS: RECORDED — CONCEPTS ONLY**

This is a Roadmap document. It is not Vision, not Architecture, not Implementation, and not Runtime. It contains no code, no API, no database, and no runtime behavior. It defines no LLM, agent, tool-calling, planning, or execution mechanism.

It builds on two companions:

- The **Vision** document — why the Reasoning Foundation exists.
- The **Architecture Vision** document — how it is positioned and bounded.

This document defines, conceptually, the A-to-Z development plan: the phases, what each is for, its single responsibility, its inputs and outputs, its dependencies, and what it makes possible. It authorizes nothing. Human and Director authority remain final over each phase.

---

## 2. Roadmap Philosophy

The roadmap is envisioned as a **sequence of small, single-purpose foundations**, mirroring how the Memory Foundation was built: one responsibility per phase, each published and verified before the next begins.

No phase reaches ahead of itself. Understanding is built up the way it is meant to be consumed — contracts first, then relating, then implication, then the qualities (contradiction, provenance, explanation, confidence) that make understanding trustworthy, then final assembly. Each phase is boring on its own and valuable in composition.

---

## 3. Development Principles

- **Single responsibility** — each phase owns exactly one main concern.
- **Loosely coupled** — phases depend on published contracts, not on each other's internals.
- **No responsibility bleed** — no phase takes on another phase's job.
- **Deterministic in spirit** — every phase is envisioned to be reconstructable and testable.
- **Advisory throughout** — nothing any phase produces decides or acts.
- **Bounded to memory** — no phase invents facts beyond the assembled memory context.
- **Published before proceeding** — a phase is complete only when verified and recorded.

---

## 4. Phase Overview

Eight phases, each a foundation:

1. **Reasoning Contracts** — the canonical shapes of reasoning input, step, and conclusion.
2. **Relation** — relating memories to one another.
3. **Implication** — surfacing what follows from related facts.
4. **Contradiction & Gap** — exposing tensions and missing pieces.
5. **Provenance** — preserving the chain from conclusion back to basis.
6. **Explainability** — presenting understanding legibly.
7. **Confidence & Uncertainty** — declaring the limits of each conclusion.
8. **Understanding Assembly** — assembling the full explained understanding for consumption.

---

## 5. Phase Dependency Graph

```text
Phase 1 Reasoning Contracts
        ↓
Phase 2 Relation
        ↓
Phase 3 Implication
        ↓
Phase 4 Contradiction & Gap
        ↓
Phase 5 Provenance
        ↓
Phase 6 Explainability
        ↓
Phase 7 Confidence & Uncertainty
        ↓
Phase 8 Understanding Assembly
```

Each phase depends on the published contracts of the phases before it, and enables the phase after it. The dependency is linear and one-directional; no phase depends on a later phase.

---

## 6. Phase 1 — Reasoning Contracts

- **Purpose:** Establish the canonical, technology-neutral shapes of reasoning — what a reasoning input, a reasoning step, and a conclusion *are* — so every later phase speaks one vocabulary.
- **Scope:** Contract definitions only: reasoning input (assembled memory context), reasoning step, conclusion, and basis reference.
- **Inputs:** The Memory Foundation's assembled-context concept (as an input shape).
- **Outputs:** Published reasoning contracts.
- **Non-Responsibilities:** No relating, no implication, no explanation, no confidence, no assembly.
- **Exit Criteria:** Contracts defined, immutable, technology-neutral, and consumable by later phases.

---

## 7. Phase 2 — Relation

- **Purpose:** Relate the facts within an assembled memory context to one another, deterministically.
- **Scope:** Establishing explicit relationships (supports, contradicts, supersedes, relates-to) between memories in the input.
- **Inputs:** Phase 1 contracts; an assembled memory context.
- **Outputs:** A set of explicit, deterministic relationships between input facts.
- **Non-Responsibilities:** No implication (what follows), no contradiction analysis as a conclusion, no explanation, no confidence.
- **Exit Criteria:** Deterministic relations produced and traceable to the memories they connect.

---

## 8. Phase 3 — Implication

- **Purpose:** Surface what deterministically follows from the related facts.
- **Scope:** Deriving implications that the input plus its relations directly support.
- **Inputs:** Phase 1 contracts; Phase 2 relations.
- **Outputs:** A set of implications, each linked to the relations and facts that support it.
- **Non-Responsibilities:** No decision, no planning, no contradiction resolution, no confidence scoring, no explanation formatting.
- **Exit Criteria:** Implications produced deterministically, each grounded in supporting relations.

---

## 9. Phase 4 — Contradiction & Gap

- **Purpose:** Expose tensions between facts and gaps where understanding is incomplete.
- **Scope:** Identifying contradictions among relations/implications and marking missing pieces.
- **Inputs:** Phase 2 relations; Phase 3 implications.
- **Outputs:** A set of identified contradictions and declared gaps.
- **Non-Responsibilities:** No resolution of contradictions, no filling of gaps by invention, no decision.
- **Exit Criteria:** Contradictions and gaps surfaced deterministically, each traceable to its source facts.

---

## 10. Phase 5 — Provenance

- **Purpose:** Preserve, for every conclusion, the full chain back to its supporting memory.
- **Scope:** Attaching an inspectable basis to each relation, implication, contradiction, and gap.
- **Inputs:** Outputs of Phases 2–4.
- **Outputs:** Every reasoning artifact carrying its complete provenance chain.
- **Non-Responsibilities:** No new conclusions, no explanation prose, no confidence, no assembly.
- **Exit Criteria:** No conclusion exists without a complete, traceable basis.

---

## 11. Phase 6 — Explainability

- **Purpose:** Present the reasoning — relations, implications, tensions, and their provenance — in a form a human can inspect and follow.
- **Scope:** Legible, deterministic presentation of understanding.
- **Inputs:** Provenance-carrying artifacts from Phase 5.
- **Outputs:** Human-legible explanations, each still linked to its basis.
- **Non-Responsibilities:** No new reasoning, no confidence judgment, no decision, no UI implementation.
- **Exit Criteria:** Every conclusion is walkable step-by-step by a human, without special tooling.

---

## 12. Phase 7 — Confidence & Uncertainty

- **Purpose:** Declare, plainly, the confidence and the limits of each conclusion.
- **Scope:** Attaching deterministic, explainable confidence and explicit uncertainty to reasoning artifacts.
- **Inputs:** Explained artifacts from Phase 6.
- **Outputs:** Conclusions annotated with confidence and stated uncertainty.
- **Non-Responsibilities:** No probabilistic AI scoring, no decision, no suppression of low-confidence results.
- **Exit Criteria:** Every conclusion states how far it can be trusted and what it does not know.

---

## 13. Phase 8 — Understanding Assembly

- **Purpose:** Assemble the complete, explained, confidence-annotated understanding into a bounded context ready for human decision or a future planning layer.
- **Scope:** Deterministic assembly, ordering, grouping, and bounding of the reasoning output.
- **Inputs:** All prior phases' outputs.
- **Outputs:** A single, immutable, explainable understanding context.
- **Non-Responsibilities:** No decision, no planning, no execution, no new reasoning.
- **Exit Criteria:** A bounded, immutable understanding context that carries every conclusion with its basis and confidence.

---

## 14. Cross-Phase Rules

- Every phase consumes only **published** contracts of earlier phases.
- No phase mutates memory or any earlier phase's output.
- No phase performs decision, planning, execution, or agency.
- No phase invents facts beyond the assembled memory context.
- Determinism and explainability are preserved at every phase.
- A later phase never becomes a dependency of an earlier phase.

---

## 15. Validation Strategy

Each phase is envisioned to be validated in isolation and in composition:

- Deterministic behavior — same input yields the same output.
- Boundary adherence — no forbidden dependency, no responsibility bleed.
- Traceability — every output links to its basis.
- Immutability — outputs cannot be mutated by consumers.
- Compatibility — later phases consume earlier contracts cleanly.

Validation is conceptual here; it names *what* must hold, not *how* it is tested.

---

## 16. Publication Strategy

Each phase is envisioned to be **implemented, verified, and published before the next begins** — the same discipline used for the Memory Foundation. A phase is complete only when its single responsibility is met, its boundaries hold, and it is recorded. No phase is published while a blocking defect exists.

---

## 17. Long-Term Evolution

After the eight phases, the Reasoning Foundation is envisioned to deepen **within its boundary** — richer relations, clearer explanations, better-stated uncertainty — never outward into decision, action, or autonomy. New capability is envisioned to arrive as further single-purpose foundations, not as responsibility added to existing phases.

---

## 18. Completion Criteria

The Reasoning Foundation is envisioned complete when:

- All eight phases are published and verified.
- Understanding flows deterministically from assembled memory to explained, confidence-annotated output.
- Every conclusion is traceable to its basis and legible to a human.
- Reasoning takes no decision, action, plan, or autonomous behavior.
- The foundation is ready to serve human decision and a future planning layer.

---

## 19. Boundaries

This document explicitly does NOT define:

- Vision or Architecture (its companions do)
- Implementation or code
- APIs
- Databases
- Runtime behavior
- LLMs or AI models
- Agents
- Tool-calling
- Planning implementation
- Execution implementation

This is a Roadmap record only. It defines the phased development plan for the Reasoning Foundation — each phase's purpose, single responsibility, inputs, outputs, dependencies, and exit criteria — conceptually and loosely coupled. Every phase named here is directional. None is opened, designed, built, or authorized by this document. Any future realization requires separate Director authority and the applicable constitutional gates.
