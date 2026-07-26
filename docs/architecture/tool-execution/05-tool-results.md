# 05 — Tool Results

## Purpose

Tool Results define **how a tool returns the outcome of its operation** — the response side of the agent↔tool contract. A tool operation produces an outcome; the result is how that outcome is handed back to the invoking agent, structured and honest, so the agent can use it and the execution stays accountable.

## Architectural role

Tool Results are the exit point of the [Tool Lifecycle](02-tool-lifecycle.md) — the structured return the agent receives after invoking a tool ([tool invocation](04-tool-invocation.md)). They feed the agent's continued execution ([Phase 8C](../execution-agents/README.md)) and the agent's reporting ([agent reporting](../execution-agents/06-agent-reporting.md)), which flows up to orchestration monitoring and organizational memory. Results define *what a tool returns*, not the mechanism.

## Result outcomes

A tool result honestly represents one of:

- **Success** — the operation was performed; the result carries its output.
- **Failure** — the operation could not be performed; the result carries the failure and enough context to understand it.
- **Partial completion** — the operation was performed in part; the result carries what was done and what was not.

Each outcome is represented plainly; none is dressed as another. A failure is returned as a failure, a partial as a partial — never as success.

## Structure

A tool result is **structured** — a defined, machine-usable shape the agent can act on, not an unstructured blob. Structure is what lets an agent use a result reliably: distinguish success from failure, extract output, detect partial completion, and report accurately. The result also carries what is needed for **traceability** — the record of the operation's outcome ([tool principles](01-tool-principles.md)).

## Inputs

- The **operation's outcome** — what actually happened when the tool performed its operation.

## Outputs

- A **structured result** — success, failure, or partial, with the relevant output or context.
- A **trace contribution** — the operation's outcome recorded as part of the execution trace.

## Boundaries

- Results are **honest** — the true outcome of the operation; no hidden failure, no overstated success, no fabricated output ([tool principles](01-tool-principles.md)).
- A tool **returns an outcome; it does not decide what happens next** — the agent (and the domains above) decide how to respond to a result. The tool reports what happened and stops ([tool boundaries](03-tool-boundaries.md)).
- Results **carry no coordination** — a result informs the invoking agent; it does not direct another agent or tool.
- They **define no method or format specifics** — this document establishes that structured results exist and their outcomes, not any concrete schema or protocol.

## Future direction

Future tools may return richer results — finer partial-completion detail, more informative failure context, deeper traces feeding learning ([Learning Engine](../../architecture-backlog/19-learning-engine.md)). The discipline is fixed: structured, honest results representing success, failure, or partial, that decide nothing about what comes next. Richness grows; the honest, structured, decide-nothing result holds.
