# APF-3 — Narrow Agent #1 Origination

**Status: CLOSED / PRODUCTION-ACCEPTED (Director, 2026-10-06).**
Deployed SHA `5f98d62ed1f6e6707d24827f56cfd8295d904c01` (`dpl_Fe9mb4sMrhNS1VG5KVaMWNQ2pmo5`).
Zero schema, zero migration (ledger 71 before and after). No new authority. No second agent.

APF-2 (read-only decision) found agent origination refused by the platform (`agent-origination`
UNKNOWN) and, separately, a model-facing projection wider than any honest ALLOW: recipient names,
draft titles, provider-observation metadata, UUID references, and a declaration that was listed by
hand rather than derived from what was rendered. APF-3 narrowed first, then allowed, as separate
authorities released in order.

## Release order — five authorities, never one boolean

| # | Authority | Change | Commit / record |
|---|---|---|---|
| 1 | Runtime minimization (inert) | Model sees only the goal and the organization's structure (org-level availability, department slug + name). Send and observation arms hidden from the model; parser and slug resolvers consult only what was shown. Declaration derived from rendered lines. A supplied observation is refused (`observation-not-admitted`), never dropped. | `7c2ed6d3`, fix `c850ef4e` (7c2ed6d3 had imported the data-use vocabulary into agent-origination, breaking the EAI-1A import firewall; the type is now read off the generator's own declaration type) |
| 2 | Platform ALLOW | Exactly `anthropic/messages × agent-origination × {conversation, organization}`, assistance bounds, bound to attestation `ffb0c160` | `dcc8af2f` |
| 3 | Tenant authorization ceremony | `--agent-origination` switch; a new revision always carries the union of in-force and added scopes | `5f98d62e` |
| 4 | Agent mandate (Governance) | hebun Heby rev 2 `["send"]` → rev 3 `["send","record-work"]` with an aligned purpose | prod record `317cc43c`, decision `940f586a` |
| 5 | Tenant authorization (Governance) | hebun rev 1 → rev 2 | prod record `8427ad60`, decision `fa86c2ac` |

Steps 4 and 5 were executed by the Director through the released writers (`/agents` mandate form;
TTY ceremony with the typed phrase). Nothing was written by a script of this phase.

## Production truth after closure

| Fact | Value |
|---|---|
| Processor attestation | `ffb0c160` revision 1, **active / ATTESTED — not VERIFIED**; `model_ids` = [`claude-haiku-4-5-20251001`] |
| Platform ALLOW (origination) | `agent-origination × conversation`, `agent-origination × organization` — nothing else |
| hebun authorization | revision 2 `8427ad60` effective: assistance × {conversation, knowledge, work-artifact} + agent-origination × {conversation, organization} |
| TRH, Mulify | no external-AI authorization (gate: `tenant-not-authorized`) |
| hebun Heby mandate | revision 3, `proposal_scope` `["send","record-work"]`, purpose: "Heby exists to propose, for human-governed review and decision, that a prepared outbound communication be sent or that organizational work be recorded. Heby only proposes: it never approves, authorizes, sends, records or executes anything itself, and every proposal remains subject to this organization's Governance and execution controls." |
| Configured model | `claude-haiku-4-5-20251001` — verified point-in-time by the Director on the deployed `/director/provider-matrix` projection (same resolver the generator uses; `HEBUN_MODEL_ID` is an unrevealable Vercel secret) |
| machine-internal-execution | DISARMED (v8), unchanged |
| hebun standing envelopes | none; none used or created |

## The single acceptance call

Goal (Director-approved, via `/approvals` → "Ask Heby for a proposal", hebun):
"Create a proposal to record an internal follow-up task for the Engineering department to review the
Agent #1 acceptance results." (Engineering is hebun's only department; no organizational data changed.)

| Step | Result |
|---|---|
| Provider calls | exactly **one** — invocation `b24daf8f`, transport live, model `claude-haiku-4-5-20251001`, 878 in / 79 out, `msg_011CfkLgJeDvBZzEGdQH2z1D` |
| Provider call successful | YES |
| Strict parser + membership | PASSED (`selection-valid`) |
| Target | department Engineering (slug resolved to its reference in trusted code after the parse) |
| Mandate ceiling | PASSED |
| Result | request `99000f47-4479-4ac0-ba90-781d43c31c6d`: **PENDING** `record-work`, proposer = agent `4ffeeb83`, `standing_authorization_id` null |
| Permit / approval / execution | none — permits 9→9, decisions 59→59, work items 6→6 |
| TRH / Mulify | fingerprints unchanged |

The PENDING request is the intended terminal state. It was not approved or executed.

**What was observed vs. proven.** The per-call declared data classes and the exact model-facing
payload are **not persisted**. That this call disclosed only `conversation` + `organization`, and no
recipient, draft, observation, supplement, Knowledge or UUID, is proven by the released code at
`5f98d62e` and its tests (`tests/apf3-narrow-origination/`, bite-proofs 6/6), not by a per-call
disclosure record. The gate was additionally evaluated read-only against production state before
the call: hebun narrow origination `authorized`; any extra class, other purpose, TRH or Mulify refused.

## Validation

L1/L2 focused suites green; bite-proofs 6/6 (hand-listed declaration, send arm restored, untagged
recipient line, supplement dropped, uuid token, parser handed unshown candidates). L3 once at
`5f98d62e`: 872 / 67 / 939; every one of the 67 also fails at `69bb5669` (APF-1 baseline 868/67/935;
+4 new files).

## Remaining architectural debt (not solved here)

**A. Model / attestation continuity.** The runtime EAI gate does not enforce
`configured model ∈ attestation.model_ids`. APF-3 relied on a verified point-in-time configuration
check; a later `HEBUN_MODEL_ID` change would not be refused.

**B. Per-call disclosure provenance.** The declared data classes and the model-facing projection
are not persisted per provider invocation, so a single call's disclosure can be proven only from the
released code, never from its own record.

Still excluded by design until their own decisions: send origination, observation/provider-content
origination (Secure Content Ingestion not implemented), standing envelopes and machine execution for
hebun, any second agent.
