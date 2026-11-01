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
| 2 | Mandate and responsibility | The ONE shared ceiling: `eligibleAgents(…, CAPABILITY)` → `refuseOutsideAgentWorkCapability` → `refuseOutsideAgentPreparation` (`prepare-research` + responsibility for the work item's recorded scope). The agent id is a lookup key; authorship is minted by `resolveAgentAuthorship`. The authorizing mandate REVISION is read once before the model and re-read inside the filing transaction (see Mandate provenance). |
| 3 | Tenant research authorization | Twice, by the released authority, never restated: preflight `authorizeExternalAiDisclosure({purpose: research, dataClasses: [conversation]}, operator, modelId)` before the model (no message row, no dispatch); the gateway asks it again at dispatch with budget and cap. Assistance never stands in: the composer matches purpose and class exactly; no fallback exists. |
| 4 | Gateway contract | `answerHebyModelRequest`'s server-only options gain `dataUsePurpose?: "research"`. Set only by the research seam from the capability's declaration. Under it the request resolves no workspace source (no grounding read, cited, sent or persisted) and declares `purpose: research`; every other caller is byte-identical (`?? "assistance"`). Budget, dispatch cap, attestation, model identity, instruction channel and disclosure audit stay in `generateHebyModelAnswer`, unchanged. |
| 5 | Writer | `createResearchReportFromResearchPreparation` in the released writer module. Its input has no type field; the type is its constant and it chooses its own validator. Requires the branded agent authorship and a source message. Imported and called by the research seam alone (firewall F1). |
| 6 | Provenance | Existing columns, no migration: tenant and requesting person (`work_artifacts.tenant_id`, `created_by`), agent (`authored_by_actor_*`), capability (the type — one writer), provider/model/transport/correlation (the `messages` row via `source_message_id`), purpose and classes, tenant authorization and attestation revisions (the APF-5 disclosure audit row, joined by correlation id), time, `draft` status. The mandate revision: one `work-artifact.research-report.filed` row in the existing append-only `audit_log`, written on the report's own filing transaction (no migration). |
| 7 | Human revise | Closed at the writer: `appendRevision` reads the stored type under the artifact lock and refuses `artifact-type-not-revisable` for anything not a general type. Every reviser — human Operations, agent preparation, Heby workflow — goes through it. |
| 8 | Provider unavailable | Director control off → `refused / model-connectivity-disabled` before the model. Transport not configured, budget exhausted, cap reached, gateway data-use refusal → the answer flow's honest fallback → `not-prepared / no-model-answer` with its closed `modelFallback` code; nothing filed. |
| 9 | Not consequential | `PREPARATION_ONLY`: the seam imports no proposal, permit, decision, execution, evidence-link, transport or web-search module (firewall F3). The reply is untrusted data, filed verbatim, read by nothing that acts. Linking it to the work is the person's WEV-1 act; accepting it is Governance review. |
| 10 | Work preparation preserved | `prepareWorkArtifact` is byte-identical to 03817c82: the research seam restates its four filing rules (served model text, durable, not `max_tokens`, not `refusal`) by the same reason codes. A first cut shared them through a helper; five source-pinned suites (aor-1a, ca2, cgo9, output-integrity-1) went red, and that refactor was reverted rather than the pins moved. `eligibleAgents` defaults to the work-draft capability. Assistance callers unchanged (b2 boundary pin). |

## Mandate provenance (release-readiness review, 2026-10-29)

**Finding: a real gap, fixed without a migration (decision B).** Mandate identity ≠ mandate revision
identity. Before the fix the report named its agent but not the revision. Reconstruction "by time" compared
two application clocks (`agent_mandates.effective_from` — `establish-agent-mandate.server.ts`, `new Date()`;
`work_artifact_revisions.created_at` — the writer's `new Date()`), possibly on different server instances,
and the final mandate check ran outside the filing transaction, so a revision could land between check and
insert. That is a guess, not a record.

| Question | Answer (code) |
|---|---|
| Owner | Agent Mandate Authority (`agent-mandate/establish-agent-mandate.server.ts`, read seam `read-agent-mandate.server.ts`) |
| Append-only, immutable id | Yes: one row per revision, `id` uuid, `(tenant_id, agent_id, mandate_revision)` unique, effective = max revision (`db/schema/agent-mandate.ts`); withdrawal is a new revision |
| Timestamps | `effective_from` and the revision's `created_at` are application clocks — not a join key |
| Re-validated during preparation | Now inside the filing transaction (below) |

**The fix.** The seam reads the effective revision once, before the model, and asks the ceiling of that
read (`mandateId`, `mandateRevision`). The research writer now REQUIRES a filing condition, which it runs on
its creating transaction: the seam re-reads the effective mandate on that transaction, files only if it is
still the same revision and its ceiling still admits the work, and appends
`work-artifact.research-report.filed` (tenant, person, artifact, revision 1, agent, `mandateId`,
`mandateRevision`, capability, purpose, source message, correlation id, `sourcing: unsourced`) through a new
audit sibling `governance-audit/research-report-audit.server.ts` on the same transaction. The row is not
best-effort: a failure rolls the report back. A new revision landing mid-call — even one that still admits
research — files nothing (`agent-mandate-changed-while-preparing`). Reconstruction is a join:
`audit_log.metadata->>'mandateId'` → one immutable `agent_mandates` row → its Governance decision (R8b).
Remaining window: READ COMMITTED — a revision committed between the in-transaction read and COMMIT is not
seen; the row still states exactly which revision the filing transaction read.

## Time of check / time of use

| Change | Stops a new dispatch? | Stops filing? | Evidence |
|---|---|---|---|
| Mandate withdrawn before preparation | Yes — refused before the model | — | R8e |
| Mandate withdrawn or revised during the call | — (already sent) | Yes — revision re-read in the filing transaction | R7, R8c |
| Mandate changed after filing | Next request | Report and its row unchanged | R8a, R8d |
| Governance authority lost during the call | — | Yes — asked again before filing (`governance-authority-changed-while-preparing`) | R9a |
| Tenant research scope withdrawn during the call | Next request (R3 last) | No — disclosure is decided at dispatch; filing discloses nothing new | R9d |
| Provider control off / transport gone | Yes — preflight and gateway | Nothing to file | R3 |
| Two simultaneous requests, one revision | Each admitted by the cap separately | Each files under the same revision | R9b, R9c |

A call that happened but was not filed stays visible: its message row and its
`external-ai.disclosure.authorized` row remain; no `research-report.filed` row exists (R7, R8c, R9a).
Dispatch is not filing authority.

## Concurrent dispatch (RA-PREP-1-CONCURRENT-DISPATCH-1)

| | |
|---|---|
| Severity | Low — cost/duplication only |
| Exploitability | Needs a caller with Governance authority and an eligible research agent; no such caller exists (no surface) |
| Current exposure | None: no route, action or component imports the seam (F6); no production research grant or mandate |
| Existing controls | Each request passes every gate itself; the persistent per-tenant dispatch cap admits in a locked transaction (R9c: one of two racing requests); the process budget; each report files under its own checked revision (R9b) |
| Authorization bypass / tenant isolation | None found |
| Idempotency | A resubmitted request is a second request: a second dispatch and a second report |
| Same in work preparation? | No — `assignWorkDraft` holds a per-(work, agent) advisory lock and an open-draft rule |
| Required before activation | Decide whether a surface needs the same per-(work, agent) lock or an open-report rule; until a surface exists nothing can trigger it |

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
| `tests/ra-prep-1/research-firewall.ts` | PASS — F1 writer authority · F2 revise guard under lock · F3 reach · F4 purpose source · F5 order (authorizing revision before the model; Governance after; mandate re-read and provenance row inside the filing transaction) · F6 no surface · F7 unsourced · F8 writer runs the condition on its transaction, research writer requires one, row not best-effort |
| Release-readiness additions to the postgres suite | PASS — R1 provenance row (exact metadata, correlation = the dispatch's) · R8a–e mandate provenance · R9a–d time of check / use and concurrency |
| `tests/ra-prep-1/bite-proofs.ts` (disposable detached copy, restored and clean after) | 8/8 bite, 0 void — B1 revise guard removed · B2 research grounds on workspace sources · B3 gateway declares assistance · B4 preflight asks assistance · B5 preflight skipped · B6 link filed · B7 capability not re-asked · B8 general validator admits research-report |
| Pins moved (each names RA-PREP-1) | a12f770f: ra-auth-1 P5/P6 and ra-eai-1 E8/E10 (`no seam yet` → the seam); agent-execution-1 C4 (ceiling asked for the seam's capability); external-ai-data-use-b2 (purpose `options.dataUsePurpose ?? "assistance"`, option admits research only). THIS COMMIT, censuses the new seam legitimately joins, each widened by name: agent-runtime-0 (authorship resolver callers, and its M6 bite message), ama1 (mandate importers, 17 → 18), ama2 (mandate readers, 9 → 10), aor-1b (internal-draft mode setters), ap4b F1 (work-capability askers), external-ai-data-use-1a (authority importers), sci1 (instruction minters; the seam mints from `lines.join`) |
| Full suite run 1, `npm run test:run` at a12f770f, disposable detached copy, en_US.UTF-8 cluster | 1104/1124. 20 red: 15 REGRESSION of this phase, all test-side — 9 census/pin files (+ the bite-proofs whose baseline is that firewall) and 5 source pins broken by the shared-helper refactor; fixed in THIS COMMIT (refactor reverted, censuses widened). 3 PRE-EXISTING environmental (hlr legibility-postgres, hlr bite-proofs, work2-provider-disclosure bite-proofs: collation; base 03817c82 fails the same on the en_US cluster, and base and candidate both PASS on a C-locale cluster). r3w ambient BLOCKED. apf5 bite B5 missed only because eai-1a's census was red; PASS once fixed |
| Full suite run 2, at a12f770f + THIS COMMIT's src/tests, same copy, C-locale cluster | 1122/1124, tree unchanged after. 2 red: agent-runtime-0/bite-proofs — M6 bit but matched the old firewall message, message updated in THIS COMMIT, then PASS (7 bit, 2 tolerated, 0 void); r3w-flow/ambient-database-safety BLOCKED (canonical 55432 not running; not a pass). **0 REGRESSION** |
| Full suite run 3, ccb2c35f + the provenance change (first cut), C-locale cluster | 1115/1124, tree unchanged. REGRESSION, test-side, fixed before run 4: g1/g2/k2 audit-sink censuses (new sibling named), eai-1a (the audit module imported the EAI `Purpose` type — replaced by the capability's own type), agent-runtime-0 M1 anchor (the filing condition moved before the revision insert so the anchor stays contiguous), apf5 B5 (downstream of eai-1a). VOID by timeout, PASS in run 4: instagram-analytics and instagram-approval-preview-1 bite-proofs. PRE-EXISTING: plan-step-idempotency-1 bite-proofs. BLOCKED: r3w |
| Full suite run 4, final candidate (ccb2c35f + THIS COMMIT's src/tests), C-locale cluster | **1121/1124 — not a full PASS.** Tree unchanged after. 3 red: k2-flow/create-and-read-postgres "exactly one creation won" — intermittent race, touches no RA-PREP-1 file, 5/5 PASS at base and 5/5 at candidate re-run (flake, not reproduced); plan-step-idempotency-1/bite-proofs — PRE-EXISTING, base 03817c82 F P P, candidate P P P; r3w-flow/ambient-database-safety — BLOCKED (canonical 55432 not running; not run, not a pass). 0 REGRESSION. ra-prep-1 bite-proofs 11/11 bit, 0 void |
| agent-runtime-0/bite-proofs after its message fix (run 2 era) | targeted PASS, 7 bit, 2 tolerated, 0 void — recorded separately from the suite count |
| Collation | Repository evidence: `governance-decision/authority-delegation.server.ts` sorts in SQL (`order by label`); `hlr-human-legibility/legibility-postgres.ts` expects code-point order. The suite therefore needs a C (byte-order) collation cluster; runs 2–4 used `initdb -E UTF8 --locale=C` |
| `tsc --noEmit` | 0 |
| `eslint` on every changed source and test file | 0 errors; 1 pre-existing warning (sci1 unused `hebunInstruction` import, untouched line) |
| `next build` (disposable detached copy, real node_modules directory) | exit 0 at a12f770f and exit 0 at the final candidate |
| `git diff --check` | clean |

## Closure Contract (v1)

- Phase: RA-PREP-1
- Owner: features/agent-work (research seam) + features/work-artifacts (research writer, revise guard) + features/heby-answer (research purpose option)
- Reached state: VERIFIED
- Implementation commit: a12f770f, ccb2c35f, THIS COMMIT (mandate provenance row and filing-transaction checks)
- Verification level: V3 — data-use purpose through the shared gateway, shared artifact writer, writer and revise authority boundary
- Verification evidence: 2026-10-29; final candidate: ra-prep-1 research-preparation-postgres (R1–R9) and research-firewall (F1–F8) PASS; bite-proofs 11/11, 0 void; full suite run 4 1121/1124 with 0 REGRESSION (k2 create-and-read intermittent, 5/5 PASS at base and candidate; plan-step-idempotency-1 bite-proofs PRE-EXISTING; r3w ambient BLOCKED, not run); C-locale cluster per repository evidence; tsc 0; eslint 0 errors; next build exit 0; git diff --check clean; continuity closure-contract PASS
- Test environment: worktree .claude/worktrees/ra-prep-1 and disposable detached worktree full-a12f770f (scratchpad, real node_modules via APFS clone); session-created PostgreSQL 18 clusters on 127.0.0.1:55494 (en_US.UTF-8, system_identifier 7702077506908358914) and 127.0.0.1:55495 (C locale, system_identifier 7702091228980822985); baseline disposable detached copy base-03817c82; macOS Darwin 25.2.0, Node 24.16.0
- Deployment evidence: N/A
- Production acceptance evidence: N/A
- Deferred risks: RA-AUTH-1-HUMAN-REVISE-1 (CLOSED); RA-PREP-1-NO-SURFACE-1 (DEFERRED); RA-PREP-1-RESEARCH-REVISE-1 (DEFERRED); RA-PREP-1-MANDATE-PROVENANCE-1 (CLOSED); RA-PREP-1-CONCURRENT-DISPATCH-1 (DEFERRED); RA-EAI-1-WEB-SEARCH-1 (DEFERRED); RA-AUTH-1-AUTH-RUNTIME-1 (DEFERRED); GATE-D-PROVIDER-RECONCILIATION-1 (BLOCKED)
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
- **RA-PREP-1-MANDATE-PROVENANCE-1 (CLOSED).** Closed without a migration: the filing transaction re-reads
  the effective mandate, files only under the revision the dispatch rested on, and appends
  `work-artifact.research-report.filed` naming `mandateId` and `mandateRevision` (R1, R8; bite B7, B9, B11).
- **RA-PREP-1-CONCURRENT-DISPATCH-1 (DEFERRED).** Unlike `assignWorkDraft`, the research seam takes no
  per-(work, agent) advisory lock: two simultaneous requests both dispatch and both file. No bypass: the
  persistent dispatch cap holds under the race (R9c) and each filing names its checked revision (R9b).
  Exposure none until a surface exists; decide a lock or open-report rule with the surface.
- **RA-EAI-1-WEB-SEARCH-1 (DEFERRED)**, **RA-AUTH-1-AUTH-RUNTIME-1 (DEFERRED)**, **GATE-D-PROVIDER-RECONCILIATION-1
  (BLOCKED)** — owned by their phases, unchanged here. GATE-D blocks any production research execution.

## Release readiness review (2026-10-29)

| Area | Result |
|---|---|
| Architecture | Owners preserved; no duplicate system; one research writer, one caller (F1); `prepareWorkArtifact` byte-identical to 03817c82; new code: one seam, one audit sibling, one writer entry, one gateway option |
| Security | Mandate (preflight, filing transaction), Governance (preflight, before filing), research data use (preflight, gateway), provider control, budget, persistent cap (also under race), human revise refused, injection grants nothing — all by test (R1–R9) and bite (B1–B11) |
| Provenance | Mandate revision recorded on the filing transaction and joinable to its Governance decision; provider/model via the message; purpose/classes/tenant grant via the disclosure audit; unsourced by type and label |
| Runtime exposure | No route, server action or component imports the seam (F6). Production (read-only measurement in the RA-EAI-1 release, unchanged since: no deployment of this branch): 0 research scopes, 0 `prepare-research` mandates, 0 `research-report` artifacts. Not re-measured in this review (no production read was authorized here) |
| Tests | Targeted PASS; regressions classified; 1121/1124 is not a full PASS; r3w BLOCKED |

**Cleanup (2026-10-29).** Removed only this session's disposables, after ownership and idle checks: the
detached worktrees `full-a12f770f` and `base-03817c82` (`git worktree remove --force`; their node_modules were
APFS clones, not the shared directory), and the stopped clusters `pg` (system_identifier
7702077506908358914) and `pgc` (7702091228980822985). Kept: the suite and build logs in the session
scratchpad, every other worktree (including another session's three scratchpad worktrees), the shared
node_modules, and every PostgreSQL instance not created here. After: no cluster of this session running;
`feat/ra-prep-1` intact; remote main 03817c82; remote has no `feat/ra-prep-1`.

**Recommendation: READY FOR DORMANT PRODUCTION DEPLOYMENT** — the code only, inert: nothing can reach the
seam, no tenant holds research, no mandate admits it, and GATE-D blocks any provider execution. Deploying
it activates nothing. No migration (ledger 83).

## Production release needs (Director gates)

1. Push and deployment of `feat/ra-prep-1` (no migration: ledger stays 83).
2. GATE-D-PROVIDER-RECONCILIATION-1 closed before any production research call.
3. A tenant research authorization through Governance, and a `prepare-research` mandate, each its own decision.
4. A surface (RA-PREP-1-NO-SURFACE-1) — until then the seam is unreachable in production.

## Integration onto current main (2026-11-01)

Reached state unchanged: **VERIFIED**. Not pushed, not deployed.

The candidate `d404e8a3` was merged onto remote `main` `5c6a1674` as `265d6afd` on
`release/ra-prep-1-integration`. The 8 commits `main` gained since `03817c82` touch Live Map and
`auth-email-ownership`; no source or test file overlaps the candidate's, and all 27 candidate source and
test files are byte-identical to `d404e8a3` (`git diff --quiet`, exit 0). Authored ledger: 83, no `src/db`
change. Two conflicts, both appends: §21 and `learnings.md`; every line of both sides is kept, and §22 kept
the newer disposition of each row.

| Check on 265d6afd | Result |
|---|---|
| Firewall, census and continuity suites, in sequence | 30/30 exit 0 |
| Postgres suites, including ra-prep-1 R1–R9 | 14/14 exit 0; session-created PostgreSQL 18.6, 127.0.0.1:55496, C locale, system_identifier 7703038436500671166; constraint refusals seen in its server log |
| `tsc --noEmit` | exit 0, 0 lines |
| `eslint` on the 27 changed `.ts`/`.tsx` files | exit 0; 0 errors, 1 pre-existing warning (sci1 import) |
| Secret-shaped strings in the added lines | none |
| Disk gate T0–T5 (03:10–03:20Z) | **BLOCKED**: minimum 9.00 GiB at T2–T3, from a new 1 GiB `swapfile6`; VM volume 6.4 → 7.5 GB, closed by T4 |
| `next build` | **NOT RUN** — withheld by the disk gate |
| ra-prep-1 bite-proofs | **NOT RUN here** — withheld by the disk gate; 11/11 on `4821ee89` stands for byte-identical files |
| Full suite | **NOT RUN here**; 1123/1124 on `4821ee89` predates the `main` side |
| r3w ambient safety | **NOT RUN** — the listener on :55432 is another session's cluster |

The build is required before release (CLAUDE.md test rule 6). Whether the full suite must run again is a
Director release decision: the two sides are disjoint in source, and the merged tree has not been run
end to end.
