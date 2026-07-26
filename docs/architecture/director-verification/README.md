# Director Verification & Self-Critique — Architecture (Phase 7F)

## Purpose

**Director Verification** is the independent layer that critically evaluates the outputs of Reasoning, Planning, and Decision **before any execution may be considered**. Phase 7A defined *why* the Director reasons; 7B *how* the Director thinks; 7C the mechanisms; 7D how reasoning becomes plans; 7E how validated plans become governance-aligned decisions. Phase 7F defines the **verification and self-critique layer** — the step that steps back, checks the whole chain for contradictions, missing evidence, and inconsistency, verifies organizational alignment, and determines whether the outcome is genuinely ready for the Director to consider for execution.

It is **architecture only**. No algorithms, no prompts, no runtime, no execution. It describes *how verification is structured*, not the machinery that verifies or executes.

## Relationship with Phases 7A–7E

- **Phase 7A — Reasoning Philosophy.** Verification enforces the reasoning principles ([first principles](../director-reasoning/02-first-principles.md)) — it is where *evidence before conclusion*, *explicit uncertainty*, and *explainability* are independently checked, not merely trusted.
- **Phase 7B — Cognitive Lifecycle.** Reasoning's lifecycle self-checks at each stage transition; verification is the *independent, after-the-fact* review of the whole cycle's output.
- **Phase 7C — Reasoning Mechanisms.** Verification reuses the mechanism disciplines — evidence evaluation, uncertainty handling — but turned *inward*, on the reasoning's own product.
- **Phase 7D — Planning.** Planning validates a plan for internal soundness. Verification re-examines it in the context of the reasoning behind it and the decision over it — a second, independent pass.
- **Phase 7E — Decision.** Decision produces a decision-ready outcome. Verification is the independent critic that asks: *does this outcome actually hold up across everything that produced it?*

## Role of Verification inside Director Intelligence

```
Reasoning (7A–7C)  →  Planning (7D)  →  Decision (7E)  →  decision-ready outcome
                                                              │
                                                              ▼
                              Director Verification (7F)   ← this phase
                              (independent critique of the whole chain)
                                                              │  readiness verdict
                                                              ▼
                              Director approval  →  Execution (future, outside this phase)
```

Verification is the last checkpoint before the Director is asked to authorize execution. It does not add to the chain; it **audits** it. Where every prior layer *produced* something, verification *critiques* what was produced — independently, so errors that survived each producing layer are caught before they reach the Director as "ready."

## Why Verification is separate from Reasoning, Planning, Decision, and Execution

- **Independence is the point.** A layer that produced a result cannot fully check its own work — the same assumptions that caused an error would excuse it. Verification is deliberately *separate* so it critiques with fresh eyes, from outside the producing chain.
- **Separate from Reasoning, Planning, Decision.** Those layers *make* the judgment, the plan, the decision. Verification *reviews* all three together, looking for what any single layer, focused on its own job, might have missed — a contradiction between the plan and the reasoning, a gap between the decision and the evidence.
- **Separate from Execution.** Verification produces a readiness verdict; execution runs approved work. Keeping verification execution-free is what makes critiquing freely safe — it can find and report any flaw without consequence, because it never acts. If verification could execute, it would hold authority it was never granted.
- **It is read-only over the chain.** Verification examines the outputs of prior phases; it **never modifies** them. It reports what it finds; correction is sent back to the producing layer, and the Director decides. Verification audits; it does not rewrite.

## Documents

| Document | Topic |
|---|---|
| [01 — Verification Principles](01-verification-principles.md) | The principles verification obeys |
| [02 — Self-Critique](02-self-critique.md) | Turning critical evaluation inward on the chain's own output |
| [03 — Consistency Validation](03-consistency-validation.md) | Checking coherence across all prior phases |
| [04 — Risk Verification](04-risk-verification.md) | Independently re-checking the risk picture |
| [05 — Decision Assurance](05-decision-assurance.md) | Confirming the decision holds up |
| [06 — Final Readiness](06-final-readiness.md) | Determining execution readiness |
| [07 — Future Evolution](07-future-evolution.md) | How verification deepens |

Each document defines: **purpose, architectural role, inputs, outputs, boundaries, and future direction.**

## What Verification must always do

- **Consume reasoning, planning, and decision outputs** — the whole chain is its subject.
- **Identify contradictions and missing evidence** — the flaws that survived the producing layers.
- **Validate consistency across all previous phases** — that reasoning, plan, and decision cohere.
- **Verify organizational alignment** — that the outcome truly serves the organization.
- **Determine execution readiness** — a clear verdict, ready or not.
- **Preserve Director Authority** — it produces a verdict; the Director decides, committing actions stay gated.
- **Never execute work** — verification critiques; it does not act.
- **Never modify previous reasoning or decisions** — it audits read-only; correction goes back to the producing layer.

## Status

Architecture only — the verification architecture, not its implementation. Verification engines, contracts, and runtime — should they be built — follow the [Capability Lifecycle](../../architecture-backlog/00-capability-lifecycle.md) behind the Director gate. Nothing here is implemented.
