# AGENT-EXECUTION-1 · design and capability inventory

Baseline `16459905` (origin/main, PRODUCTION-ACCEPTED OPERATIONAL-RELIABILITY-1). This record states what
agents could do before this milestone, the one workflow it delivers, and the boundaries it keeps. It is
not a closure record; release evidence is written in the closure after a Director-authorized release.

## 1 · Inventory at the baseline (measured in code, not assumed)

| Capability | State | Owner · write seam | Evidence |
|---|---|---|---|
| Durable agents, lifecycle (register · suspend · reactivate · retire, each a Governance decision) | Implemented, verified | Agent Identity · `create/suspend/retire-durable-agent-identity.server.ts` | decision + audit rows |
| Mandate = proposal kinds (`send`, `record-work`, `set-work-declared-state`) + work-scope responsibility | Implemented, verified | Agent Mandate · `establishAgentMandateWithResponsibility` | revisioned rows, Governance decision |
| One shared ceiling (`refuseOutsideAgentMandate`, `refuseOutsideAgentResponsibility`) | Implemented, verified | `action-authorization/agent-mandate-ceiling.ts`; asked at filing, standing issue, spend | refusals |
| Agent origination: one model call → one pending action request | Implemented, connected (Anthropic, `agent-origination` cells), verified for Hebun only | `agent-origination/*` → `record-action-request.server.ts` | invocation + request rows |
| Governed internal execution (record-work, place-human, set-work-declared-state) | Implemented, verified | Work Authority / GIA executors under a single-spend permit | work row + audit `handoffId` |
| External execution (email, Instagram, YouTube) | Implemented, connected, armed per tenant; each verified once | `action-execution/*` | attempt rows (`accepted` ≠ delivered) |
| Agent-authored work artifact (draft) with Governance review | Implemented, connected (`assistance` × work-artifact), verified (CGO-9) | Work Artifacts · `prepareWorkArtifact`; review `acceptArtifactRevision` | revision `authored_by` agent + `source_message_id`; review decision |
| Agent tools, provider reads as tools, multi-step loop | Missing | — | — |
| Agent "capabilities" beyond proposal kinds (`agents.allowed_tools`, `provider_profile`, …) | Planned only — columns with no writer or reader | — | — |
| Tasks/missions/plans/workflows tables; `orchestration`, `task-planning`, `agent-crud`, `agent-runtime` | Mocked/simulated, or dead schema | in-memory; gated from Heby by the mock gate | none |
| A person assigning an agent bounded work on a work item | **Missing — the gap this milestone closes** | — | — |

The one real agent work path (preparation) had no mandate bound: any in-service agent could be named the
author of any draft. Heby could ask an agent to *propose*, never to *work*. AP-0 rejects an
`agent_assignments` table and task/workflow activation (roadmap §20.5); nothing below adds either.

## 2 · Responsibility model, as enforced

- **Person and organization.** Tenant and person come from the session (`resolveTenantContext`). Assigning
  agent work on a work item needs this organization's Governance authority — the same authority the Work
  Authority requires to declare evidence, asked before the model so a refused request spends no call.
- **Heby** coordinates on `/heby?workItem=…`: lists only agents the server found responsible, states what
  the agent may and may not do, reports what the records hold. It decides nothing.
- **Agent** performs one bounded task: write one draft from the person's instruction. It is the author of
  the revision; it cannot read the work item (never sent to the model), send, publish, change work state or
  approve its own draft.
- **Governance** decides completion: acceptance of the exact revision. No authorization is needed to write a
  draft (preparation only); anything consequential afterwards needs its own request, decision and permit.
- **Authoritative owners** write: Work Artifacts (the draft), Organizational Work (the evidence link, a
  human act through its own action on `/director/work`), Governance (review). The new seam owns nothing.

## 3 · The capability contract

`src/features/agent-work/capabilities.ts` declares agent WORK capabilities. One entry:
`prepare-work-draft` — side effect `PREPARATION_ONLY`; mandate condition: in-force mandate admits
`record-work` or `set-work-declared-state` AND responsibility covers the work item's recorded scope; data use
`assistance` × {conversation, work-artifact}; output: one agent-authored draft; completion: Governance
acceptance. A contract test pins every entry to the mandate vocabulary, the responsibility-scoped kinds and
the platform data-use policy, and proves no entry is an executable action kind.

Availability = implemented ∧ configured ∧ connected (Director Claude control, model transport) ∧ permitted
(the shared ceiling) ∧ authorized where required (EAI decision at the generator). A declaration alone
grants nothing.

