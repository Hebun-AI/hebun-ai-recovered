# WF-4 — Agent Continuing Authority at Permit Spend

**Status: CLOSED / PRODUCTION-ACCEPTED (Director, 2026-10-06).**
Release `89d062c6db8db8d3803dfca7514a5b443560e5f4` (`dpl_Dq1RmCSDRkXpsvLboLcHEQxfBm5q`, production,
www.hebuntech.com), fast-forward of `67ba281d`. Zero schema, zero migration (ledger 71 before and
after). No new authority, no Governance write, no automatic revocation, no EAI or provider change.
Machine execution stays DISARMED. WF-3 remains BLOCKED-BY-SCI. Agent #2 remains STOPPED.

## The invariant

An agent-proposed permit may have been legitimately issued, but it is not spendable while its
proposing agent is out of service or its CURRENT effective mandate no longer admits the action kind.

ISSUED != SPENDABLE NOW. REVOKED (a Governance decision) != NOT SPENDABLE (continuing authority failed).

## What was released

- `spendPermit` (`action-authorization/consume-action-permit.server.ts`) — the one statement every
  execution door spends through, human and machine — now, for a request whose persisted
  `proposed_by_actor_type = 'agent'`, reads the Agent Identity liveness and the Agent Mandate
  effective mandate (their own released readers, unchanged, on the spend transaction's connection)
  and decides with the shared `refuseOutsideAgentMandate`. Ids come off the request row.
- A failure throws and rolls the spend back: the permit stays `active`, no consumption audit, no
  work, no attempt. Reasons: `agent-not-in-service`, `agent-mandate-refused` (the APF-1 words).
- Human-proposed requests read no agent state. Callers map the reasons (external/publish door →
  `permit-not-executable`; record-work and machine pass them through). APF-1 machine prechecks stay.
- CURRENT mandate semantics: the mandate revision a proposal was made under is not persisted
  anywhere, and is not reconstructed. Restoring a narrowed mandate makes the same permit spendable.

## Evidence

**Test-verified only (real Postgres, L1 + L2):** `tests/wf4-continuing-authority/` — 12 cases
(valid executes; mandate narrowed → refused, permit active, no work, no audit; mandate restored →
same permit executes; revoked/expired unchanged; cross-tenant and missing agent fail closed;
retirement refused; machine door minted directly with prechecks and arming bypassed still refused;
human request unaffected; 0 network) plus an import-graph firewall (no agent, mandate, decision,
approval, revocation or issuance writer reachable from the spend). Bite-proofs 5/5. L2: 86
spend/execution tests vs `67ba281d` — same 16 baseline failures, first error identical after one
masked census pin was fixed; mandate/GIA-1 census pins widened by name. **The negative cases were
not executed in production.**

Known masked coverage: `r3b-flow/execution-postgres`, `sia1`/`sia2` postgres fail at baseline with
`tenant-not-armed` (fixture drift), so the agent-proposed send door is not end-to-end proven.

**Production (read-only):** deployed SHA = `89d062c6`. Prod read-only snapshot before == after:
ledger 71, audit_log 212, heby_action_requests 16, decision_records 59, action_permits 9 (0 active
unexpired), work_items 6, action_execution_attempts 4, both agents in service. Director-signed-in
`/approvals` read: page loaded, approvals and permit summary rendered, no runtime error, no control
used. This proves the read surface is intact, not the continuing-authority refusals.

## Residual TOCTOU

READ COMMITTED, no lock (the repository has no `FOR SHARE` convention). A retirement or mandate
revision committing after the in-transaction reads and before the spend commits is not seen. The
window is the remainder of that transaction — not zero. Before WF-4 the human door had no check.

## Remaining debts

- Agent-proposed send door end-to-end test (fixtures need tenant arming).
- `/approvals` shows an agent-refused permit as `active` with no "not spendable now" reason.
- APF-1 machine prechecks now redundant with the spend — deletion candidate.
- Stale ledger pins (67 vs 71) in ama2/ama3 mask later assertions.
