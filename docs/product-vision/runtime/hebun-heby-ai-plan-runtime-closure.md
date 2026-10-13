# HEBY-AI-PLAN-RUNTIME-1 · Controlled Agent Reasoning phase 4 · closure record · VERIFIED

This phase implements the real AI planning runtime path, from a Heby message to a validated,
Hebun-written recommendation. The path goes through the existing EAI gate, model invocation,
attestation, audit and dispatch cap. It is implemented and tested. It is **not configured, not
authorized and not executed**:

- the data-use purpose it needs (`work-planning`, D1) is a migration that awaits Director approval;
- the platform cell (D4) is not recorded;
- no tenant holds the scope;
- no provider was contacted.

Today the released code answers every AI-plan request with "not authorized for work records yet"
before the model.

## 1 · Baseline (re-measured 2026-10-13)

- **`origin/main`:** `64ffae70`.
- **Local commits:** `ebe6df78`, `4543af9a`, `666ce9c5`, `ee7a84e1` and `bd7ced7d` are intact on
  `docs/heby-ai-planning-phase1` (worktree `.claude/worktrees/heby-ai-planning-phase1`); none pushed.
- **Instructions:** identical to `origin/main`.
- **Other work:** no concurrent change; no other tree touched.
- **Throwaway baseline:** a detached worktree at `bd7ced7d` in the session scratchpad, used only to
  measure the baseline.

## 2 · The runtime path, all existing seams

| Step | Seam | Fail-closed outcome before any model contact |
|---|---|---|
| Intent | `recognizePlanIntent` → `ai-plan` only for a planning request that also asks for AI explicitly ("AI ile", "AI destekli", "yapay zeka…", "with/using/use AI", "AI-assisted/-powered") | Without the AI marker every message routes exactly as before |
| Boundary | New server action `app/(dashboard)/heby/ai-plan-actions.ts` → `runAiOperationalPlan`. It is separate from read, answer and propose; the tenant comes from `resolveTenantContext`; the message is truncated to 2,000 characters. | No session → "Sign in required" |
| Department | `readOrganizationAuthority` → `resolvePlanDepartment` (the `/plan` NL resolver) | Unnamed, ambiguous or unreadable → the clarification lines, and no Work read |
| Projection | `readOperationalPlanningProjection` (Phase 2), validated against the Phase 1 contract | Any unavailable reason → one plain line, no call |
| Declaration | `workPlanningDeclaration(tenant)` → `{ tenantId, actorUserId, purpose: "work-planning", dataClasses: ["operational-record"] }`, only if the EAI vocabulary holds the purpose | **Today: null → "not authorized for work records yet", no call** |
| Director control | `resolveClaudeDirectorEnabled` | Off → no call |
| Transport | `selectModelTransport` | None → no call |
| Invocation | `generateHebyModelAnswer`: the EAI gate (platform × attestation × tenant × operator), model-id attestation, tenant-mismatch check, audit evidence and dispatch cap | Any refusal → "does not allow its work records to reach a model. Nothing was sent." |
| Output | `validateOperationalPlanCandidate` (Phase 3): closed contract, aliases of this projection, codes true for every cited item | Refused → the reason code only; no part of the answer is shown |
| Rendering | `renderOperationalPlanCandidate`: Fact / Derived / Recommendation / Unavailable, titles taken server-side from this tenant's register | The plan is labelled a proposal, "not a decision, an approval or work done" |

**What crosses** (one grounding line) is exactly `{ planRef, projection }`: aliases, declared states,
three booleans and a per-response ref. The user prompt is a fixed server sentence, so the user's
message, which would be the `conversation` class, is **not sent**. The system instruction is minted
once from the contract's own constants (SCI-1).

**Not added:** a new provider client, gateway, framework, planning authority, persistence or writer.

## 3 · Director decisions D2 / D1 / D7 / D3 / D4

