# 13 — Capability Stability

## Purpose

Establish why the taxonomy — and the capabilities within it — are **stable and long-lived**, changing slowly and deliberately while organization, process, and agents churn beneath. Stability is what makes the taxonomy a dependable base for enterprise reasoning and long-term growth.

## Core Concepts

### The taxonomy is a slow-changing structure
Capabilities are long-lived by nature ([capability principles](02-capability-principles.md)); the taxonomy that organizes them is therefore also slow-changing. Domains, capabilities, and sub-capabilities are meant to endure across many reorganizations, process rewrites, and agent generations. The taxonomy is closer to the company's identity than to its implementation.

### What changes fast vs slow
- **Fast (below the taxonomy):** processes are rewritten, agents are swapped, organizational units reorganize. This is normal, frequent churn.
- **Slow (the taxonomy):** the set of domains and capabilities changes only when the enterprise genuinely gains or loses an ability, or restructures its understanding of its own abilities — rare and deliberate.

Because the taxonomy sits above all the fast-changing layers and is independent of them ([03](03-capability-vs-department.md), [04](04-capability-vs-process.md), [05](05-capability-vs-agent.md)), it is insulated from their churn.

### Why stability matters
- **Reasoning needs a stable base.** Enterprise Intelligence reasons over the capability model ([enterprise thinking](06-enterprise-thinking.md)); if that model shifted constantly, reasoning would have no firm ground.
- **Growth needs a stable frame.** New capabilities attach into a stable taxonomy without reshaping it ([taxonomy design principles](14-taxonomy-design-principles.md)); an unstable frame would force constant re-classification.
- **Comparison over time needs stability.** Tracking an ability's health across years requires the ability to keep its place in the taxonomy across that time.

### Stability is not rigidity
Stable does not mean frozen. The taxonomy *can* change — but changes are deliberate, governed, and rare, reflecting real shifts in what the enterprise can do, not routine churn. Additive growth (new nodes) is expected; restructuring is deliberate ([taxonomy design principles](14-taxonomy-design-principles.md)).

## Architecture

- **Stability gradient** — taxonomy (slow) sits above realization (fast); independence insulates it.
- **Change classes** — additive (new nodes, routine) vs structural (re-classification, deliberate and rare).
- **Anchoring** — nodes keep their identity and place over time, enabling longitudinal reasoning.

## Enterprise Examples

*Illustrative of stability only — not a catalog.*

- An ability keeps its place in the taxonomy for years while its process is rewritten repeatedly and its agents are replaced several times — the fast layers churn; the taxonomy node holds.
- A genuine new ability is a deliberate additive change to the taxonomy — not a routine one.

## Design Principles

- **Taxonomy changes slowly and deliberately.** Never at the speed of process or agents.
- **Prefer additive growth.** Restructuring is rare and governed.
- **Stable, not rigid.** Real ability shifts are honored; churn is not.

## Boundaries

- Explains **stability**; defines no capability, domain, or catalog.
- No process, agent, workflow, code, prompt, UI, or execution.

## Future Evolution

Later phases maintain the taxonomy under this stability discipline — growing it additively, restructuring only deliberately, keeping node identity across time. The stability principle fixed here is what lets the taxonomy serve long-term enterprise reasoning.
