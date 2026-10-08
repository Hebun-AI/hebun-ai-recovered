# AP-4B — Strict Agent Work Eligibility (Release B)

Base: `c68150d5` (AP-4A + preflight lifecycle fix). No migration; ledger stays 75.

## What changes

An agent may propose and advance `record-work` only inside the responsibility its **effective** mandate
revision grants: an explicit organization-level grant for organization work, or a grant of that exact
**in-service** work domain for domain work. Organization-level covers no domain; a domain grant covers no
organization work. Zero grants = undeclared = admits nothing. `send` and every other kind are outside AP-4.

The **work scope is the human's input** on every path (Heby affordance, `/approvals` agent request,
`/director/work`, Social work request). The model never sees it and cannot return it.

## Authority boundaries (unchanged owners)

| Concern | Owner | AP-4B touch |
|---|---|---|
| Domain lifecycle | Work Domain Authority | read-only by the inlet, availability, four pages; Work Authority verifies an active domain inside the recording transaction |
| Responsibility | Agent Mandate Authority | the effective read now returns `responsibility` (with current `inService`) |
| Decision/authorization | Governance | unchanged; approval cannot change the scope (it is digest-bound) |
| Work record | Organizational Work Authority | writes `work_scope_kind` / `work_domain_id` once, at recording |
| Department / placement | Organization Authority | grants nothing; never read by the ceiling or the projection |

## The chain

```
human scope ──► inlet: resolve domain (this tenant, in service) ──► payload {workScope, workDomainRef}
            ──► writer: refuse unscoped record-work (everyone); agent: kind ceiling + responsibility
            ──► digest ──► approval (no scope input) ──► permit binds the scoped digest
            ──► standing issuer: responsibility re-check (agent)            ┐
            ──► spendPermit (human + machine): responsibility re-check     ├ fail closed, permit stays active
            ──► workInputFrom: strict scope parse ──► recordWorkCore: active-domain check, write columns ┘
```

The one decision is `refuseOutsideAgentResponsibility` in `action-authorization/agent-mandate-ceiling.ts`,
beside the kind ceiling. `listEligibleAgents` (`origination-availability/`) is a read-only projection
for the UI: identity-read order, no score, no default, no authorization; enforcers may not import it.

The direct human WORK-1 path (`recordWork`) stays unscoped (NULL/NULL = unknown). No backfill.
`establishAgentMandate` (five-value) is deleted; `/agents` writes through
`establishAgentMandateWithResponsibility` and shows each revision's responsibility.

## Verification

- `tests/ap4b-strict-work-eligibility/`: `scope-and-ceiling` (pure), `eligibility-postgres` (PG18,
  L1–L9), `firewall` (F1–F6), `bite-proofs` (13/13 mutations bite).
- `rung2-standing-mutation/issuance-postgres`: issuer refuses a request outside responsibility.
- Release B preflight (`platform:ap4-release-b-preflight`) was CLEAR in production before this release.

## Rollback

Redeploy the previous production deployment (`c68150d5`). Schema is unchanged; scoped work rows written
by B stay valid history (A code ignores the columns).
