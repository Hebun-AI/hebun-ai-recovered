# 04 — Capability vs Process

## Purpose

Establish, precisely, why a capability is **not** a process — why *what the company can do* is a different thing from *how it does it* — and why a capability is durable while a process is changeable.

## Core Concepts

### Capability = what; Process = how
A process is a procedure: an ordered way of performing work. A capability is an ability: a durable *can* of the enterprise. A capability says the company *is able to* do X; a process says *this is how* X is currently done. The ability is the end; the process is a means.

### One capability, many possible processes
A single capability can be realized by different processes over time — a manual procedure today, an automated one tomorrow, a redesigned one next year. Swapping the process does not change the capability; it changes only how the capability is exercised.

### Why process changes and capability does not
- **Process is optimization-facing.** Procedures are rewritten to be faster, cheaper, or better. That is normal and frequent.
- **Capability is identity-facing.** The ability is part of what the company *is*. It changes only when the company gains or loses an ability — rare and deliberate.
- If the ability itself changed every time a procedure was improved, "what the company can do" would be unstable — which is false. The capability must be the invariant beneath the changing process.

### Why this separation matters
Binding a capability to a process would freeze the process: you could not improve *how* without appearing to change *what*. Keeping them separate lets processes evolve freely while the ability stays a stable fact — and lets the enterprise reason about *what it can do* without wading into *how* ([enterprise thinking](06-enterprise-thinking.md)).

## Architecture

- **Capability node** — the durable ability.
- **Realization surface** — the point at which some process (defined in a later phase) realizes the capability. The process attaches to the capability; the capability does not embed the process.
- **Process independence** — replacing the realizing process leaves the capability node unchanged.

This phase defines the capability side only. Process is a later layer; it is named here solely to draw the boundary.

## Enterprise Examples

*Illustrative only — not a catalog, and no workflow.*

- The enterprise's ability to do X persists while the *procedure* for X is rewritten from manual to automated: same capability, new process.
- Two different procedures could each realize the same capability — evidence the capability is not identical to any one process.

## Design Principles

- **Never define a capability by its process.** No procedure steps in a capability definition.
- **Let process change freely.** The capability is the invariant; the process is the variable.
- **Test with a rewrite.** If rewriting the procedure would change the capability's definition, the definition is wrong.

## Boundaries

- Distinguishes the two concepts; defines **no process and no capability.**
- Writes **no workflow** and describes **no execution.**

## Future Evolution

Later phases define the process layer and its realization link to capabilities — how a changeable *how* attaches to a durable *what* — while keeping the capability process-independent. Processes will come and go; the capabilities they realize will endure.
