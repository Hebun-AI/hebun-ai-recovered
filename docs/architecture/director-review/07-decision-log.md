# 07 — Decision Log

The major architectural decisions made across Phase 7, with rationale. Permanent records — a superseded decision is recorded and replaced, never rewritten.

---

## D-1 — Reasoning is advisory: it produces judgment, never action

**Decision.** Director Intelligence forms judgment, plans, decisions, and verdicts, but never executes. Every layer is advisory.

**Why.** Advice you can trust is advice that cannot secretly also be action. Keeping the whole chain advisory is what makes it safe to rely on and what keeps authority with the Director. Execution is a separate domain.

## D-2 — The Director always holds final authority

**Decision.** Every chain in Director Intelligence terminates at the Director; committing actions require explicit, per-action Director approval.

**Why.** The one who bears the consequences must be the one who decides. Capability may grow without bound; authority stays at zero. This is the fixed point the whole architecture is built around.

## D-3 — Separate the reasoning concerns into distinct layers

**Decision.** Split Director Intelligence into philosophy, cognition, mechanisms, planning, decision, verification, and orchestration — each its own layer.

**Why.** Each concern (why / how / tools / plan / choose / check / coordinate) evolves and is reviewed independently. Separation keeps each layer clean and lets each improve without disturbing the others.

## D-4 — Cognition (lifecycle) is separate from mechanisms (tools)

**Decision.** The ordered cognitive lifecycle (7B) and the cross-cutting cognitive mechanisms (7C) are distinct.

**Why.** The lifecycle is a fixed order; mechanisms are reusable tools used across many stages. Keeping them separate lets the tools deepen without changing the sequence, and vice versa.

## D-5 — Verification is independent of the layers it checks

**Decision.** Verification (7F) is a separate layer that critiques reasoning, planning, and decision from outside, read-only.

**Why.** A layer cannot fully check its own work — the assumptions that caused an error would excuse it. Independence is what lets verification catch flaws the producing layers missed. It audits; it never rewrites.

## D-6 — Orchestration coordinates but does no layer's work

**Decision.** Orchestration (7G) sequences, routes, and governs the workflow but forms no judgment, plan, decision, or verdict of its own.

**Why.** Folding coordination into any component would give that component authority over the others. A pure coordinator keeps the layers' separation intact and holds the workflow's gates without owning its content.

## D-7 — The workflow is corrective, not merely sequential

**Decision.** Verification findings route back through orchestration's feedback loops to the responsible layer, which corrects and re-verifies.

**Why.** A flawed outcome must not be pushed forward. Feedback loops make Director Intelligence self-correcting while keeping each correction with the layer responsible for it. Non-convergent flaws surface to the Director rather than churning.

## D-8 — Governance and the committing-action boundary run the whole chain

**Decision.** The committing-action boundary is identified, marked, checked, confirmed, and enforced across all layers, composing with the future governance engines.

**Why.** A single gap at any seam could let a committing action escape approval. Threading the same marker and gate discipline through every layer closes those gaps end to end.

## D-9 — Phase 7 stops at the readiness verdict; execution is a separate domain

**Decision.** Director Intelligence ends at a verified, decision-ready outcome and the Director's approval; execution is deliberately out of scope.

**Why.** Reasoning and execution are different concerns with different risks. A clean stop at the readiness verdict gives execution a well-defined starting interface and keeps the reasoning architecture free of execution logic.

---

Every decision is traceable to a Phase 7 design body and consistent with the platform lifecycle and the certified Phase 5–6 baseline. None has been reversed.