| Decision | Status in this phase |
|---|---|
| D2 operational-record | Kept as written (EAI-OPERATIONAL-RECORD-1). |
| D7 pilot scope | Implemented: only `alias`, `state`, `accountable`, `stale`, `evidenceDeclared`; at most 40; only the four moves. |
| D3 sensitive content | No new permission. Titles reach the human, never the model. |
| D1 `work-planning` purpose | **Designed and verified on a disposable PostgreSQL 18; not applied, not committed.** The runtime is written against it and fails closed until it exists. |
| D4 disclosure cell | **Designed, not recorded.** `assistance × operational-record` stays unknown, and a test pins it. |

### D1 — the exact change awaiting approval

Migration (one constraint; verified on PG18 over the full ledger):

```sql
ALTER TABLE "tenant_ai_data_use_scopes" DROP CONSTRAINT "tenant_ai_data_use_scopes_purpose_chk";--> statement-breakpoint
ALTER TABLE "tenant_ai_data_use_scopes" ADD CONSTRAINT "tenant_ai_data_use_scopes_purpose_chk" CHECK ("tenant_ai_data_use_scopes"."purpose" in ('assistance', 'relevance-selection', 'agent-origination', 'media-generation', 'work-planning'));
```

Rollback (verified to apply while the table holds no `work-planning` row):

```sql
ALTER TABLE "tenant_ai_data_use_scopes" DROP CONSTRAINT "tenant_ai_data_use_scopes_purpose_chk";
ALTER TABLE "tenant_ai_data_use_scopes" ADD CONSTRAINT "tenant_ai_data_use_scopes_purpose_chk" CHECK ("tenant_ai_data_use_scopes"."purpose" in ('assistance', 'relevance-selection', 'agent-origination', 'media-generation'));
```

**Rollback impact.** The scopes table is append-only; there is no update or delete path by design.
Once a tenant has been granted `work-planning`, the rollback fails until those scope rows are removed
by a separate, Director-approved data repair. A tenant withdrawal does not remove them; it supersedes
them with a revision. Rolling back before any ceremony is clean.

Code that changes with it, in the same reviewed change:

- `PURPOSES` in `external-ai-data-use/contracts.ts` and `EXTERNAL_AI_PURPOSES_SQL` in
  `db/schema/external-ai-data-use.ts`. The firewall pins the two equal.
- The drizzle snapshot and journal entry.
- **D4.** The `RecordedAllowedCell` union gains `{ purpose: "work-planning"; dataClass: "operational-record" }`;
  `RECORDED_PLATFORM_DISCLOSURE_POLICY` gains the cell, with `ANTHROPIC_ASSISTANCE_BOUNDS` and
  attestation `ffb0c160` (attested, not verified), and its evidence string.
- **The ceremony.** `EXPECTED_DATA_CLASSES` and `KNOWN_FLAGS` in
  `scripts/eai-authorize-tenant-external-ai-data-use.ts` gain `work-planning: ["operational-record"]`
  behind an explicit `--work-planning` flag.
- **Tests that must change in the same change:**
  - `eai-operational-record` §1 pins "no purpose holds an operational-record cell";
  - `heby-ai-operational-plan` §0 pins "the vocabulary lacks the purpose";
  - the EAI vocabulary suite;
  - the migration-ledger count pins across the suite (about 37 files mention the ledger size; the
    exact fan-out is measured in that phase).
- **Production.** The schema change reaches production only through the production migration
  authority's ceremony. That is a separate gate.

## 4 · Heby integration

- **Hook.** `use-heby-conversation.ts` sends an `ai-plan` message to `planWithAiAction` and renders the
  server's `HebyCommandResult`, so the client composes no sentence.
- **Not touched:** `/plan`, the read command, the NL `plan` / `plan-if-department` routing, the model
  answer and the propose path.
- **`HebyCommandResult`.** Its "did not come from the model" note now names the AI plan as the one
  exception, and that plan's provenance says a model chose order, grouping and priority while Hebun
  wrote every sentence.
- **Browser.** Not verified in a browser. There is no local launch configuration, and running the
  app needs an environment and a sign-in that this phase did not set up. The rendering is proved by
  test.

## 5 · Output validation and evidence

