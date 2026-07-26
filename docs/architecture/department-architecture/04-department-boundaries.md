# 04 — Department Boundaries

## Purpose

Department Boundaries define **what a department does not do** and **the limits of its authority**. A department is a bounded unit: it owns one domain, holds a bounded delegated authority, and refuses everything outside both. This document draws those lines so a department never absorbs another domain, another department's responsibility, or the concerns of reasoning and execution.

## Architectural role

Where the principles ([01](01-department-principles.md)) state what a department must obey and responsibilities ([03](03-department-responsibilities.md)) state what it owns, the boundaries state what it must refuse. Together they fence a department into its single domain and its delegated authority.

## Authority boundaries

### A department's authority is bounded by its delegation
A department may act only within the authority delegated to it, and that delegation is always revocable ([enterprise authority model](../enterprise-organization/04-authority-model.md)). A department never originates authority and never exceeds its grant. The boundary of a department's authority is exactly the boundary of what was delegated.

### A department's authority is bounded by its domain
A department's authority extends over its own domain and no further. It holds no authority in another department's domain. Domain and authority share a boundary — a department is authoritative precisely where it is accountable.

### Committing actions stay behind Director approval
A department's delegated authority lets it be *responsible* for outcomes that include committing actions, but the commitment itself rests on the Director's approval ([enterprise authority model](../enterprise-organization/04-authority-model.md)). A department never manufactures a committing authority the Director did not grant.

## What a department does not do

### It does not reason
A department holds no reasoning. When its domain needs thinking through, it routes to Director Intelligence ([reasoning](../director-reasoning/README.md)); it never reasons in that domain's place.

### It does not execute work
A department performs no tasks. When approved work in its domain must run, Execution runs it ([execution](../director-execution/README.md)); the department only owns the outcome and answers for it.

### It does not plan or re-plan
A department produces no plans and alters none. Planning is Director Intelligence's job ([planning](../director-planning/README.md)). The department frames which domain owns the result — never the plan.

### It does not decide on behalf of the enterprise
A department makes no decisions in place of Director Intelligence under Director Authority ([decision](../director-decision/README.md)). It owns which domain a decision's outcome belongs to, not the decision.

### It does not cross into another domain
A department never owns, acts in, or claims authority over another department's domain. Cross-domain work happens through coordination ([department coordination](05-department-coordination.md)), with each department's boundary preserved.

### It does not define its own occupants
A department names no concrete manager agent, specialist agent, or human role. It defines the internal seats; who fills them is a later phase behind the Director gate ([department model](02-department-model.md)).

## Inputs

- The **department principles** ([01](01-department-principles.md)), **model** ([02](02-department-model.md)), and **responsibilities** ([03](03-department-responsibilities.md)) — the frame these boundaries protect.

## Outputs

- A **clear negative space and authority limit** — what a department refuses and how far its authority reaches — that keeps domains, reasoning, and execution sovereign.

## Boundaries

- This document **adds no capability** — it removes ambiguity about what a department is not and how far it may reach.
- It **describes no runtime or mechanism** — only the limits of a department.

## Future direction

As concrete departments and their agents are defined, these boundaries hold unchanged. Occupants gain the ability to act *within* the department's domain and delegated authority — never the right to reason, execute, plan, decide, cross domains, or exceed the grant. A department stays a bounded domain owner, forever.
