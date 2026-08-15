# 22 — Heby Guided Learning Mode

**Priority:** Future
**Status:** Planned — architecture-prerequisite-gated (see *Deferral gate*)

## Purpose

Let Heby teach a person how Hebun works **on the real Hebun interface**, rather than only describing it in chat.

A person asks *"Governance Authority'yi bana öğret."* The intended future experience is that Heby explains the concept **while identifying and visually indicating the actual Governance Authority surface in Hebun**, then walks forward through the lesson — connecting AI Systems Architect education to the product the person is actually looking at.

## Relationship to the existing Guided Explanation Layer

**This capability does not start from nothing, and it must not restate what is already recorded.**

The presentation architecture for pointing at the interface already exists as the **Guided Explanation Layer** in [Product Information Architecture § Guided Explanation](../product-vision/ui/hebun-information-architecture.md). That document already fixes:

- the flow `Heby Response → Guidance Instruction → Navigation Target → Workspace → Stable UI Anchor → Guidance Overlay → Explanation`;
- **semantic UI anchors, never guessed coordinates, brittle selectors, DOM-position assumptions, text scraping, or model-generated pixel locations**;
- guidance types (HIGHLIGHT, SPOTLIGHT, CIRCLE, UNDERLINE, ARROW, PULSE) as a presentation concern;
- guidance as **temporary, non-destructive, and never modifying organizational state**;
- sequential and cross-workspace teaching that references the owning workspace and duplicates no foreign workspace state;
- evidence-first teaching — `SOURCE → EVIDENCE → PROVENANCE → UI REPRESENTATION → HEBY EXPLANATION`, with uncertainty surviving presentation;
- the education-vs-authority invariant — a highlight is not an action, navigation is not authorization, explanation is not approval;
- **no eighth workspace.**

**What this backlog item adds is the LEARNING dimension and the deferral gate**, not a second design of the overlay. Guided Explanation answers *"show me what I am looking at."* Guided Learning asks the further question *"teach me this subject, across several surfaces, as a lesson with a beginning and an end."*

## Responsibilities

- Deliver a **lesson**, not a single explanation: an ordered sequence with a subject, a start, and an end.
- Move the learner between UI elements and workspaces as the lesson progresses.
- Connect the AI Systems Architect / [Hebun Academy](../product-vision/hebun-academy.md) curriculum to concrete Hebun surfaces.
- Maintain lesson and progress state **where architecturally justified** — ownership is an open question, see below.

## Architectural boundaries

Recorded now so they cannot be quietly assumed later. This capability is **NOT**:

- Computer Use authority;
- permission to execute consequential actions;
- a second UI authority;
- a reason to duplicate workspace state;
- arbitrary DOM manipulation;
- a hard-coded selector system;
- permission for Heby to mutate organizational truth.

Heby remains the conversation, explanation and interaction surface. Teaching is not deciding, and pointing at a control is not permission to use it.

## Deferral gate

**Architecture discovery begins only after the three architectural prerequisites below are mature.**

> **Supersedes an undefined phase reference.** An earlier draft of this record gated discovery on *"KP5 complete."* The repository defines no `KP` phase series — a repository-wide search for `KP<n>` returns it nowhere except in that sentence, so the gate pointed at nothing. It is superseded here, and **no phase number is substituted for it**: mapping it onto an existing series would fabricate a schedule the repository does not have.
>
> The gate is instead restated as **architectural prerequisites**, which is what the [Product IA](../product-vision/ui/hebun-information-architecture.md) already requires of exactly this capability: *"Roadmap dependency (architectural, not a phase renumbering) … The architectural dependency governs; speculative phase numbers do not."* This is not a new rule invented for this record — it is that rule applied. Phase numbers may be renumbered, reordered, or retired; a prerequisite expressed as architecture stays meaningful when they are.

### The three prerequisites

**1 — Knowledge and Knowledge Retrieval foundation mature.**
Guided Learning is evidence-first teaching: `SOURCE → EVIDENCE → PROVENANCE → UI REPRESENTATION → HEBY EXPLANATION` (Product IA). A lesson must *retrieve* the subject's material before it can point at a surface and explain it, or it will invent the explanation — precisely what invariant 5 forbids. The Knowledge Retrieval Runtime is real but young; its own [closure record](../product-vision/runtime/hebun-knowledge-retrieval-runtime-closure.md) § *Remaining limitations* names what is still missing (no semantic retrieval, no typo tolerance, directional numbers from a synthetic corpus, and a canonical corpus holding one fact). A curriculum cannot be taught out of a corpus that thin.

**2 — Stable Guided Explanation semantic anchors.**
That guidance must use semantic anchors is **already settled** — Product IA invariant 4. What does not exist is the **naming contract**: the Product IA defers it in its own words, *"the naming contract is defined at implementation."* A single explanation can tolerate an anchor set still in motion; an ordered lesson that crosses several surfaces cannot, because every step addresses an anchor and the whole sequence breaks when one moves. The contract must exist and be **stable**, not merely exist.

**3 — Core Heby interaction architecture mature.**
Expressed in the [Heby Roadmap](../product-vision/heby-roadmap.md)'s own nine-phase sequence, the lesson-bearing prerequisites are **Phase 3 — Presentation and Explanation**, **Phase 4 — Grounding and Anti-Hallucination**, and **Phase 5 — Intent and Natural-Language Interaction**: a lesson *is* presentation, it must be grounded before it teaches, and it is started by a natural-language request (*"Governance Authority'yi bana öğret."*). That Roadmap is itself `RECORDED — CONCEPTS ONLY` and opens no phase; naming these phases states a dependency, it does not schedule them.

