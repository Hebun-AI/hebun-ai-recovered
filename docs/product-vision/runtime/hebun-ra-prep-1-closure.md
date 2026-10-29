# RA-PREP-1 · Research preparation seam · closure record · VERIFIED

Third package of the Research Agent. It makes `prepare-research-report` performable: one narrow server
seam asks every owning authority, sends the person's question through the existing model gateway under
the `research` purpose, and files the reply once as a `research-report` through a dedicated writer.
**Nothing in production can call it**: no route, server action or component imports the seam, no tenant
holds a research authorization, no `prepare-research` mandate exists, and the production provider
binding is unverified (GATE-D). Prepared ≠ authorized ≠ executed ≠ successful.

## Architecture decision record

| # | Question | Decision |
|---|---|---|
| 1 | Authoritative entrypoint | `assignResearchReport` in `features/agent-work/assign-research-report.server.ts`, beside `assignWorkDraft`. It owns nothing: no table, no state, no lifecycle. |
| 2 | Mandate and responsibility | The ONE shared ceiling: `eligibleAgents(…, CAPABILITY)` → `refuseOutsideAgentWorkCapability` → `refuseOutsideAgentPreparation` (`prepare-research` + responsibility for the work item's recorded scope). The agent id is a lookup key; authorship is minted by `resolveAgentAuthorship`. Asked again after the model, before filing. |
| 3 | Tenant research authorization | Twice, by the released authority, never restated: preflight `authorizeExternalAiDisclosure({purpose: research, dataClasses: [conversation]}, operator, modelId)` before the model (no message row, no dispatch); the gateway asks it again at dispatch with budget and cap. Assistance never stands in: the composer matches purpose and class exactly; no fallback exists. |
| 4 | Gateway contract | `answerHebyModelRequest`'s server-only options gain `dataUsePurpose?: "research"`. Set only by the research seam from the capability's declaration. Under it the request resolves no workspace source (no grounding read, cited, sent or persisted) and declares `purpose: research`; every other caller is byte-identical (`?? "assistance"`). Budget, dispatch cap, attestation, model identity, instruction channel and disclosure audit stay in `generateHebyModelAnswer`, unchanged. |
| 5 | Writer | `createResearchReportFromResearchPreparation` in the released writer module. Its input has no type field; the type is its constant and it chooses its own validator. Requires the branded agent authorship and a source message. Imported and called by the research seam alone (firewall F1). |
| 6 | Provenance | Existing columns, no migration: tenant and requesting person (`work_artifacts.tenant_id`, `created_by`), agent (`authored_by_actor_*`), capability (the type — one writer), provider/model/transport/correlation (the `messages` row via `source_message_id`), purpose and classes, tenant authorization and attestation revisions (the APF-5 disclosure audit row, joined by correlation id), time, `draft` status. The mandate revision in force is not stored on the row (RA-PREP-1-MANDATE-PROVENANCE-1). |
| 7 | Human revise | Closed at the writer: `appendRevision` reads the stored type under the artifact lock and refuses `artifact-type-not-revisable` for anything not a general type. Every reviser — human Operations, agent preparation, Heby workflow — goes through it. |
| 8 | Provider unavailable | Director control off → `refused / model-connectivity-disabled` before the model. Transport not configured, budget exhausted, cap reached, gateway data-use refusal → the answer flow's honest fallback → `not-prepared / no-model-answer` with its closed `modelFallback` code; nothing filed. |
| 9 | Not consequential | `PREPARATION_ONLY`: the seam imports no proposal, permit, decision, execution, evidence-link, transport or web-search module (firewall F3). The reply is untrusted data, filed verbatim, read by nothing that acts. Linking it to the work is the person's WEV-1 act; accepting it is Governance review. |
| 10 | Work preparation preserved | `prepareWorkArtifact` is byte-identical to 03817c82: the research seam restates its four filing rules (served model text, durable, not `max_tokens`, not `refusal`) by the same reason codes. A first cut shared them through a helper; five source-pinned suites (aor-1a, ca2, cgo9, output-integrity-1) went red, and that refactor was reverted rather than the pins moved. `eligibleAgents` defaults to the work-draft capability. Assistance callers unchanged (b2 boundary pin). |

## Unsourced

No source transport exists (RA-EAI-1-WEB-SEARCH-1) and nothing verifies a citation. The model is told
it writes an UNSOURCED RESEARCH DRAFT with no link, no citation and no organizational fact; a reply that
carries a link anyway is refused (`unsourced-link-in-output`), never trimmed. Every research report is
classified `RESEARCH_REPORT_SOURCING = "UNSOURCED RESEARCH DRAFT"` by its type (there is no other kind),
and the surface label reads "Unsourced research draft". A fake citation without a link is filed — as an
unsourced draft; the classification, not a parser, is the defence. The capability declaration now says
the question is its only input and that it cannot search, read records or cite.

## Verification (V3)

V3: a data-use purpose reaches the shared model gateway, the shared artifact writer changes for every
reviser, and an authority boundary (writer authority, human revise) moves.

| Check | Result |
|---|---|
| Baseline at 03817c82 (unchanged tree) | ra-auth-1, ra-eai-1, agent-execution-1, external-ai-data-use-b2, heby-workflow-1, content-agent-2, r3w-flow, rev2 PASS; r3w-flow/ambient-database-safety BLOCKED (canonical 55432 not running) |
| `tests/ra-prep-1/research-preparation-postgres.ts` | PASS — R1 authorized (1 dispatch, 1 report, agent author, message provenance live/model id, audit research × [conversation] under the tenant grant, wire carries the question and no earlier draft, work title or agent name) · R2 linked + Governance-accepted; human reviser `artifact-type-not-revisable`; general preparation seam, general writers refuse; a general draft still revises · R3 17 refusals, zero dispatch and zero writes · R4 client purpose/tenant/class ignored; research grant does not stand in for assistance · R5 injection grants nothing; link refused; fake citation filed as unsourced · R6 tenant isolation · R7 mandate withdrawn mid-call files nothing |
| `tests/ra-prep-1/research-firewall.ts` | PASS — F1 writer authority · F2 revise guard under lock · F3 reach · F4 purpose source · F5 order · F6 no surface · F7 unsourced |
| `tests/ra-prep-1/bite-proofs.ts` (disposable detached copy, restored and clean after) | 8/8 bite, 0 void — B1 revise guard removed · B2 research grounds on workspace sources · B3 gateway declares assistance · B4 preflight asks assistance · B5 preflight skipped · B6 link filed · B7 capability not re-asked · B8 general validator admits research-report |
| Pins moved (each names RA-PREP-1) | a12f770f: ra-auth-1 P5/P6 and ra-eai-1 E8/E10 (`no seam yet` → the seam); agent-execution-1 C4 (ceiling asked for the seam's capability); external-ai-data-use-b2 (purpose `options.dataUsePurpose ?? "assistance"`, option admits research only). THIS COMMIT, censuses the new seam legitimately joins, each widened by name: agent-runtime-0 (authorship resolver callers, and its M6 bite message), ama1 (mandate importers, 17 → 18), ama2 (mandate readers, 9 → 10), aor-1b (internal-draft mode setters), ap4b F1 (work-capability askers), external-ai-data-use-1a (authority importers), sci1 (instruction minters; the seam mints from `lines.join`) |
| Full suite run 1, `npm run test:run` at a12f770f, disposable detached copy, en_US.UTF-8 cluster | 1104/1124. 20 red: 15 REGRESSION of this phase, all test-side — 9 census/pin files (+ the bite-proofs whose baseline is that firewall) and 5 source pins broken by the shared-helper refactor; fixed in THIS COMMIT (refactor reverted, censuses widened). 3 PRE-EXISTING environmental (hlr legibility-postgres, hlr bite-proofs, work2-provider-disclosure bite-proofs: collation; base 03817c82 fails the same on the en_US cluster, and base and candidate both PASS on a C-locale cluster). r3w ambient BLOCKED. apf5 bite B5 missed only because eai-1a's census was red; PASS once fixed |
| Full suite run 2, at a12f770f + THIS COMMIT's src/tests, same copy, C-locale cluster | 1122/1124, tree unchanged after. 2 red: agent-runtime-0/bite-proofs — M6 bit but matched the old firewall message, message updated in THIS COMMIT, then PASS (7 bit, 2 tolerated, 0 void); r3w-flow/ambient-database-safety BLOCKED (canonical 55432 not running; not a pass). **0 REGRESSION** |
| `tsc --noEmit` | 0 |
| `eslint` on every changed source and test file | 0 errors; 1 pre-existing warning (sci1 unused `hebunInstruction` import, untouched line) |
| `next build` (disposable detached copy, real node_modules directory) | exit 0 |
| `git diff --check` | clean |

## Closure Contract (v1)

- Phase: RA-PREP-1
- Owner: features/agent-work (research seam) + features/work-artifacts (research writer, revise guard) + features/heby-answer (research purpose option)
- Reached state: VERIFIED
- Implementation commit: a12f770f, THIS COMMIT (closure record, roadmap rows, learning)
- Verification level: V3 — data-use purpose through the shared gateway, shared artifact writer, writer and revise authority boundary
- Verification evidence: 2026-10-29; ra-prep-1 research-preparation-postgres (R1–R7) and research-firewall (F1–F7) PASS; bite-proofs 8/8, 0 void; full suite run 2 1122/1124 with 0 REGRESSION (agent-runtime-0 bite message fixed and PASS; r3w ambient BLOCKED); 3 collation reds PRE-EXISTING and PASS on a C-locale cluster at base and candidate; tsc 0; eslint 0 errors; next build exit 0 at a12f770f; git diff --check clean; continuity closure-contract PASS
- Test environment: worktree .claude/worktrees/ra-prep-1 and disposable detached worktree full-a12f770f (scratchpad, real node_modules via APFS clone); session-created PostgreSQL 18 clusters on 127.0.0.1:55494 (en_US.UTF-8, system_identifier 7702077506908358914) and 127.0.0.1:55495 (C locale, system_identifier 7702091228980822985); baseline disposable detached copy base-03817c82; macOS Darwin 25.2.0, Node 24.16.0
- Deployment evidence: N/A
- Production acceptance evidence: N/A
- Deferred risks: RA-AUTH-1-HUMAN-REVISE-1 (CLOSED); RA-PREP-1-NO-SURFACE-1 (DEFERRED); RA-PREP-1-RESEARCH-REVISE-1 (DEFERRED); RA-PREP-1-MANDATE-PROVENANCE-1 (DEFERRED); RA-PREP-1-CONCURRENT-DISPATCH-1 (DEFERRED); RA-EAI-1-WEB-SEARCH-1 (DEFERRED); RA-AUTH-1-AUTH-RUNTIME-1 (DEFERRED); GATE-D-PROVIDER-RECONCILIATION-1 (BLOCKED)
- Director approvals: implementation, local verification and local implementation commit on feat/ra-prep-1, 2026-10-29 ("RA-PREP-1 — SECURE RESEARCH PREPARATION SEAM IMPLEMENTATION"); no push, migration, deployment, provider call, tenant authorization or Governance approval was authorized or made

### Deferred risk detail

- **RA-AUTH-1-HUMAN-REVISE-1 (CLOSED).** Closed in code at a12f770f: the writer's `appendRevision` reads the
  stored type under the artifact lock and refuses `research-report` for every reviser (postgres R2, bite
  B1). It reaches production in the same release as the research writer, the only thing that could make it
  reachable.
- **RA-PREP-1-NO-SURFACE-1 (DEFERRED).** No route, server action or component calls `assignResearchReport`
  (firewall F6). A person cannot ask for research until a surface is added by its own Director decision.
- **RA-PREP-1-RESEARCH-REVISE-1 (DEFERRED).** A research report takes no revision from anyone. A Governance
  change request on one can be answered only by a new report. A research reviser (agent, under
  `prepare-research`) is a separate decision.
- **RA-PREP-1-MANDATE-PROVENANCE-1 (DEFERRED).** The mandate revision in force when the report was filed is
  not stored on the revision. It is reconstructable from the append-only mandate history by time; storing it
  needs a migration, not made here.
- **RA-PREP-1-CONCURRENT-DISPATCH-1 (DEFERRED).** Unlike `assignWorkDraft`, the research seam takes no
  per-(work, agent) advisory lock: two simultaneous requests both dispatch and both file. Bounded by the
  persistent dispatch cap and the process budget.
- **RA-EAI-1-WEB-SEARCH-1 (DEFERRED)**, **RA-AUTH-1-AUTH-RUNTIME-1 (DEFERRED)**, **GATE-D-PROVIDER-RECONCILIATION-1
  (BLOCKED)** — owned by their phases, unchanged here. GATE-D blocks any production research execution.

## Production release needs (Director gates)

1. Push and deployment of `feat/ra-prep-1` (no migration: ledger stays 83).
2. GATE-D-PROVIDER-RECONCILIATION-1 closed before any production research call.
3. A tenant research authorization through Governance, and a `prepare-research` mandate, each its own decision.
4. A surface (RA-PREP-1-NO-SURFACE-1) — until then the seam is unreachable in production.
