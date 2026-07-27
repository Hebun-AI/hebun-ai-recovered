# 15 — Capability Meta Model

## Purpose

Define the standard architectural data model every business capability must conform to — the common template shared by all capabilities. Phase 10A defined *what a capability is*; Phase 10B defined *how capabilities are organized*; Phase 10C defines *the uniform shape each capability node has*. This phase defines the template only; it instantiates no capability.

## Core Concepts

### A meta model is a template, not an instance
The Capability Meta Model is the **schema** every capability follows — the set of fields and rules that make any capability well-formed. It is not a capability and holds no capability data. It is the mold; the castings come later, behind the Director gate.

### Why a meta model is necessary
Phase 10B organized capabilities into a taxonomy, but a taxonomy of *inconsistently described* nodes is not reasoning-ready. For Enterprise Intelligence to reason over capabilities ([enterprise thinking](06-enterprise-thinking.md)), every capability must be described the **same way** — same fields, same meaning. The meta model is that standardization: one shape, so any capability is comparable, measurable, and governable like any other.

### The required fields (the standard shape)
Every capability node carries exactly these architectural fields:

| Field | Meaning | Document |
|---|---|---|
| **Identity** | Stable name + definition of the ability | [16](16-capability-identity.md) |
| **Purpose** | Why the ability exists (its intent) | [16](16-capability-identity.md) |
| **Business Value** | The value the ability provides | [17](17-capability-value-model.md) |
| **Inputs** | What the ability consumes (as ability, not process) | [18](18-capability-inputs-and-outputs.md) |
| **Outputs** | What the ability produces | [18](18-capability-inputs-and-outputs.md) |
| **Dependencies** | Capabilities it relies on | [19](19-capability-dependencies.md) |
| **Consumers** | Capabilities/parties that rely on it | [19](19-capability-dependencies.md) |
| **Health** | Whether the ability is present and strong | [20](20-capability-observability.md) |
| **Observability Surface** | How the ability is made assessable | [20](20-capability-observability.md) |
| **Governance Attachment** | How the ability falls under governance | [21](21-capability-governance.md) |
| **Director Visibility** | How the Director sees the ability | [21](21-capability-governance.md) |
| **Evolution Rules** | How the ability's definition may change | [22](22-meta-model-design-rules.md) |

### The meta model inherits all prior invariants
Every field is defined at the **ability** level — organization-, process-, and agent-independent ([capability principles](02-capability-principles.md)). No field names a department, a process, an agent, a workflow, or a KPI. Inputs/outputs/dependencies are abilities and ability-level relationships, never procedure steps.

## Architecture

- **Capability record** — one node conforming to the meta model, carrying all required fields.
- **Field definitions** — each field defined in its own document (16–21).
- **Conformance rules** — what makes a capability well-formed ([meta-model design rules](22-meta-model-design-rules.md)).
- **Taxonomy fit** — a conforming capability slots into the four-level taxonomy ([08](08-enterprise-capability-taxonomy.md)) as a Capability (or, at finer grain, a Sub-Capability).

## Enterprise Examples

*Illustrative of the template only — not a capability.*

- The meta model is the *form* every capability fills in: identity, purpose, value, inputs, outputs, dependencies, consumers, health, observability, governance, visibility, evolution. This phase defines the form; it fills in none of it — no Marketing/Sales/Finance/HR capability, no KPI.

## Design Principles

- **One shape for all capabilities.** Uniformity is what makes them comparable.
- **Every field at ability level.** No org, process, agent, workflow, or KPI in any field.
- **Template now, instances later.**

## Boundaries

- Defines the **meta model template**, not any capability, KPI, or catalog.
- No workflow, process, agent, code, UI, prompt, or execution.

## Future Evolution

Later phases instantiate the meta model — real capabilities filling every required field — and eventually attach realization (process, agents) and Enterprise Intelligence. This phase fixes the standard shape; the fields are detailed in documents 16–22.