Sequence:

```
Knowledge / Knowledge Retrieval foundation mature
  + stable Guided Explanation semantic anchor contract
  + core Heby interaction architecture mature
    → Guided Learning Architecture Discovery
      → only then an implementation decision (Director gate)
```

Documentation of this capability is **not** authorization to begin it, and the presence of a working Guided Explanation design is **not** a reason to start early.

## Discovery questions — and what the repository already answers

The Director named ten questions for architecture discovery. **Five of them are already answered by published authoritative documents.** They are marked as settled rather than repeated as open, because carrying a settled question forward as unresolved would contradict the document that resolved it — and would invite discovery to re-decide something already decided.

**Already settled — confirm, do not re-invent:**

| # | Question | Where it is settled |
|---|---|---|
| 1 | How Heby identifies UI elements reliably | **Semantic anchors.** Guidance must not rely on guessed coordinates, brittle selectors, DOM-position assumptions, text scraping, or model-generated pixel locations — [Product IA](../product-vision/ui/hebun-information-architecture.md), invariant 4. *The anchor **naming contract** is still undefined; that part is open.* |
| 2 | Whether Hebun needs semantic UI identifiers / teaching anchors | **Yes, required** — same source. *The contract itself remains to be written.* |
| 3 | How navigation between workspaces is represented | Cross-workspace guidance **references the owning workspace** and duplicates no foreign workspace state — Product IA, invariant 7. |
| 6 | Accessibility behavior | **Settled, and stronger than a discovery item.** Every highlight has an equivalent semantic explanation, with screen-reader, keyboard, reduced-motion, non-color-only emphasis, focus management and dismissal — Product IA, invariant 9. A red circle may be one treatment; it can never be the only channel. |
| 8 | Boundary with Computer Use | **Settled.** For Hebun-owned UI, guidance uses semantic application anchors and does **not** require Computer Use; Computer Use may later be necessary only for *external* applications whose DOM Hebun does not control — Product IA, invariant 10. A guidance instruction is never permission to invoke a tool. |

**Genuinely open — discovery must answer these:**

4. **Lesson state and progress ownership.** Which subsystem owns whether a lesson was started, resumed, or completed — and whether that is durable at all. Nothing in the repository answers this; the Guided Explanation Layer is stateless by design (guidance is temporary and non-destructive), so a lesson that *remembers* is a genuinely new concern.
5. **Authorization boundaries for teaching.** The general rule is settled — restricted content stays withheld and visibility remains server-authorized (Product IA, invariant 8) — but *which lessons are offered to whom*, and how a lesson behaves when the learner cannot see the surface it wants to point at, is undecided.
7. **Resilience when UI components change.** Anchors reduce brittleness; they do not eliminate staleness. A lesson that silently points at the wrong thing is worse than one that admits the anchor is gone.
9. **Whether Heby observes learner completion, or only provides guidance.** This is a data-collection and privacy decision, not a UI detail, and it determines whether progress is even observable.
10. **How the AI Systems Architect curriculum connects to guided UI lessons.** The teaching *loop* is recorded in the [Heby Interaction Model](../product-vision/heby-interaction-model.md#guided-organizational-intelligence-and-learning); the *curriculum-to-surface mapping* is not. See [Hebun Academy](../product-vision/hebun-academy.md).

## Not to be confused with

- **[06 — Hebun Guide](06-hebun-guide.md)** — a *public, pre-authentication, low-trust* assistant that explains the product to visitors and escalates to sales. Guided Learning is the opposite trust tier: an authenticated in-product capability teaching a real operator inside their own tenant. Different surface, different audience, different trust boundary. Neither supersedes the other.
- **[Hebun Academy](../product-vision/hebun-academy.md)** — the education *platform* and curriculum. Guided Learning is a delivery mechanism that a curriculum may eventually use; it is not the Academy and does not own it.

## Dependencies

- Guided Explanation Layer — the presentation architecture it builds on ([Product IA](../product-vision/ui/hebun-information-architecture.md))
- Semantic UI anchor contract — does not exist yet; a prerequisite, not an assumption
- Heby context architecture — [Heby Architecture](../product-vision/heby-architecture.md), [Heby Roadmap](../product-vision/heby-roadmap.md)
- Knowledge and Knowledge Retrieval — the evidence a lesson teaches from ([Knowledge Retrieval Runtime closure](../product-vision/runtime/hebun-knowledge-retrieval-runtime-closure.md))
- Curriculum source — [Hebun Academy](../product-vision/hebun-academy.md)

## Promotion criteria

- The three architectural prerequisites in *Deferral gate* are met: Knowledge/Knowledge Retrieval foundation mature, a stable semantic anchor contract, and a mature core Heby interaction architecture.
- Guided Learning Architecture Discovery performed and recorded.
- Semantic UI anchor **naming contract** defined and stable — the requirement for anchors is already settled; the contract is not.
- Lesson/progress state ownership decided, with a justification for durability or its absence.
- Learner-observation decision taken explicitly (observed vs guidance-only), with its privacy consequence stated.
- Anchor-staleness behaviour defined — a lesson admits a missing anchor rather than pointing at the wrong thing.
- Curriculum-to-surface mapping defined with [Hebun Academy](../product-vision/hebun-academy.md).
- The 14 Guided Explanation invariants in the [Product IA](../product-vision/ui/hebun-information-architecture.md) hold unchanged for lessons, not only for single explanations.
- Director approval.
