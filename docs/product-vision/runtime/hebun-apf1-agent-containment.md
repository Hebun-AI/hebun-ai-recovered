# APF-1 — Agent Containment Closure

**Status: RELEASE APPROVED by the Director (2026-10-06). Released from `feat/apf-1-agent-containment` (base `2b5a0a8d`).**
Zero schema, zero migration. No new authority. No second agent. No External AI permission widened.

## Why

APF-0 (re-gate, 2026-10-05, read-only at `2b5a0a8d`) stopped Agent Workforce plurality and found
that several human-controlled stops did not reach the machine path:

| # | APF-0 finding (re-proved in source before any edit) | Seam |
|---|---|---|
| 1 | Mandate withdrawal was checked only when a proposal was filed; standing issuance and machine delivery never re-read it | `issue-permit-under-standing-authorization.server.ts`, `execute-record-work-as-machine.server.ts` |
| 2 | Organization suspension (`companies.tenant_status`) was enforced only by the session gate; the machine path never read it | `resolve-machine-execution-reachability.server.ts` |
| 3 | Standing issuance wrote no audit row, while its header claimed "same audit" | issuer |
| 4 | Standing issuance read the tenant's machine-execution grant but not the `machine-internal-execution` root control | issuer |
| 5 | Any authenticated member could create the tenant's one durable agent; only the owner was checked on retire | `create-` / `retire-durable-agent-identity.server.ts` |

## What changed — every truth read from its existing owner

| Stop | Owner reused | Issuance | Delivery |
|---|---|---|---|
| Effective mandate | Agent Mandate Authority read (`readEffectiveAgentMandateForRuntime`, a tenant-id door into the same query) + ONE shared ceiling decision (`action-authorization/agent-mandate-ceiling.ts`, also used by the proposal writer) | NEW | NEW |
| Organization lifecycle | `isTenantOnboardingEligible` — the one R4B `companies` predicate the session gate shares — composed into machine reachability | NEW (via reachability) | NEW (via reachability) |
| Tenant machine grant | `tenant_machine_execution_authorizations` via reachability | existing | existing |
| Root control | `machine-internal-execution` via reachability | NEW | existing |
| Agent in service | `readDurableAgentRuntimeLiveness` | existing | existing |
| Envelope valid | `standing_mutation_authorizations` effective revision | existing | **not re-checked** (limitation) |
| Audit | `recordActionAuthorizationEventWithin`, `governance.action.permit.issued`, same transaction as the permit | NEW | existing (`permit-consumed`) |
| Create / retire | `resolveGovernanceAuthority` (bootstrap human or active delegate) — after the released checks, so every prior refusal keeps its reason | — | — |

**The audit event.** Actor = the human who signed the envelope (the permit row's own authorizer; the
same rule the released machine spend applies to `permit-consumed`). Decision = the standing decision.
`executed: false`. No `approved` request event is written — no per-act deliberation happened. That the
permit came from an envelope stays where it already lives: `action_permits.standing_authorization_id`
on the entity the event names. No metadata field was added to the audit contract.

**Retirement now needs BOTH** ownership and Governance authority. Nothing new is granted to anybody.

## Refusals added

- Standing issuance: `tenant-not-active`, `machine-execution-disarmed`,
  `agent-mandate-authority-unavailable`, `no-agent-mandate`, `action-outside-agent-mandate`.
- Machine delivery: `agent-mandate-refused` (ceiling word in `authorityReason`); suspension surfaces as
  `machine-execution-not-reachable` / `tenant-not-active`.
- Reachability: `tenant-not-active`. An unreadable lifecycle is `persistence-unavailable`, never a pass.
- Create / retire: `no-governance-authority`, `not-the-governance-authority`.

## Known limitations (stated, not solved)

Accepted by the Director at the release gate; none is solved by APF-1.

1. **Standing-envelope residual window — ACCEPTED.** Withdrawing an envelope blocks NEW issuance; it
   does not independently invalidate a permit already issued under it. That permit stays spendable by
   machine delivery until it is spent, revoked through the existing permit-revoke mechanism, or
   expires — default TTL 1 h, bounded at 24 h by `action_permits_ttl_bounds_chk`. Mandate withdrawal,
   agent retirement, organization suspension and root disarm DO stop it at delivery. Permit lifecycle
   was deliberately not redesigned here.
2. **Pre-spend read window.** Delivery reads liveness, reachability and mandate BEFORE the spend, not
   inside its transaction — the same documented window RUNG 1 already carries.
3. **Legacy-owner policy — DEFERRED POLICY QUESTION.** An agent created before APF-1 by a member who
   does not hold Governance cannot be retired until that owner legitimately holds Governance (bootstrap
   or an active delegation). The Director decided to KEEP this behaviour: Governance is NOT given an
   ownership-override power. Whether one should exist is an open policy question, not an APF-1 defect.
4. **Who may press Execute** on a human-path permit is unchanged (any authenticated tenant member).

## Deferred security findings — recorded here, NOT changed by APF-1

From APF-0's security review; each needs its own phase and Director decision:

- **Media egress bypasses External AI data-use.** OpenAI image generation and Higgsfield video send
  tenant prompts gated only by root controls; neither consults tenant data-use scopes nor the platform
  policy — Higgsfield is DENIED in that policy but the runtime does not read it.
- **TB-1 misclassification.** Draft revision text (live under `assistance × work-artifact`) and YouTube
  observation text (latent; refused by today's policy) are appended to `systemInstructions`, the class
  documented as never carrying tenant content.
- **Gate keyed on a transport symbol mark.** A wrapper around the live Anthropic transport would drop
  the mark and skip the data-use gate. No wrapper exists today.
- **`relevance-judge`** calls a transport directly with no data-use gate; unwired today.

## Validation

L1 focused + L2 subsystem (every suite that imports a changed seam, against real PostgreSQL), plus
`tests/apf1-agent-containment/` (14 required cases) and its bite proofs (8 gates, each removed in turn
must fail the suite for its stated reason). L3 canonical suite: once, at release readiness.
