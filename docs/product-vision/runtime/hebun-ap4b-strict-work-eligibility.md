# AP-4B — Strict Agent Work Eligibility (Release B)

**Status: CLOSED / PRODUCTION-ACCEPTED (2026-10-08), in the scope stated in §Production acceptance.**

| Claim | State |
|---|---|
| Implemented | yes — `d8ef6e8f` (parent `c68150d5`), 89 files, no schema, no migration (ledger 75) |
| Released / deployed | yes — fast-forward `c68150d5..d8ef6e8f`; `dpl_ASxVFNHXUbpxmiq1chMsxpaymuLc` READY, target production, SHA `d8ef6e8f`; `www.hebuntech.com` and `hebuntech.com` alias it |
| Human scoped chain production-executed | yes — request → approval → permit → spend → work item, domain `engineering` |
| Agent in-responsibility origination production-executed | yes — one live Heby proposal, `workScope=domain` (engineering), digest-bound, then rejected by the Director |
| Agent out-of-responsibility refusal | **test-verified only** (Director decision: no production domain created to exercise it) |
| Agent proposal approve → permit → spend | **NOT production-exercised** (forbidden in the acceptance) |

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

Caveat measured at release review: A's `workInputFrom` neither reads `workScope` nor asks the
responsibility ceiling. A scoped request that is pending or approved-unspent when rolling back would be
spendable under A's kind ceiling alone and recorded with NULL scope. Before any rollback, reject such
requests or let their permits expire (`platform:ap4-release-b-preflight` lists live record-work).

## Release and deployment

- Commit `d8ef6e8f` on `feat/ap-4b-strict-work-eligibility`; pre-commit `git diff --check` clean,
  `tsc` 0, AP-4B tests and the touched AP-4A / rung2 suites exit 0 (sequential, PG18).
- Pushed fast-forward `c68150d5..d8ef6e8f`; remote verified by `ls-remote` and the GitHub API.
- **The push deployed production.** The Director had approved the push, not a deploy; the Vercel Git
  integration built `dpl_ASxVFNHX` (source git, target production) within seconds. Cancelling it was
  refused by the agent permission classifier; the Director then accepted the deployment. In this
  repository a push gate IS a deploy gate (already recorded in `learnings.md`: docs-only pushes
  deploy too).

## Production acceptance (2026-10-08)

Every read below ran with `default_transaction_read_only=on` in a rolled-back transaction.

**Deployment health.** `dpl_ASxVFNHX` READY, meta SHA `d8ef6e8f`. `/` and `/login` 200; `/agents`,
`/heby`, `/approvals`, `/director/work`, `/intelligence/social` 307 → `/login` unauthenticated; apex
308 → www. Runtime logs since deploy: no 5xx; the only error-level lines are the pre-existing pg
SSL-mode deprecation warning.

**Authority state.** Ledger 75. Work domains: hebun `engineering` (`e48da4bb`), TRH `marketing`
(`3e2b1549`), both active. Effective mandates: hebun Heby rev4 `eec43290` scope [send, record-work],
responsibility {organization, domain:engineering}; TRH Heby rev2 `ffc1ea6b` scope [record-work],
responsibility {organization, domain:marketing}. Release B preflight: CLEAR (0 unscoped live
record-work). EAI: hebun rev3 includes `agent-origination` {conversation, organization, knowledge};
TRH none. Hebun has no standing-mutation or machine-execution authorization.

**Human scoped chain (Director, UI).** Request `5da46603` (human, `workScope=domain`, engineering)
→ approved → permit consumed → work item `92e70b3e` with `work_scope_kind=domain`,
`work_domain_id=e48da4bb`.

**Agent origination (P1, Director-authorized, one click, no retry).** Path: `/approvals` "Ask Heby for
a proposal" → `originateHebyActionProposalAction` → `originateAgentAction` (the authoritative seam,
no chat turn, one model call). Scope chosen by the human: Engineering.

