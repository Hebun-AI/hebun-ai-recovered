# HEBY AI PLANNING · PHASE 1 · secure multi-step AI planning · closure record · DESIGN ONLY

This phase designs how Heby could reason with a model over real Work and Organization records. Nothing
is implemented. No policy, tenant authorization, arming, provider call, schema or migration changed.
The released `/plan` (877514de, a6b5cfa0, 64ffae70) stays rule-based and its surface keeps saying
"No model wrote this plan". Every statement below about the repository was read from the code at
`ebe6df78`, which is `origin/main` (`64ffae70`) plus the HEBY-NL-ACTION-PLANNING closure record.

## 1 · Repository reality (2026-10-13)

| Fact | Measured |
|---|---|
| `origin/main` | `64ffae700d95975aacbea73ad07c5570285ba52c` (`git ls-remote`) |
| Production | Vercel `dpl_J6wo4XGH32cpf22UNr9qfskimcPi`, hebun-ai-recovered, production, READY: the newest production deployment in `vercel ls --prod`, and the id the HEBY-NL-ACTION-PLANNING record names with meta commit 64ffae70. The commit was not re-read from the deployment in this phase. |
| `ebe6df78` | One documentation commit on top of `64ffae70`, a fast-forward, on `docs/heby-nl-action-planning-closure` (worktree `nl-plan`). Not pushed. |
| Primary tree | `main` at `b18cb693`, 9 commits behind `origin/main`, untracked files only. Instructions (`CLAUDE.md`, `hebun-loop.md`, `docs/MASTER-ROADMAP.md`) are identical to `origin/main`. Not touched by this phase. |
| This phase | Worktree `.claude/worktrees/heby-ai-planning-phase1`, branch `docs/heby-ai-planning-phase1`, from `ebe6df78`. |

Seeded and mock planning are out of scope and must stay unreachable from any design below:
`features/planning/*` (static `reasoningScenarios` → `governanceResults`), `features/task-planning/*`
(seeds from `@/features/agents/mock`), `features/execution-bridge/command-plan.ts`,
`features/orchestration/handoff-planner.ts` and the `goals` table.

## 2 · Existing authority, reused as it stands

| Need | Authority that already owns it | Where |
|---|---|---|
| Work records | Organizational Work Authority, `readWorkRegister` → `WorkItemView` | `features/organizational-work/read-work.server.ts:174` |
| Departments | Organization Authority, `readOrganizationAuthority` (its one read seam) | `features/organization-authority/read-organization.server.ts:100` |
| What may cross to a model | EXTERNAL-AI-DATA-USE: platform policy × processor attestation × tenant authorization × operator control, composed fail-closed | `features/external-ai-data-use/*` |
| The one model dispatch | `generateHebyModelAnswer`, which runs the EAI gate for every real Anthropic egress and writes the decision to `audit_log` | `features/heby-model/heby-model-generation.server.ts:109` |
| Strict structured output | `validateClaudeStructuredResponse` (fails closed on `max_tokens`, refusal, non-object) and the whole-response, no-repair, exact-membership parser pattern of `parseAgentActionSelection` | `features/heby-model/claude-structured-response-validator.ts:50`, `features/agent-origination/structured-output.ts:121` |
| Deterministic plan | `composeActionPlan` (Fact / Derived / Unavailable / Recommendation lines) | `features/heby-commands/action-plan.ts` |

**What the EAI authority says today.** `RECORDED_PLATFORM_DISCLOSURE_POLICY` allows six cells, all on
`anthropic/messages`: `assistance` × {conversation, knowledge, work-artifact} (B1D) and
`agent-origination` × {conversation, organization, knowledge} (APF-3, WF-3B). Every other cell is
UNKNOWN, and UNKNOWN refuses exactly like DENIED. So `assistance × operational-record` and
`assistance × organization` refuse. The Heby grounding projection (`model-facing-projection.ts:45`)
discloses only `knowledge`, `knowledge-coverage` and `work-artifacts`; the `work` source is replaced by
the fixed line "withheld — not disclosed to the external model". Only the `hebun` tenant holds an
authorization (revision 3 `b2de774d`); Turkish Rug House and Mulify hold none. The processor
attestation in force is `ffb0c160` revision 1: training none, retention bounded-30-days, ZDR not
enabled, identity **attested, not verified**, model ids `claude-haiku-4-5-20251001` only.

**What the records hold.** `WorkItemView` has `workItemId`, `title`, `declaredState`
(planned | active | blocked | complete), `lifecycleStatus`, `inService`, `department`,
`accountableActorId`, `accountableCurrentlyActiveMember`, `recordedAt`, `updatedAt`. There is **no
deadline, due date, estimate or work-to-work dependency** anywhere in Work. WEV-1
`work_evidence_references` links work to Knowledge facts and Work Artifacts, never to other work.
Dependency evidence is therefore UNAVAILABLE for every item, not merely absent from the projection.

