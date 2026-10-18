# AP-5 — Same-Tenant Two-Agent Production Acceptance — Closure

Authority for what AP-5 must prove: `hebun-ap5-two-agent-acceptance-contract.md` (criteria A1–A15,
invariants I1–I17, §5 limits). This record states what was measured against it, how, and what was not.
It creates no authority and changes no criterion.

**Status: DEPLOYED, not PRODUCTION-ACCEPTED.** DEPLOYED describes the production implementation AP-5
rests on — `b5784119` (the work-state chooser) running in `dpl_476kC4ASTHZ4Lpt7ARLGmvcjeFui` at
`250bf126` — not this record, which is unpublished until it is pushed. Every production fact below was
measured, and the Director has taken the two acceptance decisions recorded in *Director decisions*.
Final AP-5 production acceptance is a separate Director act that this record does not take.

Production baseline throughout: `main` = `250bf126bb2ec5de538cdcbd0004fe1aef6087ae`, Vercel production
deployment `dpl_476kC4ASTHZ4Lpt7ARLGmvcjeFui` (project `hebun-ai-recovered`), migration ledger 78.
Tenant: Hebun AI `f625b683-3be5-40eb-93a4-53fc56ab38c9`. Reference tenant for isolation: `9947c78e…`.
Every production write below was made by the Director through a released human surface; every
production read was either an authenticated UI read or a Director-approved, PostgreSQL-enforced
read-only transaction (`default_transaction_read_only = on`, `begin read only`, rolled back), tenant
scoped, with no credential printed. No code, schema, migration, mandate of Heby, kill switch, provider
configuration or machine-execution control was changed.

## Evidence classes used in this record

| Class | Meaning |
|---|---|
| PRODUCTION | Measured in production (UI read or read-only SQL), ids recorded |
| TEST | Proven by a repository test that ran on 2026-10-18 at `250bf126` against disposable PostgreSQL 18 |
| DIRECTOR INTERPRETATION | Accepted by an explicit Director decision; the underlying evidence class is stated beside it |
| DOCUMENTATION | Satisfied by this record |

## What happened in production (chronological, 2026-10-17 unless stated)

| Step | Who / surface | Result |
|---|---|---|
| A2 baseline | read-only SQL | six-table per-tenant count + md5; ledger 78 |
| Registration | Director, `/agents` | Engineering Agent `670a6889-633a-48bd-956f-c9e6a93e6dca`, 14:42:26Z; decision `7320ca2d-9d77-4231-a855-5966fd13d03e` (`agent-registration` / `agent-registered`) + `governance.decision.recorded` audit |
| Mandate revision 1 | Director, `/agents` | `d6fdc147-e437-468c-a120-e4e805f58442` scope `{record-work}`, responsibility domain `e48da4bb` only; decision `e9c8eba4-ebd0-47ba-93d4-aa53eb60bff5` (`agent-mandate-bounded`) + `agent-mandate.established` audit |
| Chooser render | Director session, `/heby?workItem=92e70b3e…` | first production two-agent work-state chooser, 14:59:35Z |
| PROBE 1 | Director-approved origination, Engineering Agent | `no-action` (model declined: goal framed as no work performed); nothing filed |
| PROBE 1b | Director-approved origination, Engineering Agent | invocation `0f0e8d25-467f-4777-baab-6556011bd120` → request `d288c6c9-bdbe-4e8d-b17d-9b9fea364b4d` (pending) |
| PROBE 2 | Director-approved origination, Heby | invocation `9bc7231a-6a08-462c-9d1d-1fe929d3f317` → request `bb6e707e-6774-4f59-8586-1a1c4c898f74` (pending) |
| Machine safety read | read-only SQL | `machine-internal-execution` `director_enabled = false` (v8, 2026-09-16); no Hebun `record-work` machine authorization; no standing envelope ever |
| Authorization | Director, `/approvals` | `d288c6c9` approved 19:16:11.120Z, decision `482c991e-d22f-4e20-bd81-4e8e45290c6d`; permit `978e1a94-8317-4981-9836-4f136391137e` TTL 300 s |
| Execution | Director, `/approvals` "Execute now" | permit consumed 19:16:52.722Z, handoff `ff920475-8fb3-4f1e-91e4-389d6109f765`; work item `5ba33201-fffa-4a41-864c-79cd567de635` (planned, `created_by` = Director) |
| Closure reads | read-only SQL, 2026-10-18 | lineage, attribution invariants, historical Heby chain, isolation snapshot (below) |

