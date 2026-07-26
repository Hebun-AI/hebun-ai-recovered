# 03 — Reasoning Boundaries

Director Reasoning is powerful precisely because it is bounded. It **reasons only** — it forms judgment and stops there. This document draws the line between what reasoning does and what it must never do. The boundary is what makes reasoning safe to trust.

## Director Reasoning does NOT

### Execute
Reasoning never carries out an action. It concludes *what should be done*; it does not *do* it. Execution belongs to runtime and orchestration layers, invoked only under the Director's authority. A reasoning component that acted would have crossed out of reasoning entirely.

### Publish
Reasoning never releases anything to the outside world. It may recommend *that* something be published and prepare the case for it, but the act of publishing is outward-facing and gated to the Director ([05 — Director Authority](05-director-authority.md)).

### Spend
Reasoning never commits money. It can evaluate a cost, forecast a return, and recommend a spend — but the financial commitment itself is never reasoning's to make.

### Deploy
Reasoning never puts anything live. It can plan a deployment and judge its readiness; making it real is an execution act outside reasoning's boundary.

### Modify memory
Reasoning **reads** memory; it never rewrites it. This is critical: reasoning consumes the organizational past as evidence, but the past is immutable ([Phase 6 never-rewrite](../memory/04-memory-principles.md)). Reasoning drawing a conclusion does not change what happened. *(Reasoning's conclusions may later be recorded as new, attributed AI-generated memories through a separate, gated act — that is creating new memory, additively, not reasoning editing the record.)*

## It reasons only

Everything reasoning produces is **advisory**: a judgment, a recommendation, a decision-as-conclusion, a plan. None of it reaches out, commits, or alters state. Reasoning's entire output is understanding handed to the Director. What the Director does with it — approve, decline, defer — is a separate act under the Director's authority.

```
Knowledge layers  ──read──►  Director Reasoning  ──produces──►  judgment (advisory)
                                     │
                                     ✗ does not: execute · publish · spend · deploy · modify memory
```

## Why the boundary is absolute

- **Trust.** A reasoning layer the organization can rely on is one that *cannot* act on its own conclusions. Advice you can trust is advice that isn't secretly also an action.
- **Authority.** Keeping reasoning advisory is what keeps final authority with the Director ([05](05-director-authority.md)). If reasoning could execute, it would hold authority it was never granted.
- **Reversibility.** Reasoning is fully reversible — a judgment can be reconsidered, a recommendation declined, with no consequence in the world. That reversibility exists only because reasoning never acts.
- **Separation of concerns.** Reasoning reasons; execution executes; memory records. Each stays clean because none does another's job. Blurring them would corrupt all three.

## The boundary and preparation

Reasoning may go right up to the edge of action — fully working out *what* to do, *how*, and *why*, and preparing the recommendation completely. That is still reasoning. The boundary falls at the single step of *making it real*, which is never reasoning's and always the Director's. Maximal preparation, zero autonomous action.