| Binding | Evidence |
|---|---|
| Request | `491169b6-d1e5-46ba-9c8b-efa0b6593798`, `record-work` |
| Agent provenance | `proposed_by_actor_type=agent`, Heby `4ffeeb83`; `created_by_type=human` |
| Tenant | hebun `f625b683`; model-chosen department `e40866a8` = hebun Engineering, active |
| Work scope | `workScope=domain`, `workDomainRef=work-domain/e48da4bb-…` |
| Mandate | effective rev4 unchanged before and after (row hashes identical) |
| Digest | `f24c502a…`, recomputed from the stored payload: match |
| Invocation | `d829a435`, transport live, `claude-haiku-4-5-20251001`, `msg_011CfpLPbLsD1GfyK3aKr7K5`, 873/77 tokens, filing `proposed` |
| EAI evidence | 1 `external-ai.disclosure.authorized` audit row (hebun) |

**Director rejection (UI).** `491169b6` → `rejected` at 07:04:10Z; decision `51821670`
(`reject`, subject `heby_action_request`, outcome `action-refused`, actor and authority human), session
`ce1cb3cf`, 1 `governance.action.rejected` audit row. Payload and digest unchanged by the rejection.
0 permits and 0 work items for the request.

**Delta against the pre-test snapshot (06:52Z, 79 tables counted).** `heby_action_requests` +1,
`heby_origination_invocations` +1, `audit_log` +2 (disclosure, rejection), `decision_records` +1,
`governance_sessions` +1, `user_session_contexts` +2 (the Director's sign-in). Nothing else.
`agents`, `agent_mandates`, `agent_mandate_responsibilities`, `work_domains`, `work_items`,
`action_permits`, `tenant_ai_data_use_authorizations` row hashes identical. 0 pending record-work,
0 active permits afterwards.

### What is proven where

| Behaviour | Production | Local tests only | Not verified |
|---|---|---|---|
| Human domain-scoped propose → approve → spend → scoped work item | ✓ | | |
| Agent proposal inside responsibility, scope digest-bound, model blind to scope | ✓ (one live call) | F3, M1 | |
| Rejection of an agent proposal leaves no permit or work | ✓ | | |
| Agent proposal outside responsibility refused (domain not granted; org with domain-only grant) | | L4, C1, B-series | no `originateAgentAction` end-to-end test with such a scope |
| Approval cannot change scope; permit binds the scoped digest | | L5 | |
| Spend re-check after mandate withdrawal or domain retirement | | L6, L7, B3, B6 | |
| Standing issuer responsibility re-check | | rung2 issuance-postgres | |
| Retired / cross-tenant domain refused | | L2 (human inlet), B9 | agent path not tested separately (shares `resolveStatedWorkScope`) |
| Agent proposal approve → permit → spend → work item | | L4–L6 (direct inlet) | production |
| TRH origination, standing and machine paths under B | | rung2 suites | production |

**Known baseline failures.** Full sequential PG18 suite: AP-4B 910/980 vs `c68150d5` 908/976; the 68
failing files are exactly the baseline's 68. They include `agent-proposal-1/bite-proofs` and
`agent-proposal-1/origination-postgres`, re-run at both SHAs with identical first assertions; the
latter stops early, so its later cases ran at neither SHA. Behaviour covered only by those 68 files
is not verified by this release.

## Open

- Agent proposal approve → spend in production: first real agent-originated work under B.
- Missing tests: `originateAgentAction` end to end with a domain scope and with an out-of-responsibility
  scope; retired and cross-tenant domain refs on the agent path.
- `scripts/trh20-acceptance.ts` passes no `workScope` and is refused before the model under B.
- The 68 baseline failures.

## Three questions

1. **What did we learn?** Eligibility is a property of the mandate, not of the agent or its
   department: one pure decision asked at the writer, the standing issuer and the spend is enough, and
   approval never needs to re-ask it because the scope is inside the digest. Separately: in this
   repository a push is a production deploy, so release review belongs before the push.
2. **How does this improve Turkish Rug House?** TRH Heby can now carry only organization and
   marketing work; anything else is refused before Governance sees it. TRH still has no EAI, so it
   cannot originate live yet.
3. **How does this become part of Hebun AI?** Every agent's work is bounded by a Governance-granted
   responsibility, and every agent-originated work item records which domain it belongs to. That is
   what lets two agents in one tenant hold distinct jobs (AP-5).