The Phase 3 validator and renderer are reused unchanged. Refused answers end in one line naming the
refusal code, and no model text is ever placed in `lines`.

## 6 · Tenant, provider and disclosure security

All of this is proved with the **real** generator and the **real** live Claude transport over a
counting `fetch`, and the **real** EAI composer over stated test policies.

- **Fetch 0** under:
  - the recorded policy (no `work-planning` cell);
  - no tenant authorization, a revoked one, or one scoped to assistance only;
  - a missing, unreadable or other-model attestation.
- **Not even asked:** another tenant's declaration is refused before the authority is asked.
- **Before the model:** the Director control off, no transport, more than 40 items, an unreadable or
  truncated register, an empty or unresolved department.
- **Control:** under a test-only hypothetical D1 + D4 + grant, the seam is reached exactly once.
- **What crossed in the control run:** no title, name, department, id, date, credential or user text;
  only the declared `work-planning × operational-record`. The decision's evidence record carries
  none of the content.

## 7 · Tests and regressions

**Suite:** `tests/heby-ai-operational-plan/runtime.ts`, PASS. It covers all 18 required boundaries:

| Boundaries | Cases |
|---|---|
| Disclosure (1, 2) | Purpose-specific declaration; assistance unchanged |
| Authorization (3, 4, 5, 6) | No grant, revoked grant, missing attestation, cross-tenant |
| Projection order (7) | Projection validated before any call |
| Refused answers (8, 9, 10, 11) | Invalid response; fabricated evidence; an invented deadline, an unknown alias, an approval move and injection after or inside JSON; replay |
| Leakage (12) | No sensitive field crosses |
| Authority (13, 14) | Governance and execution not reachable |
| Unchanged paths (15, 16) | `/plan` and NL planning (recognizer and source) |
| Provider errors (17) | HTTP 500, network failure, truncated answer; no provider detail shown |
| Persistence (18) | Nothing persisted |

**Bite-proofs.** Each was confirmed applied by md5, made the suite exit 1, and was restored by
`cmp`:

1. Removing the vocabulary guard.
2. Sending the user's message.
3. Adding titles to the projection.
4. Dropping the request's tenant.
5. Showing an unvalidated answer.

**Census extensions**, each with a stated reason:

- `external-ai-data-use-1a/firewall-and-inertness` (importer, pinned to the declaration type and the vocabulary);
- `-b2/boundary` (a third generator caller, pinned to `work-planning × operational-record`);
- `l3-organization-authority/firewall` (an Organization Authority consumer, department never sent);
- `sci1-instruction-channel` (a fourth instruction owner);
- `agent-id-0-1-acceptance/read-seam-and-truth` and `heby-nav-0/exact-route-truth` (one more server action).

**Regression:**

- **The recorded 127 suites:** identical before and after (103 pass, the same 24 baseline failures).
- **47 further suites** that scan the hook, the Heby actions, the planning intent or the model seam,
  measured against a clean `bd7ced7d` worktree: identical except the new suite, which now passes.
  The 9 suites red at baseline fail on the same first assertion as at baseline.
- **Postgres 18:** `plan-postgres`, `projection-postgres` and `b2 egress-postgres` exit 0.
- **Static checks:** `tsc --noEmit` exit 0. `eslint` on every touched file exit 0, with one existing
  warning in `sci1` line 26 (an unused import, present at `bd7ced7d`).
- **Full suite (`npm run test:run`, 1,023 files), run because this is V3.** The baseline (clean
  `bd7ced7d` worktree) and the change ran in parallel against the same PostgreSQL 18: baseline 936
  pass / 86 fail, change 927 pass / 96 fail. All 31 suites that failed only on the change were re-run
  one at a time on both trees:
  - **2 were genuine and are fixed.** Phase 2's and phase 3's "nothing at runtime imports this" pins
    (`heby-operational-planning-projection/projection.ts`, `plan-candidate.ts`) were broken by this
    phase's legitimate importer. They now pin exactly that one importer, and both pass.
  - **The rest were not reproducible as regressions.** They passed on both trees, failed on both
    trees, or flipped in both directions.