Provider calls: six `claude-haiku-4-5-20251001` calls in total (three conversation answers, three
originations), each Director-approved before it was made. No permit spend by machine; no external send.

## Acceptance matrix A1–A15

| # | Criterion (contract wording, abridged) | Class | Evidence |
|---|---|---|---|
| A1 | Exactly two in-service agents, distinct ids and names | PRODUCTION | `670a6889…` Engineering Agent, `4ffeeb83…` Heby; `/agents` 2/2 in service; SQL: neither suspended nor retired |
| A2 | Same tenant; no other tenant changes | PRODUCTION | Reference tenant six-table md5 identical before registration, after registration and on 2026-10-18 (see *Isolation*) |
| A3 | Distinct mandates, one Governance decision each | PRODUCTION | Heby rev 5 `e1f3a684…` {send, record-work, set-work-declared-state} org + Engineering; Engineering Agent rev 1 `d6fdc147…` {record-work} Engineering only |
| A4 | Governance-authorized registration (closes B2) | PRODUCTION | decision `7320ca2d…` + audit row, same instant; reason recorded (288 chars) |
| A5 | Explicit selection; one live origination per agent | PRODUCTION + TEST | chooser on every originating surface (test); production: two-agent chooser with no default; invocation agent = request proposer = chosen agent for both probes (SQL) |
| A6 | Ambiguous selection refused before provider/write | TEST | ap1, ap5a, wuas-1, agent-runtime-0, agent-proposal-2, media1 suites; no production probe (contract) |
| A7 | Agent-specific lineage | PRODUCTION + DIRECTOR INTERPRETATION | see *A7* |
| A8 | Out-of-responsibility scope disabled / refused | PRODUCTION (UI) + TEST | Organization-level listed and `disabled` for Engineering Agent, enabled for Heby; ap4b suites |
| A9 | Foreign or malformed selection refused; isolation | TEST + PRODUCTION | `selected-agent-unresolvable` suites; A2 isolation read |
| A10 | Human authorization only | PRODUCTION | 0 decisions with agent or NULL actor; 0 permits not human-authorized (NULL-safe); 0 approved requests without a human approver |
| A11 | One approved proposal → one permit, consumed once by the matching agent under its current mandate; the other agent's permit cannot be spent for it | PRODUCTION + TEST | production: `d288c6c9` → `482c991e` → one permit `978e1a94` (TTL 300 s, no standing authorization) → consumed once → one work item; mandate-at-spend and cross-request binding: r3a-flow (incl. single-spend concurrency), wf4, ama2, gia1, ap4b suites |
| A12 | Lifecycle safety | TEST | l1a, l2b suites; no production suspend/reactivate (optional under the contract, not approved) |
| A13 | Production evidence recorded | DOCUMENTATION | this record: SHA, deployment, ledger, digests, every created id |
| A14 | Refusal evidence named | TEST + DOCUMENTATION | see *Refusals relied on* |
| A15 | §5 stated verbatim and end state | DOCUMENTATION | see *Rollback and end state* |

## A7 — agent-specific lineage

Contract: invocation → request → decision → permit → attempt → work keeps the proposing agent's id; no
request names the other agent; evidence: production read of the chain for each agent's request.

**"Attempt" for an internal act** is defined by the existing GIA-1 decision, which remains
authoritative: `action_execution_attempts` is external-send specific, and for an internal act "the work
row and its audit event are the outcome record" (`hebun-gia1-governed-internal-action-closure.md`); the
permit's `handoff_id` is the execution binding.

