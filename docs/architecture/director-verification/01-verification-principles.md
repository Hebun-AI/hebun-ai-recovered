# 01 — Verification Principles

## Purpose

The Verification Principles are the constitution of Director Verification — the commitments the verification layer must obey to be a trustworthy, independent critic. Where reasoning, planning, and decision principles govern *producing* judgment, plans, and decisions, these govern *critiquing* them. Any verification that violates one of these is not doing Director Verification.

## Architectural role

These principles constrain all the verification topics that follow (self-critique, consistency, risk, assurance, readiness). Every subsequent document inherits them first. They are what make verification independent, honest, read-only, and subordinate to the Director.

## The principles

### 1. Verification is independent
Verification critiques with fresh eyes, not the eyes that produced the work. It does not assume the reasoning, plan, or decision is correct because a prior layer said so — it checks. Independence is the whole reason the layer exists ([README](README.md)); a verification that trusted its inputs uncritically would verify nothing.

### 2. Verification is read-only over the chain
Verification **examines** the outputs of Reasoning, Planning, and Decision; it **never modifies** them. It reports what it finds; correction is sent back to the producing layer. A verifier that rewrote the work it checked would blur critic and author and destroy its independence.

### 3. Evidence and contradiction are surfaced, never suppressed
Verification names missing evidence, contradictions, and gaps plainly — especially inconvenient ones. Its value is in catching what the producing layers missed; a verification that softened its findings to let a result through would be worse than none ([truth over convenience](../director-reasoning/02-first-principles.md)).

### 4. Verification is honest about its own limits
Where verification cannot fully confirm something, it says so. It does not certify readiness it has not established, nor manufacture doubt it does not hold. Its verdict carries explicit confidence, exactly as reasoning's does ([explicit uncertainty](../director-reasoning/02-first-principles.md)).

### 5. Verification checks the whole, not just the parts
Each prior layer checked its own output; verification's distinct job is to check that the parts **cohere** — that the plan matches the reasoning, the decision matches the evidence, the whole serves the organization ([consistency validation](03-consistency-validation.md)). It looks for the flaws that live *between* layers, invisible to any one of them.

### 6. Verification preserves Director Authority
Verification produces a **readiness verdict**, not a decision to execute. The verdict informs the Director; the Director decides, and every committing action stays gated ([Director Authority](../director-reasoning/05-director-authority.md)). A "ready" verdict is an input to the Director's approval, never a substitute for it.

### 7. Verification never executes
Verification critiques and reports; it takes no action in the world. This is what makes thorough critique safe — it can probe for any flaw without consequence, because it never acts.

## Inputs

- The **outputs of Reasoning, Planning, and Decision** — the chain under review.
- The **principles, constraints, and organizational objectives** the chain was meant to satisfy.

## Outputs

- A **principled frame** every verification activity operates within — the standard verification holds itself and the chain to.

## Boundaries

- These principles **define no method** — they state what verification must obey, not how it is performed.
- They **authorize no action** — a verified outcome is still only a readiness verdict, awaiting the Director's approval to execute.

## Future direction

Future verification engines may satisfy these principles more thoroughly — critiquing more independently, catching subtler contradictions, calibrating readiness more precisely. The principles are fixed: independent, read-only, honest, whole-checking, authority-preserving, non-executing. Capability grows; the constitution holds.