- **The flips have one identified root cause: `TEST-HARNESS-PG18-TEARDOWN-1`.** On PostgreSQL 18 the
  harness's `pg_terminate_backend` also hits autovacuum workers and fails with `42501` ("Only roles
  with privileges of the pg_signal_autovacuum_worker role may terminate autovacuum workers"). A suite
  that printed PASS then exits 1 and strands its database. `ap2-agent-placement/bite-proofs` fails at
  a different bite (B2/B3/B4) on each run of both trees.
- **Not re-run.** The full suite was not re-run after the two-pin fix. The two suites pass on their own.

## 8 · Implemented / configured / authorized / executed

| | State |
|---|---|
| Implemented | Yes: intent, server action, runtime, the generator call through EAI, validation, rendering, tests |
| Configured | No. The `work-planning` purpose is not in the vocabulary or the database, and the platform cell is not recorded. |
| Authorized | No. No tenant holds `work-planning × operational-record`. |
| Executed | No. No provider call has been made with Work data. No AI plan has been produced from real records. |

## 9 · Not cleaned up

The four disposable test databases left on PostgreSQL 18 by the previous phase's teardown flake are
still there. Their ownership is recorded in the previous record, and deleting them is a Director gate.

## Closure Contract (v1)

- Phase: HEBY-AI-PLAN-RUNTIME-1
- Owner: apps/dashboard/src/features/heby-commands (ai-operational-plan.server.ts, plan-intent.ts `ai-plan`), app/(dashboard)/heby/ai-plan-actions.ts, and the Heby submission gate use-heby-conversation.ts
- Reached state: VERIFIED
- Implementation commit: THIS COMMIT
- Verification level: V3 — the provider boundary: a new caller of the model generator under a new declared purpose, a new server action and a change to the single Heby submission gate. The full suite was run against a measured baseline (a clean `bd7ced7d` worktree), because this boundary is V3 and the suite carries a red baseline this phase may not investigate. Before it, the 127 recorded suites and the 47 suites scanning the hook, actions, intent or model seam were compared, alongside the PostgreSQL egress and planning suites and five bite-proofs on the provider boundary.
- Verification evidence: full suite on bd7ced7d vs change (936/86 vs 927/96), every change-only failure re-run sequentially on both trees — 2 genuine (fixed), the rest nondeterministic on both; `tests/heby-ai-operational-plan/runtime.ts` exit 0; five bite-proofs exit 1 (applied by md5, restored by cmp); 127 recorded suites identical to baseline; 47 further suites identical to a clean bd7ced7d except the new passing suite, and the 9 baseline-red ones fail on the same first assertion; PostgreSQL 18 plan-postgres, projection-postgres, b2 egress-postgres exit 0; D1 migration and rollback applied on a disposable PostgreSQL 18 (not committed); `tsc --noEmit` exit 0; `eslint` exit 0 on touched files; `git diff --check` exit 0; development-continuity closure-contract exit 0
- Test environment: worktree `.claude/worktrees/heby-ai-planning-phase1` at bd7ced7d plus this phase's changes; detached baseline worktree at bd7ced7d in the session scratchpad; macOS (Darwin 25.2.0); tsx from the shared `apps/dashboard/node_modules`; PostgreSQL 18.0 at 127.0.0.1:5432 through `HEBUN_TEST_ADMIN_DATABASE_URL`; no provider, no credential, no production data
- Deployment evidence: N/A — not deployed
- Production acceptance evidence: N/A — not released; the purpose is not adopted and no provider call was made
- Deferred risks: AI-PLAN-RUNTIME-BROWSER-1 (DEFERRED); TEST-HARNESS-PG18-TEARDOWN-1 (DEFERRED)
- Director approvals: the runtime integration, its tests, the census extensions and a focused local commit (CONTROLLED AGENT REASONING · PHASE 4 brief, 2026-10-13); the D1 migration, the D4 platform cell, the tenant ceremony, the first provider call, push, deploy and the deletion of leftover test databases NOT approved