## 3 · Minimum disclosure contract

The question: what is the least a model must receive to reason in more than one step over this
organization's work?

| Candidate | Decision | Why |
|---|---|---|
| Department scope | **Not sent** | The server resolves the department (`resolvePlanDepartment`) and filters before projection. The model reasons inside one scope it does not need to name. The surface names it from the server's own read. This removes the `organization` class from the request entirely. |
| Work item identity | **Invocation-local alias** `W1..Wn` | Never `workItemId`. Aliases are mapped back on the server only. |
| Title | **Sent only under decision D3** | Without titles the model sees only states and flags, which the three deterministic rules already rank. That is no reasoning worth a disclosure. With titles it can group and sequence. Titles are human-authored free text and are not claimed free of personal data; they pass through `minimizeModelFacingText` (UUIDs and addresses withheld) and are capped at 200 code points. |
| Declared state | Sent | The four-value enum. |
| Assignment presence | Sent as one boolean `accountable: true/false` | Never the actor id, never a name, never whether that person is still an active member. |
| Staleness | Sent as one boolean `stale` | Derived on the server from `updatedAt` (30-day rule of `/plan`). The timestamp itself is not sent. |
| Dependency evidence | **Not sent; none exists** | Rendered UNAVAILABLE by the server. |
| Retired items, `recordedAt`, `updatedAt`, department ids, tenant id, user text, history, Knowledge, artifacts, evidence references | Not sent | Not needed for the reasoning; each would be another class or another identifier. |

Bound: at most 40 in-service items per request; above that the request is refused with a stated
reason rather than truncated silently.

**Derived data is disclosed data.** The `stale` flag and any count are facts about the organization's
records, computed or not. They travel under the same data class as the records they come from and
under the same authorization. The design never labels a derived value as harmless.

**Which data class.** The data classes are named "by the authority that owns" the records
(`contracts.ts`). Work items are owned by the Organizational Work Authority. Of the existing classes:

- `work-artifact` is the Work **Artifacts** authority. Using it for work items would be a widening
  nobody decided. Rejected.
- `organization` is the Organization Authority's structure. Not what is sent once the department is
  resolved on the server.
- `operational-record` exists in the vocabulary, in both CHECK constraints and in the tenant ceremony,
  and is mapped to **no** source today. It carries no written definition. It is the right existing
  class, and no new class is proposed, provided its meaning is fixed in writing first (decision D2).

The request then declares exactly one class: `operational-record`.

## 4 · Authorization design (EAI-B2 authority, no new authority)

**The purpose.** The Director brief forbids widening the general assistance permission. A platform
cell `anthropic/messages × assistance × operational-record` would do exactly that: the policy has no
capability dimension, so every assistance caller could declare it, and only a code census would stop
them. Two ways exist; both stay inside the one EAI authority:

| | A — new purpose `work-planning` (recommended) | B — `assistance × operational-record` |
|---|---|---|
| Capability-specific | Yes, in the authority's own data: the tenant agrees to planning separately from assistance | Only by an importer census test |
| Widens assistance | No | Yes, at the policy level |
| Schema | One migration: the purpose CHECK on `tenant_ai_data_use_scopes` and wherever else `EXTERNAL_AI_PURPOSES_SQL` is inlined, plus `PURPOSES` in `contracts.ts` | None |
| Tenant | A new ceremony revision carrying the union of the current scopes and `work-planning × operational-record` | Same |

**Tenant-scoped explicit authorization.** Unchanged mechanism: the human-only ceremony
`platform:tenant-external-ai-data-use` writes a new append-only revision bound to the attestation in
force and a Governance decision. The tenant writer re-checks the platform policy and refuses a pair it
does not allow. The ceremony's `EXPECTED_DATA_CLASSES` gains the pair under an explicit flag, the way
`--agent-origination` was added.

**Processor attestation.** The new cell uses `ANTHROPIC_ASSISTANCE_BOUNDS` unchanged and attestation
`ffb0c160`. A model other than `claude-haiku-4-5-20251001` is refused `model-not-attested` per call.
An attestation that widens past the bounds makes the tenant's authorization `authorization-stale`.

**Revocation.** A tenant withdrawal is a new `withdrawn` revision; the next request refuses
`tenant-withdrawn`. Removing the platform cell is a reviewed code change; the next request refuses
`platform-unknown`. The R2E operator control pauses all egress (`operator-paused`). No cached
authorization exists to outlive any of these.

**Fail-closed.** Any unreadable input to the composition is `unavailable`. The planning surface then
shows the released rule-based `/plan` with one line saying the AI plan was not prepared and why, in
the disposition's own words. It never shows a partial AI plan.