| Link | Engineering Agent (two-agent environment) | Heby (two-agent environment) | Heby (historical, before Agent #2) |
|---|---|---|---|
| agent → invocation | direct: `0f0e8d25…` agent `670a6889…` (FK) | direct: `9bc7231a…` agent `4ffeeb83…` (FK) | invocation `4e484b74…` |
| invocation → request | direct: `d288c6c9…` (stored value, tenant-equal join) | direct: `bb6e707e…` | direct: `fdc0e57b-3861-4c25-a75f-b7d2ff559e77` |
| request → decision | direct: `482c991e…`, actor Director | not exercised (request pending) | direct: `89b7d170-0c93-4546-9c5f-3044aa6f52d8`, actor Director |
| decision → permit | direct: `978e1a94…` | not exercised | direct: `88537b7c-bb04-409a-8577-b29873f2d532`, consumed 2026-10-12T17:51:42Z, handoff `ed5a577b…` |
| permit → work (attempt) | direct: `work.recorded` audit `metadata.handoffId = ff920475` → `5ba33201…` | not exercised | **strong indirect correlation, not a persisted reference**: same audit `request_id` `032d939e-490a-4447-8f25-e7f20a6f77e0` (1:1) → `bb56f9dc-c833-4bbe-892e-6456bec3d8c3`; title, scope and domain equal the approved payload; created by the Director as system, +9 ms; one-transaction code path |
| no request names the other agent | 0 mismatches in the tenant (SQL) | 0 | — |

The historical link is indirect because `handoffId` entered `work.recorded` metadata only at `7821b0b9`
(2026-10-12T22:43Z), after that spend ("spends executed before this change have no link"). The
correlation method was validated on the Engineering Agent control, where the `request_id` path selects
the same work item the direct handoff link proves. The historical work item is now declared `active`,
changed later by Heby's approved `set-work-declared-state` request `bc195e09…`.

**Director acceptance interpretation (Decision 1).** A7 is accepted on composite evidence:
Engineering Agent A–F directly verified in the two-agent environment; Heby A–B directly verified in
the two-agent environment; Heby's historical chain directly linked request → decision → permit and
strongly correlated permit → work. The historical permit → work link is not a persisted direct
reference, and the historical execution predates Agent #2. This is an explicit Director acceptance
interpretation, not a claim that direct Heby lineage was observed end-to-end in the two-agent
environment (`AP5-HEBY-DIRECT-LINEAGE-1`).

## Isolation (A2 / A13)

Per-tenant row count and md5 over `agents`, `agent_mandates`, `agent_mandate_responsibilities`,
`decision_records`, `heby_action_requests`, `action_permits`; ledger 78 at every read.

| Table | Reference `9947c78e` (before = after = 2026-10-18) | Hebun after registration → 2026-10-18 |
|---|---|---|
| agents | 1 · `10dc00e7…` | 2 · `6045e1b8…` → unchanged |
| agent_mandates | 2 · `e69905b3…` | 6 · `2c39b017…` → unchanged |
| agent_mandate_responsibilities | 2 · `e269d21f…` | 5 · `9b466a44…` → unchanged |
| decision_records | 65 · `86d0f745…` | 26 → 27 (+ `482c991e`) |
| heby_action_requests | 11 · `fafad813…` | 14 → 16 (+ two probes; `d288c6c9` status) |
| action_permits | 9 · `7e107e0a…` | 5 → 6 (+ `978e1a94`) |

The 2026-10-18 read was restricted to these two tenants by Director instruction; the registration-time
read covered every tenant with rows, and only these two had any.

## Refusals relied on (A14)

`ambiguous-durable-agent-identity`, `selected-agent-unresolvable`, `selected-agent-retired`,
`proposing-agent-not-in-service`, `agent-not-in-service`, `agent-mandate-refused`,
`action-outside-agent-mandate`, `responsibility-required`, `digest-mismatch`,
`machine-execution-disarmed` — each bitten by the suites listed above (bite-proofs: ap1 9, ap5a 11,
agent-runtime-0 7, agent-proposal-2 5, media1 16, wf1 9, ap4b 13, ama2 14, gia1 all, l1a all, l2b ok).
No production refusal was provoked; the A8 production evidence is the disabled option, not a refused call.

## Verification

V3, because AP-5 exercised agent identity, Governance authority, tenant isolation and a production
execution boundary. The full suite was therefore run, and compared file by file against the recorded
red baseline rather than claimed green (`EHO-1-RED-SUITE-BASELINE-1`).

| Run (2026-10-18, same machine, same disposable PostgreSQL 18, `DATABASE_URL` unset) | Result |
|---|---|
| Release `250bf126` — `node scripts/run-tests.mjs` | 998 passed, 47 failed, 1045 total |
| Baseline `1f8f9a47` (EHO-1's recorded baseline) — same command, detached worktree, identical package files | 996 passed, 47 failed, 1043 total |
| Failing files only at release | **none** |
| Failing files only at baseline | none |
| Common failing files | 47, every first failure message identical |
| The two added files (`tests/work-update-agent-selection-1/*`) | pass |

The 47 are pre-existing: pinned migration counts, census counts and boundary allowlists that later
phases outgrew, plus `r3w-flow/ambient-database-safety.ts`, which ends with "terminating connection due
to administrator command" identically on both commits. No unrelated code was changed to make anything
pass; both worktrees were clean after the runs. The 48 AP-5 seam files listed under the matrix were
also run one by one and all exit 0.

<details><summary>The 47 failing files, identical at both commits (first-failure messages identical)</summary>

- `tests/cmd0-seeded-goals/containment.ts`
- `tests/cmdb1-command-overview/canonical-overview.ts`
- `tests/cmdb2-canonical-command-l2/bite-proofs.ts`
- `tests/cmdb2-canonical-command-l2/navigation.ts`
- `tests/cmdfinal-command-cockpit/cockpit.ts`
- `tests/cmdv3-command-composition/composition.ts`
- `tests/dh1-decision-horizon/bite-proofs.ts`
- `tests/dh1-decision-horizon/horizon-firewall.ts`
- `tests/g3-flow/boundaries-and-firewall.ts`
- `tests/g5a-flow/bootstrap-boundary.ts`
- `tests/g5a1-flow/recovery-boundary.ts`
- `tests/g6c-flow/authority-reachability.ts`
- `tests/g6d-flow/source-truth-consistency.ts`
- `tests/glp-picker-per-file/boundaries-and-firewall.ts`
- `tests/hebycap1-flow/bite-proofs.ts`
- `tests/hlr-human-legibility/bite-proofs.ts`
- `tests/hlr-human-legibility/legibility-firewall.ts`
- `tests/instagram-account-lifecycle/lifecycle-firewall.ts`
- `tests/instagram-account-observation/provider-firewall.ts`
- `tests/instagram-oauth-admission/ceremony-firewall.ts`
- `tests/int5a-flow/bite-proofs.ts`
- `tests/int5a-flow/grounding-firewall.ts`
- `tests/int5b1-flow/bite-proofs.ts`
- `tests/int5b1-flow/provider-read-firewall.ts`
- `tests/int5b2-flow/bite-proofs.ts`
- `tests/int5b2-flow/pull-request-firewall.ts`
- `tests/int5c-flow/cross-source-firewall.ts`
- `tests/invitation-revocation-flow/boundaries-and-firewall.ts`
- `tests/knowledge-ingestion-flow/boundaries-and-firewall.ts`
- `tests/kr4-flow/surfaces-and-firewall.ts`
- `tests/kr5-flow/boundaries-and-firewall.ts`
- `tests/media2a-openai-image-transport/bite-proofs.ts`
- `tests/mv6-higgsfield-video/lifecycle-postgres.ts`
- `tests/osa-owner-eligibility/eligibility-firewall.ts`
- `tests/osa3-departmental-placement/bite-proofs.ts`
- `tests/osa3-departmental-placement/firewall.ts`
- `tests/osa3-departmental-placement/placement-truth.ts`
- `tests/osa4-people-register/people-truth.ts`
- `tests/prodmig-flow/bite-proofs.ts`
- `tests/prodmig-flow/boundaries-and-firewall.ts`
- `tests/provenance-vocabulary/provenance-vocabulary.ts`
- `tests/r3w-flow/ambient-database-safety.ts`
- `tests/r4b-flow/lifecycle-boundary.ts`
- `tests/r7-1-flow/boundaries-and-firewall.ts`
- `tests/stranded-enrollment-flow/boundaries-and-firewall.ts`
- `tests/supplied-media-account-provenance-1/provenance-postgres.ts`
- `tests/wev1-work-evidence/evidence-firewall.ts`

</details>

## Rollback and end state (A15)

Contract §5, verbatim:

- A registered agent row is never deleted. The only way out of service is **retirement (terminal)**
  or **suspension (reversible)**, each a Governance decision.
- Registration, mandate, lifecycle decisions and their audit rows are append-only. A mistaken
  registration is corrected forward (retire), never erased.
- A retired agent's name is free again for a new identity (uniqueness is among in-service rows only);
  the retired row and its lineage remain.
- Mandate revisions cannot be withdrawn; narrowing is a new revision.
- Code rollback below the release that adds the work-state chooser re-opens
  `WORK-UPDATE-AGENT-SELECTION-1` for the whole tenant while two agents serve: the affordance would
  refuse `ambiguous-durable-agent-identity`. Rollback with two agents in service is therefore a
  Director decision, preceded by suspending or retiring one agent.

End state left behind: Heby and Engineering Agent both in service, unplaced; Heby mandate rev 5,
Engineering Agent rev 1. Request `d288c6c9` approved and executed (work item `5ba33201`, planned).
Request `bb6e707e` (Heby) **pending, untouched** by Director instruction. Machine execution disarmed;
Hebun not enrolled; no standing envelope. Every Hebun origination surface now requires an explicit agent
choice.

## Director decisions

1. **A7 (2026-10-18): APPROVED** — composite evidence interpretation as stated in *A7*, with its
   evidence classes kept explicit; GIA-1 remains authoritative for internal attempt semantics; Heby's
   pending request neither executed nor rejected.
2. **Section 0 (2026-10-18): APPROVED IN PRINCIPLE** — the evidence classifications of A5–A12 and A14
   as documented, keeping production-verified, test-verified, Director-interpreted,
   documentation-pending and release-pending distinct. Not final AP-5 production acceptance.

Earlier, each separately: A1–A4, A13, A15 adopted as registration prerequisites and A2 read-only
evidence (2026-10-17); registration; mandate revision 1; A8/A9 read-only verification; PROBE 1, PROBE 1b,
PROBE 2 (one approval each); A7 lineage SQL; machine-safety SQL; authorization of `d288c6c9` (5-minute
permit); its execution; A11 acceptance SQL; closure-evidence SQL; historical-lineage SQL.

## Closure Contract (v1)

- Phase: AP-5
- Owner: Agent Platform acceptance — `hebun-ap5-two-agent-acceptance-contract.md`; seams: Agent Identity, Agent Mandate, Action Authorization, Governed Internal Action, Organizational Work
- Reached state: DEPLOYED
- Implementation commit: b57841190d0dccd249f116ae82902db73b4f7dea (WORK-UPDATE-AGENT-SELECTION-1, the one code prerequisite AP-5 named; AP-5 itself changed no code), on `main` in 250bf126bb2ec5de538cdcbd0004fe1aef6087ae
- Verification level: V3 — agent identity, Governance authority, tenant isolation and a production execution boundary
- Verification evidence: full suite at 250bf126 998 passed / 47 failed / 1045, baseline 1f8f9a47 996 / 47 / 1043, the same 47 files with identical first messages and no file failing only at release (2026-10-18); 48 AP-5 seam files exit 0 at 250bf126 (2026-10-18); production read-only SQL and UI reads as recorded above
- Test environment: worktree `.claude/worktrees/work-update-agent-selection-1` at 250bf126, `node scripts/run-tests.mjs` and per-file `node --import tsx`, disposable PostgreSQL 18 on 127.0.0.1:55433, `DATABASE_URL` unset; baseline worktree `.claude/worktrees/ap5-suite-baseline-1f8f9a47` (detached, shared node_modules, identical package files)
- Deployment evidence: dpl_476kC4ASTHZ4Lpt7ARLGmvcjeFui, production, READY, githubCommitSha 250bf126bb2ec5de538cdcbd0004fe1aef6087ae, aliased to www.hebuntech.com and hebuntech.com; the chooser code since dpl_9XejFBF38W1utxNs7bmdmWASXvYh (7ad5675b)
- Production acceptance evidence: N/A — final Director AP-5 production acceptance not yet taken; the production measurements it would rest on are recorded in this record
- Deferred risks: AP5-HEBY-DIRECT-LINEAGE-1 (DEFERRED); AP5-WORKSTATE-REASON-COPY-1 (DEFERRED); AP5-APPROVALS-RATIONALE-LABEL-1 (DEFERRED); EHO-1-RED-SUITE-BASELINE-1 (DEFERRED); WUAS-1-PROPOSAL-TEXT-UNVERIFIED-1 (DEFERRED)
- Director approvals: Decision 1 (A7) and Decision 2 (Section 0), 2026-10-18; every production write and read listed in *Director decisions*, each approved separately; preparation of this record (2026-10-18); commit, push and final production acceptance NOT approved

## Deferred risks

- **AP5-HEBY-DIRECT-LINEAGE-1 (DEFERRED)** — Heby's decision → permit → work links were not observed in
  the two-agent environment; A7 was accepted on the composite evidence of Decision 1 and this risk is
  non-blocking under that decision. Closes with the first Director-authorized Heby execution in a
  two-agent tenant, read back with its handoff.
- **AP5-WORKSTATE-REASON-COPY-1 (DEFERRED)** — the work-state chooser labels every non-eligible agent
  "not responsible for this work domain"; in production Engineering Agent is responsible for Engineering
  and is excluded for lacking `set-work-declared-state`. Authority is correct; the stated reason is not.
  Closes with a copy change that names the actual ceiling.
- **AP5-APPROVALS-RATIONALE-LABEL-1 (DEFERRED)** — `/approvals` titles every agent rationale "HEBY'S
  PROPOSAL RATIONALE", including the Engineering Agent's (the proposer line beside it is correct).
  Closes with a label that names the proposing agent.
- **EHO-1-RED-SUITE-BASELINE-1 (DEFERRED)** — owned by EAI-HISTORY-ORIGIN-1; restated here because AP-5's
  V3 comparison ran against it.
- **WUAS-1-PROPOSAL-TEXT-UNVERIFIED-1 (DEFERRED)** — owned by WORK-UPDATE-AGENT-SELECTION-1; it concerns
  the work-state affordance's result line. AP-5's successful proposals came from the organizational
  origination affordance, which named the chosen agent, so the work-state line is still unobserved.

Observations, not risks: Heby holds one pre-provenance agent request without an invocation id and one
whose invocation has no agent (both recorded before attribution existed; never backfilled by design).

## Three questions

1. **What did we learn?** Plurality was already in the authorities; the acceptance work was legibility
   and provenance. A record-work goal must describe planned work truthfully or a careful model will
   decline it, and a provenance link added later leaves earlier acts provable only by correlation.
2. **How does this improve Turkish Rug House?** Not directly; TRH keeps one agent. The same chooser,
   ceiling and lineage now carry a second agent the day TRH registers one.
3. **How does this become part of Hebun AI?** Hebun runs two durable agents with distinct ceilings in
   one tenant, each proposal attributable to the agent that made it, every act still authorized and
   executed by a human.
