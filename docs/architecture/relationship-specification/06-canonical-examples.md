# 06 — Canonical Examples

Worked examples showing how the relationship vocabulary composes into real organizational shapes. Each illustrates relationship usage; none prescribes implementation. Notation: `Source --relationship--> Target`. All nodes in each example share one Workspace.

---

## Example A — Small Company

A lean company: one organization, two departments, a handful of people.

```
Workspace
  --contains-->  Organization "Acme Foods"

Organization "Acme Foods"
  --contains-->  OrganizationalUnit "Operations"
  --contains-->  OrganizationalUnit "Sales"
  --owns-->      Capability "Fulfil Order"
  --owns-->      Responsibility "Food Safety Compliance"

OrganizationalUnit "Operations"
  --contains-->  Role "Operations Lead"
Role "Operations Lead"
  <--plays--     Person "Dilek"
  --responsible_for--> Responsibility "Food Safety Compliance"
  --has_capability-->  Capability "Fulfil Order"

OrganizationalUnit "Sales" --reports_to--> OrganizationalUnit "Operations"
```

**What it shows.** The minimal spine: workspace → organization → units → roles → people, with one owned capability and one owned responsibility. Ownership sits on the Organization; accountability flows through the role a person plays.

---

## Example B — Enterprise

A large organization: nested structure, matrixed reporting, an external customer.

```
Organization "Globex"
  --contains-->  OrganizationalUnit "Finance Division"
  --owns-->      Capability "Approve Purchase"

OrganizationalUnit "Finance Division"
  --parent_of--> OrganizationalUnit "Procurement Team"
  --parent_of--> OrganizationalUnit "Treasury Team"

OrganizationalUnit "Procurement Team"
  --contains-->  Role "Buyer"
Role "Buyer"
  --has_capability--> Capability "Approve Purchase"
  --reports_to-->     Role "Finance Director"
  <--plays--          Person "Mert"

Policy "Spending Limit" --governs--> Capability "Approve Purchase"

Party "MegaRetail" --represents (PartyRole CUSTOMER)--> Organization "Globex"
OrganizationalUnit "Key Accounts" --collaborates_with--> OrganizationalUnit "Procurement Team"
```

**What it shows.** Deep structural nesting (`parent_of`), a reporting line that crosses teams (`reports_to`), governance over a capability (`governs`), an external customer bound only through a PartyRole, and peer collaboration between units. Ownership stays singular on the Organization even as usage fans out.

---

## Example C — Consulting Organization

A firm organized around engagements and shared expertise.

```
Organization "NorthBridge Consulting"
  --contains-->  OrganizationalUnit "Advisory"
  --contains-->  OrganizationalUnit "Shared Expertise"
  --owns-->      Capability "AI Maturity Assessment"

OrganizationalUnit "Shared Expertise"
  --provides-->  Capability "AI Maturity Assessment" (to) OrganizationalUnit "Advisory"

OrganizationalUnit "Advisory"
  --contains-->  Role "Engagement Lead"
Role "Engagement Lead"
  --responsible_for--> Responsibility "Client Delivery"
  <--plays--           Person "Aylin"
  --manages-->         OrganizationalUnit "Advisory"

Party "ClientCo" --represents (PartyRole CUSTOMER)--> Organization "NorthBridge Consulting"
```

**What it shows.** A capability owned centrally but **provided** across units (`provides`), a role that both bears a responsibility and **manages** its unit (`manages` distinct from `owns`), and an external client through PartyRole. Ownership, provision, and management are three separate, coexisting facts.

---

## Example D — AI-first Company

An organization where AI agents are first-class participants alongside people.

```
Organization "Lumen AI"
  --contains-->  OrganizationalUnit "Automation"
  --owns-->      Capability "Draft Contract"

OrganizationalUnit "Automation"
  --contains-->  Role "Contract Analyst"
Role "Contract Analyst"
  <--plays--          AIAgent "ClauseBot"
  --responsible_for-->Responsibility "Contract Accuracy"

AIAgent "ClauseBot"
  --has_capability--> Capability "Draft Contract"
  --supports-->       Capability "Draft Contract"
  --uses-->           Tool "Document Store"
  --depends_on-->     AIAgent "RetrievalBot"

Capability "Draft Contract" --depends_on--> Capability "Clause Retrieval"
```

**What it shows.** An AIAgent treated uniformly through the Actor abstraction — it `plays` a role and is `responsible_for` a duty exactly as a Person would be. Agent-specific wiring (`uses` a tool, `depends_on` another agent) and capability dependency coexist. The organization still `owns` the capability; the agent only `supports` and `has` it.

---

## What the examples establish

- **Ownership is always singular and always on the Organization** — across small, enterprise, consulting, and AI-first shapes, `owns` never migrates to a role, unit, or agent.
- **People and agents are interchangeable at the participation layer** — `plays`, `responsible_for`, and `has_capability` apply identically through the Actor abstraction.
- **External parties enter only through PartyRole** — no example places a Party inside the internal hierarchy.
- **Distinct facts stay distinct** — ownership, provision, management, support, and dependency appear side by side without collapsing into one another.

These are illustrations of the specification, not templates to implement. Storage, services, and validation of such graphs are out of scope and behind the Director gate.