**Auditability.** Unchanged: every decision, allowed or refused, is an `audit_log` row
(`external-ai.disclosure.authorized` / `.refused`) with classes, model, disposition and revisions, and
an allowed decision whose row cannot be written is not sent.

## 5 · Model reasoning boundary

```
readOrganizationAuthority ──► resolve department (server)          ┐
readWorkRegister ───────────► filter: tenant, department, inService ├─ authoritative reads, session tenant only
                               │
                               ▼
projectPlanningInput  ──► { W1..Wn: title?, state, accountable, stale }   declares ["operational-record"]
                               │                                          purpose work-planning (D1)
                               ▼
generateHebyModelAnswer ──► EAI gate ─► audit row ─► Anthropic (attested model only)
                               │
                               ▼
validateClaudeStructuredResponse ─► parsePlanningSteps (whole response, no repair)
                               │
                               ▼
evidence validation ──► every alias ∈ candidate set; every cited fact true in the projection
                               │
                               ▼
render (server) ──► FACT · DERIVED · RECOMMENDATION · UNAVAILABLE      read-only, nothing persisted
```

**Output contract.** The model returns only:

```
{ "steps": [ { "order": 1..10,
               "move": "unblock" | "find-accountable-owner" | "review-stale" | "confirm-state" | "sequence-after",
               "items": ["W3", "W7"],                 // non-empty, each in the candidate set
               "because": ["blocked" | "no-accountable" | "stale" | "planned" | "active"],
               "after": "W2" | null } ] }             // a suggested order, never a dependency
```

There is no free-text field. Every `because` code is checked against the projection for every named
item; one false code refuses the whole plan. There is no field in which a deadline, a person, an
assignment, a dependency or an outcome could be stated, so none can be invented. The model cannot
write: the path has no Work writer, no Governance writer, no proposal inlet and no permit.

**What the model is not.** Not Work Authority (nothing it returns is written). Not Governance
Authority (nothing it returns is a decision or a proposal). Not Execution Authority (no action kind,
permit or arming is reachable). It does not receive data the policy does not allow, because the
projection declares exactly the class it renders and the gate refuses anything undeclared.

**Rendering, by provenance.** The server writes every line:

| Label | Source | Example |
|---|---|---|
| FACT | The register, read now | "3 items in service; 1 declared blocked." |
| DERIVED | The server's own computation from the register | "2 open items not updated in 30 days or more." |
| RECOMMENDATION | A validated model step, aliases mapped back to titles by the server | "Recommendation 1 — unblock 'Supplier contract' before 'Q4 catalog'. Suggested order only; Hebun records no dependency between them." |
| UNAVAILABLE | A measured absence | "Deadlines: unavailable — no due dates exist." "Dependencies: unavailable — Work records none." "Who should own it: unavailable — Heby does not assign." |

## 6 · Autonomous execution readiness (nothing is armed; nothing below is enabled by this phase)

| Mechanism | State in the repository | Production state as last recorded |
|---|---|---|
| Standing authorization (RUNG 2) | `standing_mutation_authorizations`, kind fixed to `record-work` by a DB check; authorizes permit issuance, never execution | Executed once (permit `b9afaebf`); envelope withdrawn (revision 4). No active envelope. |
| Machine execution arming | `provider_connectivity_controls` key `machine-internal-execution`; production-only CLI `platform:machine-execution` | DISARMED, v8. No arm history is kept (deferred in the RUNG 2 record). |
| Permit lifecycle (R3A) | `heby_action_requests` → `action_permits` (`active | consumed | revoked`, expiry derived from `expires_at`, TTL 60 s–24 h); a human-authorizer DB check; single atomic consume; revoke needs a Governance decision | Live |
| Human oversight | Request → human Governance decision in Approvals → single-use permit → human Execute or machine delivery | Live |
| Agent origination | Kinds `send` and `record-work` only; origination asks, never executes | APF-3 accepted at a PENDING request, no execution |
| Containment | Mandate withdrawal, org suspension and root disarm stop issuance and delivery (APF-1) | Released; an envelope withdrawal does not void permits it already issued |
| Outcome verification | `read-governed-work-outcomes.server.ts` maps a permit's handoff to its `work.recorded` audit row | Implemented on `main`; no closure record |

**What the next phase could run safely, with what exists.**

- A plan step may become a **proposal** through the released origination path: Heby originates a
  `record-work` request, which stops at PENDING. A human decides it in Approvals; a human executes it,
  or machine delivery spends the permit only if the Director arms the root and an envelope or a human
  permit exists. Every one of those steps is production-accepted on its own.
- **No plan move is executable as such.** "Unblock", "find an accountable owner", "review stale" and
  "confirm state" change an existing work item. No governed action kind updates, reassigns or
  re-states a work item (`heby-actions/contracts.ts` lists record-work, place-human-in-department,
  send-external-communication, publish-instagram-media, publish-youtube-video). Those moves stay human
  work on the Work surface until a Work update kind is designed, which is its own phase.
