# WF-2 — Agent #1 Effective Capability Truth Surface

**Status: CLOSED / PRODUCTION-ACCEPTED (read-only acceptance, 2026-10-06).**
Release `8af0e7d9` (`dpl_FqdXa3GfqynUMMVgym7ALWJ8wgTK`, aliased www.hebuntech.com), fast-forward of
`f84c6bbf`. Zero schema, zero migration (ledger 71 before and after). No new authority, no EAI,
Governance, execution, provider or mandate change. Agent #2 remains STOPPED.

## What was released

`/agents` gains one read-only card, "What the agent can propose now", directly below the mandate
card. It is a pure derivation (`features/origination-availability/capability-truth.ts`) of the WF-1
availability projection — the one origination availability authority — and computes nothing of its
own:

| Row | Source |
|---|---|
| Can propose now | the projection's `originable` (`record-work`), only when AVAILABLE |
| Mandate permits · revision N | the effective mandate the projection read |
| Permitted, but not offered by the current proposal path | mandate scope − originable (`send`) |
| The agent itself does not | fixed: approve, permit, execute, create work directly, send directly, grant itself authority |

MANDATE PERMITS ≠ REACHABLE NOW ≠ AVAILABLE ≠ AUTHORIZED ≠ EXECUTED.

An UNAVAILABLE projection renders its bounded reason and "No capability is shown until it can be
confirmed" — never "cannot". The card is asked only when an in-service identity exists; the tenant
is the request's session, never client input. The card is a server component with no client
boundary; the derivation imports no value.

## APF-5 consistency (resolved before implementation)

The post-WF-1 review stated the gate does not enforce `model_ids`. That was stale (pre-APF-5):
- the disclosure gate refuses `model-not-attested` when the model is outside the attestation in
  force (`compose-external-ai-disclosure.ts`);
- the shared generator hands the gate the resolved model and sends that same value;
- agent origination reaches the provider only through that generator.
No regression.

## Validation

L1 focused. New `tests/wf2-agent-capability-truth/`: real-Postgres two-organization test (send +
record-work → record-work only; the other organization sees only its own `external-ai-not-authorized`;
0 writes across 10 tables, 0 fetches) and a surface/firewall test (every unavailable reason fails
closed, send never reachable, no approve/permit/execute claim, projection reused). Bite-proofs 3/3.
21 pinned neighbours: 19 pass; `ama2`/`ama3` ledger pins fail identically at `f84c6bbf`. tsc clean.

## Production acceptance — PASS

Signed-in browser read of `/agents` (hebun): Heby, mandate revision 3; Can propose now = Work
proposals; Mandate permits = Send + Work proposals; Send listed as permitted but not offered by the
current proposal path; the no-authority list rendered. Agent #1 was not invoked.

Prod read-only (`default_transaction_read_only = on`) before == after: ledger 71, audit_log 212,
heby_origination_invocations 13, heby_action_requests 16, decision_records 59, action_permits 9,
work_items 6, messages 126, agent_mandates 4, tenant_ai_data_use_authorizations 2, agents 2.

## Remaining debts

- Card title wraps narrowly in the header layout at small widths (cosmetic).
- `/director/agents` and `/director/registries/agents` still render seeded definitions.
- WF-1: post-proposal copy, no catch on a rejected action, no real-browser test.
- Workforce: succession, durable spend ceiling, permit invalidation, placement — deferred.