## 4 · The workflow (vertical slice)

Work register → "Ask Heby: propose a state change or assign an agent a draft" → `/heby?workItem=` →
**Prepare a draft for this work** → choose a responsible agent, type, title, instruction → **Assign** →
`assignWorkDraft`:

1. tenant · work item (in service, scoped) · requester Governance authority · agent in service + shared
   ceiling per kind · no open draft by this agent on this work — all before the model;
2. `prepareWorkArtifact` (released): one model call under the EAI gate, revision authored by the agent and
   linked to its message;
3. work item and the agent's responsibility asked again; if either changed, the result is `prepared-stale`
   and the draft is not offered as this work's evidence;
4. Heby offers **Link this draft to the work** — the person's own act through the WEV-1 human action;
5. the draft is reviewed in Operations; Heby reads the task back as `waiting for review` /
   `changes requested` / `accepted — this task is complete` / `review state could not be read`.

Conceptual states map to existing records: requested = the person's call; started/attempted = the model
invocation's message row; completed (prepared) = the revision; correlated = the evidence reference;
outcome verified = the Governance review decision; failed = a refusal or `no-model-answer` (nothing filed).
No state is persisted by this milestone.

## 5 · Extension scenarios

| Scenario | Supported without a new engine? |
|---|---|
| New specialist agent | Yes — register, mandate, responsibility; it appears where responsible |
| New read-only / preparation capability | Yes — a contract entry + a seam that calls its owning authority; the contract test checks kinds and data classes |
| New Governance-controlled mutation | Yes — existing registry → request → decision → permit → executor; not a work capability |
| Provider-backed capability | Only after a provider capability, a platform data-use cell and tenant authorization exist; the contract test refuses an unallowed class |
| New tenant | Yes — tenant-scoped reads/writes throughout; needs its own EAI `assistance` authorization for live calls |
| Disable a capability | Withdraw the agent's responsibility or mandate, suspend the agent, or switch the Director Claude control off — each refuses before the model |
| Revoke agent authorization / update mandate | Refused at the next assignment; an in-flight run is reported `prepared-stale` |
| Provider unavailable | `not-prepared` (`no-model-answer` / `model-connectivity-disabled`); nothing filed |
| Unfamiliar capability in Heby | The affordance renders the contract's own label, input, cannot-list and completion |
| Recording evidence / recovering interrupted execution | Revision + message provenance; an interrupted request is shown as unknown and points to Operations; nothing consequential to reconcile |

## 6 · Limits, stated

- **Real provider execution UNVERIFIED locally.** Local verification used the fake model transport (no
  provider credentials are used outside production, and none were read). Production acceptance needs one
  Director-authorized live assignment in a tenant with `assistance` authorization.
- **Sequential unlinked drafts.** Concurrent assignments of the same (work item, agent) are serialised by a
  transaction-scoped `pg_try_advisory_xact_lock` held from the open-draft read until the draft is filed; the
  loser is refused `assignment-in-progress` before the model (E15, two connection pools). Once a draft is
  filed and before the person links it, a deliberate second assignment can still write a second draft:
  nothing records which work an unlinked draft was for, and no table is added to record it.
- **Lock cost.** The holder keeps one pooled connection idle in transaction (no row locks) for the model
  call's duration.

## 7 · Hardening (same milestone)

- **The Operations preparation path is bound to the mandate.** `prepareWorkArtifact` — the one seam every
  preparation path calls (Operations, the observation-grounded path, the assignment seam) — asks the shared
  ceiling of the named author before the model and again before filing:
  `refuseOutsideAgentWorkCapability` (in `capabilities.ts`, built only from `refuseOutsideAgentMandate` and
  `refuseOutsideAgentResponsibility`). The scope is a server-side dependency, never an input field: the
  assignment seam passes the work item's recorded scope; Operations has no work item, so its drafts are
  organization work and need organization-level responsibility. A mandate withdrawn during the model call
  files nothing (`agent-mandate-changed-while-preparing`).
- **Behaviour change for customers.** An Operations draft by an agent with no mandate, without a drafting
  kind (`record-work`/`set-work-declared-state`), or with domain-only responsibility is now refused before
  the model, with the reason stated. Production mandates were not read in this milestone, so which existing
  agents are affected is UNVERIFIED until the release gate.
- **Observed, not changed:** media generation (`request-media-generation`, the async video lifecycle) also
  records a named in-service agent as author with no mandate bound. Media is not a work capability in this
  contract and its authority states that Governance is not consulted by design; binding it is a separate
  Director decision.