- Unattended runs today are observation reads only. **Autonomous execution is not available.**

## 7 · Security risks

1. **Prompt injection through titles.** Titles are tenant-authored data rendered as data. The closed
   output contract limits a successful injection to a wrong ordering of real items; it cannot add a
   claim, a person, a date or an action. The validator, not the prompt, is the boundary.
2. **Personal data in titles** (`AI-PLAN-TITLE-PII-1`). Minimization removes UUIDs and addresses, not
   names or other personal text. Disclosure happens under an attestation that is attested, not
   verified, without ZDR, with 30-day retention.
3. **Indirect profiling** (`AI-PLAN-INDIRECT-PROFILING-1`). In a small department, "not accountable"
   and "stale" flags plus a title can point at one person without naming them. The surface must not
   rank people, and the output contract has no person field.
4. **Purpose drift.** Under option B any assistance caller could declare `operational-record`.
   Option A removes this at the authority; option B needs an importer census pin.
5. **Silent fallback.** A refused or invalid AI plan must say so; showing the rule-based plan without
   the line would let a reader think the model agreed.
6. **Execution coupling later.** The arming control keeps no history, and envelope withdrawal leaves
   issued permits spendable (APF-1). Neither is touched here; both matter the day a plan step is wired
   to origination.

## 8 · Required Director decisions

| ID | Decision | Recommendation |
|---|---|---|
| D1 | Purpose: new `work-planning` (one migration) or `assistance × operational-record` (no migration, widens assistance) | `work-planning` |
| D2 | Fix the meaning of `operational-record` as "records owned by the Organizational Work Authority (`work_items`) and values derived from them" | Yes |
| D3 | Whether work titles cross, minimized and capped | Yes, otherwise the model adds nothing over the rules |
| D4 | The platform ALLOW cell `anthropic/messages × work-planning × operational-record`, bounded by `ANTHROPIC_ASSISTANCE_BOUNDS` and attestation `ffb0c160` (attested, not verified) | Yes, with risks 2 and 3 accepted in writing |
| D5 | Which tenant first | `hebun` first; Turkish Rug House only by its own ceremony after a hebun production acceptance |
| D6 | Production acceptance with one real, billable provider call | At acceptance time, a separate gate |

## 9 · Narrowest implementation path

1. **EAI-PLAN-1** (V3: schema and provider boundary). After D1, D2 and D4: the purpose migration,
   `PURPOSES`, the recorded cell and its evidence string, the ceremony flag, and the existing EAI
   suites (`external-ai-data-use-1a`, `-b1d`, `-b2`, `-tenant-ceremony`) extended. Inert: no caller
   declares the purpose.
2. **HEBY-AI-PLAN-1** (V3: provider boundary). `projectPlanningInput`, `parsePlanningSteps`, the
   evidence validator and the renderer under `features/heby-commands/`, reached by an explicit
   request on the `/plan` surface, never by default. Fake-transport tests; a whole-request absence
   proof (no UUID, address, actor id, timestamp or department id anywhere in the serialized request);
   bite-proofs for a foreign alias, a false `because`, a free-text field, `max_tokens`, and every
   refusal disposition rendering the rule-based plan with its reason.
3. **Ceremonies** (Director). Tenant authorization for `hebun`; production acceptance with one call.

No new agent framework, authority, table or provider is introduced at any step.

**Next executable engineering step.** Before any decision, only inert work is possible: the pure
`projectPlanningInput` and `parsePlanningSteps` with their tests, wired to nothing and declaring no
purpose. Everything that discloses waits for D1–D4.

## Closure Contract (v1)

- Phase: HEBY-AI-PLANNING-PHASE-1
- Owner: EXTERNAL-AI-DATA-USE authority (`apps/dashboard/src/features/external-ai-data-use`) for the disclosure design; `apps/dashboard/src/features/heby-commands` for the planning boundary
- Reached state: DESIGN ONLY
- Implementation commit: N/A — design only; no code changed
- Verification level: V0 — documentation only; `git diff --check` and the continuity test, because this record and §21/§22 rows are added
- Verification evidence: N/A — design only; the repository facts above were read from code at ebe6df78 and from `git ls-remote` / `vercel ls --prod`
- Test environment: N/A — design only
- Deployment evidence: N/A — not deployed
- Production acceptance evidence: N/A — design only
- Deferred risks: AI-PLAN-TITLE-PII-1 (DEFERRED); AI-PLAN-INDIRECT-PROFILING-1 (DEFERRED)
- Director approvals: this design, its documentation and a focused local commit (CONTROLLED AGENT REASONING · PHASE 1 brief, 2026-10-13); push, deploy, policy change, tenant authorization, arming and provider calls NOT approved
