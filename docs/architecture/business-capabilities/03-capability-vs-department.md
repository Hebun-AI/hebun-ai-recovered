# 03 — Capability vs Department

## Purpose

Establish, precisely, why a capability is **not** a department — why *what the company can do* is a different thing from *who does it* — and why capabilities are defined independently of the organization.

## Core Concepts

### Capability = what; Department = who
A department is an organizational unit: a seat that owns responsibility and is accountable upward ([department-architecture](../department-architecture/README.md)). A capability is an ability: a durable *can* of the enterprise. One answers *who is accountable*; the other answers *what the company is able to do*. They are different kinds of thing.

### A department is accountable *for* capabilities — it is not a capability
An organizational unit can be made accountable for one or more capabilities. That is an *attachment*, not an *identity*: the capability exists as a defined ability, and a department is pointed at it. The capability is not "inside" the department; the department is made responsible for a capability that stands on its own.

### Why they are not the same thing
- **Different lifespans.** Departments reorganize; capabilities persist. The ability to do X survives the department that currently owns X being split, merged, or renamed.
- **Different cardinality.** One department may be accountable for several capabilities; one capability may be served across more than one unit over time. There is no fixed one-to-one identity.
- **Different definition.** A department is defined by its place in the hierarchy and its domain of responsibility. A capability is defined by the ability itself, with no hierarchy in its definition.

### Why capability is organization-independent
Because a capability is a fact about *what the enterprise can do*, it must not depend on the current org chart. If the definition of a capability referenced a department, then reorganizing would silently change what the company "can do" — which is false. Independence keeps the ability model true across reorganizations ([capability principles](02-capability-principles.md)).

## Architecture

- **Capability node** — the ability, defined independently.
- **Accountability attachment** — a link from an organizational unit to a capability it is accountable for. The link lives on the org side; the capability does not embed the unit.
- **Reorg invariance** — changing the attachment (who owns it) leaves the capability node unchanged.

The organization consumes the capability layer; the capability layer does not depend on the organization.

## Enterprise Examples

*Illustrative only — not a catalog.*

- A capability the enterprise has stays the same ability while the unit accountable for it is reorganized: same *what*, different *who*. The capability node is untouched; only the accountability attachment moves.
- Two units may, over the company's life, each be accountable for the same capability at different times — proof the capability is not identical to any one department.

## Design Principles

- **Never define a capability by its department.** No org name in a capability definition.
- **Attach ownership; don't embed it.** Accountability points at a capability; it is not part of it.
- **Test with a reorg.** If a reorg would change the capability's definition, the definition is wrong.

## Boundaries

- Distinguishes the two concepts; defines **no department and no capability.**
- Describes **no process or agent.**

## Future Evolution

Later phases define the accountability attachment precisely — how an organizational seat is made responsible for a capability — while keeping the capability itself organization-independent. The *who* attaches to the *what*; the *what* never depends on the *who*.
