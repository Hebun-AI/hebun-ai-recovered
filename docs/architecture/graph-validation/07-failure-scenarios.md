# 07 — Failure Scenarios

Concrete examples of invalid graphs. Each shows the violation, why it is invalid, and the expected **architectural response**. The response is always rejection at the validation layer — never runtime recovery. A graph does not "heal" at runtime; it is either valid before runtime reads it, or it is refused.

---

## Department without Organization

**Scenario.** An OrganizationalUnit exists with no path up to a root Organization.

**Why invalid.** Violates the root-Organization anchoring rule ([integrity rule 4](02-integrity-rules.md)) and produces a floating structural subtree. The department has no operating context; traversals have no anchor.

**Expected response.** Rejected as invalid. The graph is not admitted until the department is anchored to an Organization. No runtime constructs a placeholder parent.

## Capability without Owner

**Scenario.** A Capability node has no `owns` edge into it.

**Why invalid.** Violates required ownership ([integrity rule 6](02-integrity-rules.md), [governance: capability ownership](06-governance-validation.md)). The capability is unaccountable — impact analysis cannot answer who owns it.

**Expected response.** Rejected. Ownership must be supplied before the graph is valid. Runtime does not assign a default owner.

## Agent without Responsibility

**Scenario.** An AIAgent participates in the graph but is accountable for nothing — no responsibility, no clear role duty.

**Why invalid.** An actor that acts but is answerable for nothing is an accountability gap ([governance: executive accountability](06-governance-validation.md)). Where the model requires participation to carry accountability, this is invalid.

**Expected response.** Rejected where accountability is required. The agent must be tied to a responsibility or a role that carries one. Runtime does not fabricate accountability.

## Circular ownership

**Scenario.** Ownership forms a loop — A owns B, B owns A (directly or transitively).

**Why invalid.** Ownership is a directed, acyclic, single-source relationship. A cycle makes ownership self-referential and accountability circular — no ultimate owner exists.

**Expected response.** Rejected with the cycle surfaced. The loop must be broken to a single directed ownership chain. Runtime never resolves the cycle by choosing arbitrarily.

## Duplicate executive

**Scenario.** A singular executive role is filled by two actors at once, or a node requiring one owner has two.

**Why invalid.** Violates multiplicity — a singular relationship with two edges into the target ([relationship validation: multiplicity](04-relationship-validation.md)). Accountability becomes ambiguous.

**Expected response.** Rejected. The duplicate must be resolved to a single occupant or owner, possibly via effective periods that make only one active. Runtime does not pick a winner.

## Broken reporting chain

**Scenario.** A role reports to a superior role that has been retired, leaving the reporting edge pointing at a non-existent node.

**Why invalid.** A dangling reference ([integrity rule 2](02-integrity-rules.md)) and a broken chain ([hierarchy validation](03-hierarchy-validation.md)). Upward traversal steps into a void.

**Expected response.** Rejected. The reporting edge must be repointed or removed as part of retiring the superior. Runtime does not skip the missing link.

## Cross-workspace ownership

**Scenario.** An `owns` edge connects an owner in one workspace to an owned node in another.

**Why invalid.** Crosses the highest security boundary ([workspace boundaries](05-workspace-boundaries.md), [integrity rule 7](02-integrity-rules.md)). It is a tenant leak, the most severe class of failure.

**Expected response.** Rejected unconditionally. No convenience or exception admits it absent an explicit, governed federation contract. Runtime never bridges the tenants.

---

## The architectural response, in general

- **Rejection, not recovery.** An invalid graph is refused at the validation layer. Runtime consumes only validated graphs, so runtime never encounters — and never repairs — these failures.
- **Surfaced, not silent.** A violation is reported with enough context to locate it. Invalid graphs fail loudly.
- **Corrected upstream.** The fix happens where the graph is authored, before validation passes — not by runtime improvising a patch.
- **No defaulting.** Validation never invents an owner, a parent, or an accountability to make an invalid graph pass. It reports; authorship corrects.
