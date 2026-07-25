# 04 — Traversal Patterns

Traversal follows edges from a starting node to reach related nodes. It is read-only and deterministic: the same start, direction, and edge filter always yield the same result (see [06 — Design Principles](06-design-principles.md)).

This document records common, reusable traversals. Each is described by its start node, the edge sequence it follows, and the question it answers. Notation: `Node --edge--> Node`.

---

## People discovery

**Question.** Who are the people under an organization?

```
Organization
  --contains-->      OrganizationalUnit        (departments)
  --parent_of-->     OrganizationalUnit        (teams, recursive)
  <--member_of--     Person                    (people)
```

**Notes.** Descends the structure hierarchy, then resolves participants. The recursive `parent_of` step expands nested units to arbitrary depth; because nesting is acyclic, the traversal terminates. Filtering the final step to `Actor` instead of `Person` includes AI agents and service accounts.

---

## Capability accountability

**Question.** Who is accountable for, and who supports, a capability?

```
Capability
  <--owns--            Organization             (owner)
  <--responsible_for-- Role                     (accountable role)
  <--plays--           Actor                    (who fills that role)
  <--supports--        AIAgent                  (supporting agents)
```

**Notes.** Combines ownership, accountability, and support in one path. The owner is authoritative and singular; responsible roles and supporting agents may be many. This is the backbone of "who do we talk to about X."

---

## Customer engagement

**Question.** Who serves a customer, and through what work?

```
Party (customer)
  --PartyRole(CUSTOMER)--> Organization         (active customer relationship)
  --contains-->            OrganizationalUnit    (account team)
  <--member_of--           Actor                 (account team members)
  --supports-->            Workflow              (active workflows, future)
```

**Notes.** Enters from an external Party through its active PartyRole, then descends into the serving structure. The PartyRole's effective period scopes the traversal to *current* engagement — expired roles are excluded by an active-status filter.

---

## Department capacity

**Question.** What can a department do, and with what agents?

```
OrganizationalUnit (department)
  --contains-->        Role                      (functions in the department)
  --has_capability-->  Capability                (department capabilities)
  <--supports--        AIAgent                   (agents backing them)
```

**Notes.** Aggregates capability through the department's roles, then finds the AI agents that support those capabilities. Answers coverage and automation questions: what the department is equipped to do and how much is agent-assisted.

---

## Reporting line

**Question.** What is the accountability chain above a node?

```
Role
  --reports_to-->  Role                          (recursive, upward)
```

**Notes.** A single recursive edge walked upward. Deterministic and terminating because reporting lines are acyclic by principle. Symmetrically, walking `parent_of` upward from an OrganizationalUnit gives the structural chain.

---

## Dependency closure

**Question.** What does a capability rely on to function?

```
Capability
  --depends_on-->  Capability                    (recursive, transitive)
  --uses-->        Tool                          (external tools, future)
  <--supports--    AIAgent                       (enabling agents)
```

**Notes.** The forward dependency traversal underlying [05 — Impact Analysis](05-impact-analysis.md). Recursion over `depends_on` builds the transitive dependency set; cycle detection is required and any cycle is flagged, since dependency cycles are unintentional by principle.

---

## Traversal contract

Every documented traversal shares the same guarantees:

- **Read-only.** Traversal never mutates a node or edge.
- **Workspace-bounded.** No traversal crosses a workspace boundary.
- **Deterministic.** Fixed start, direction, and edge filter yield a fixed result.
- **Terminating.** Recursive traversals run over acyclic edge sets, or apply cycle detection where a cycle is possible.

These are design guarantees. The mechanism that provides them — query, in-memory walk, or otherwise — is an implementation decision deferred past the Director gate.
