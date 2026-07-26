# 07 — Decision Log

The major architectural decisions made across Phase 8, with rationale. Permanent records — a superseded decision is recorded and replaced, never rewritten.

---

## D-1 — Execution is separate from reasoning

**Decision.** Execution (Phase 8) is a distinct domain, downstream of Director Intelligence (Phase 7), that performs approved work and nothing else.

**Why.** Thinking and acting are different concerns with different risks. Keeping execution separate — beginning only after Director approval, a validated decision, and verified readiness — is what makes acting on reasoning safe.

## D-2 — Execution performs faithfully; it never decides

**Decision.** Every execution layer carries out the approved plan exactly, forming no judgment and redesigning nothing.

**Why.** Faithfulness is the safe standard for the acting domain: do exactly what was approved. A layer that both decided and executed could act beyond approval; keeping execution non-deciding forecloses that.

## D-3 — Orchestration coordinates; it never executes

**Decision.** Multi-agent orchestration (8B) distributes and coordinates agents but performs no work itself.

**Why.** A coordinator that also executed would hold authority over the agents and blur the separation. A pure coordinator keeps the agents' roles clean and treats them uniformly.

## D-4 — The agent is a contract, not a concrete agent

**Decision.** Phase 8C defines the shared contract every execution agent obeys, not any specific agent.

**Why.** A shared contract lets a diverse fleet of concrete agents (designed later) all fit one frame, and lets orchestration coordinate them uniformly. Defining the contract before the concretes is what makes multi-agent execution coherent.

## D-5 — The tool is a bounded, contracted operation

**Decision.** Phase 8D defines the tool as a single bounded operation with a shared contract — invoked, performed, returned — with no concrete tool, MCP, or API defined.

**Why.** A tool is where an operation reaches the world; keeping it simple, bounded, and contracted is what lets individual effects be trusted and governed precisely, and lets many agents reuse the same tool.

## D-6 — Governance is enforced at the point of the operation

**Decision.** The committing-action gate reaches its final enforcement at the tool operation itself (8D), carried down the whole stack.

**Why.** The operation is where an effect actually happens. Enforcing the gate there — the last point before the world — closes the boundary end to end, so no committing effect escapes approval at any seam.

## D-7 — State and context are a separate continuity layer

**Decision.** Execution state and context (8E) are modeled as a distinct layer beneath 8A–8D, defining continuity without binding to storage.

**Why.** Long-running execution needs to pause, resume, checkpoint, and recover; that continuity is a distinct concern from performing work. Separating it lets execution, agents, and tools stay simple while continuity is handled uniformly beneath them.

## D-8 — State is distinct from memory

**Decision.** Execution state (live continuity of a running execution) is kept distinct from organizational memory (the durable account of finished executions).

**Why.** They are different concerns — one dynamic and live, one durable and past. State feeds memory; conflating them would make state a datastore and memory a volatile cache. Keeping them separate keeps both clean.

## D-9 — Approval propagates faithfully down the whole stack

**Decision.** The Director's approval, and the marked committing actions within it, propagate unaltered from Phase 7 down through execution, orchestration, agents, tools, and is preserved by state across interruption and recovery.

**Why.** A single point where approval was weakened or dropped could let a committing action escape the gate. Threading faithful approval propagation through every layer closes those gaps end to end.

---

Every decision is traceable to a Phase 8 design body and consistent with the Phase 7 architecture and the certified Phase 5–6 baseline. None has been reversed.
