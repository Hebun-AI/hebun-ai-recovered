# ORGANIZATION-READINESS-2 · closure record · PRODUCTION-ACCEPTED (scoped)

**Scope of the acceptance, stated first.** This record is accepted against production *deployment
reality* and one signed-in, read-only view: the deployed commit, its production deployment and
aliases, and the Turkish Rug House Governance owner's render of `/governance/authority`. The
authorization logic itself is proven by local tests at the deployed commit. **No authorization or
withdrawal was executed in production**, **no non-owner view was observed**, **the server was not
observed for provider calls** and **the production database was not read**. §16.1 keeps the state one
of six and puts the qualifier in the evidence text; nothing below widens it.

## 1 · Problem

A customer organization cannot reach its first AI-assisted Heby workflow until its own Governance
authority agrees that its data may reach the reviewed AI processor (EXTERNAL-AI-DATA-USE). The writer
for that decision existed and was released, but nothing in the product called it: every decision went
through the operator ceremony `platform:tenant-external-ai-data-use`, run in a terminal on the
organization's behalf. The read-only readiness card (ORGANIZATION-READINESS-1, `1ee39cd7`) said so and
named it a platform operator ceremony.

## 2 · What was released

| Commit | Content |
|---|---|
| `4fb6e68f` | `feat(governance): let the Governance owner decide AI assistance data use in the app`. 11 files, +851 / −48: `src/features/external-ai-data-use/assistance-data-use.server.ts` (new composer), `revision-scopes.ts` (moved from `scripts/lib/tenant-data-use-scopes.ts`, which now re-exports it), `src/components/governance-authority/ai-assistance-decision-card.tsx` (new), `governance/authority/actions.ts` and `page.tsx`, one readiness string in `organization-readiness.ts`, two new tests under `tests/organization-readiness-2/`, the EAI-1A firewall pins, and one `learnings.md` line |

On `main`: fast-forward `1ee39cd7 → 4fb6e68f` (GitHub `1ee39cd7..4fb6e68f -> main`), remote HEAD
re-read and proven an ancestor immediately before the push.

**Inside the existing authority.** The released writer (`authorize-tenant-external-ai-data-use.server.ts`)
remains the only writer and decides exactly as before: authenticated human, session tenant, Governance
holder, justification, current attestation, every pair ALLOWED by the recorded policy, observed
revision. The composer only fixes what is asked for:

- purpose `assistance`, always; no input names a purpose or a scope;
- pairs read off `RECORDED_PLATFORM_DISCLOSURE_POLICY` for `anthropic/messages` × `assistance`;
- other purposes in force are kept when assistance is authorized (`nextRevisionScopes`) and when it is
  withdrawn (`revisionScopesWithout`); with nothing else in force, withdrawing is the writer's
  withdrawal; a remaining purpose stays bound to the attestation it was authorized against.

The two client-scope server actions (`authorize/withdrawTenantExternalAiDataUseAction`, no UI caller)
were replaced by `authorize/withdrawAssistanceDataUseAction`, whose input is only `attestationId`,
`justification` and `observedRevision`. The card is shown to members who can read it; the control only
to a Governance holder. It states what may be sent, the processor review it is bound to (with
"attested, not verified"), and that the decision connects no provider and sends nothing by itself.

**Unchanged:** schema and migrations, the recorded platform policy, attestations, the generator's EAI
gate, R2E provider control, Heby dispatch, environment variables, credentials, every tenant's
authorization. No authority, persistence or execution path was added.

## 3 · Verification (V3)

V3: the change sits on a Governance authorization boundary governing external-AI disclosure, so the
full suite was justified before it ran.

| Item | Measured |
|---|---|
| Baseline before change (implementation worktree at `1ee39cd7`) | 18 focused files PASS, including EAI-1A, B1D Postgres, tenant ceremony, OR-1, g2/g3, sia31, relevance-adjacent firewalls |
| New tests | `tests/organization-readiness-2/boundaries.ts` PASS; `tests/organization-readiness-2/assistance-data-use-postgres.ts` PASS — view tenant-scoped and fail-closed; refusals (unauthenticated, no Governance, cross-tenant forged context, no reason, stale revision, unknown attestation, store unavailable, nothing to withdraw) write no revision and no Governance session; authorize writes exactly the three assistance pairs; repeat is `unchanged`; origination survives withdraw and re-authorize; full withdrawal makes the resolver answer `tenant-withdrawn`; every revision has its own Governance decision |
| Full suite (once, detached copy of the change) | 1073 PASS / 2 FAIL / 1075. `relevance2a/firewall.ts`: REGRESSION (a filename containing `data-use` outside the authority) — fixed by renaming the card, pin untouched, affected tests re-run PASS. `r3w-flow/ambient-database-safety.ts`: BLOCKED (canonical `hebun_r1` at :55432 unreachable), identical on unchanged `1ee39cd7`; not counted as a pass |
| Release candidate at `4fb6e68f` (release worktree, clean) | 30/30 focused files PASS (EAI 1A/B1A/B1D/B2, tenant ceremony, work-planning, wf3b, apf3 incl. bite-proofs, OR-1, OR-2, g2, g3, invitation, sia31, agent-id, heby-nav-0, relevance2a, ap4a); `tsc --noEmit` exit 0; `eslint` on changed files exit 0; `git diff --check` clean; `npm run build` exit 0 |

**Strengthened, not weakened.** The EAI-1A "no tenant parameter" assertion stripped comments and then
split on a marker that only existed inside a comment, so it checked an empty string. It now reads the
raw source.

## 4 · Production release and acceptance

| Gate | Time | Measured |
|---|---|---|
| Release | 2026-10-23 ~07:07Z | `origin/main` = `4fb6e68ffe774da59f133ee27a048a5edffa2dd5`, parent `1ee39cd7` (`git ls-remote`, re-read after push) |
| Deploy | created 2026-10-23 07:07:20Z | `dpl_9K5vCr2fVwDRwwnPQadEdZTh55qD`, target production, status Ready (`vercel inspect`); git integration. GitHub commit status for `4fb6e68f`: `Vercel success` pointing at the same deployment; served HTML carries the `dpl_9K5vCr2f…` marker |
| Aliases | 2026-10-23 | `www.hebuntech.com`, `hebuntech.com` on `dpl_9K5v…` (`vercel inspect`) |
| Smoke | ~07:19Z | `/` 200, `/login` 200, apex 308 → www; signed-out `/governance/authority`, `/heby`, `/api/health` 307 → `/login` |
| Runtime logs | first 30 min after creation | `vercel logs --deployment dpl_9K5v…`: 0 `error`, 0 `fatal`, 0 `5xx`; unfiltered read returned 20 info records (endpoint live). A sample from single calls, not a paged count |
| Signed-in read-only view | 2026-10-23 | Built-in browser, Director's own session (no credential entered by this session). Tenant Turkish Rug House; viewer is its genesis Governance holder ("You hold it") |
| Director scoped acceptance | 2026-10-23 | PRODUCTION-ACCEPTED — scoped, on exactly the evidence in this record |

**What the signed-in view showed (read from page text).**

- *Organization readiness* rendered all five rows: Governance Ready; AI processing Ready ("Authorized
  for: assistance. The platform model is available."); Connected providers Ready (8 available, 3 not);
  Executing approved sends and posts Not ready (arming withdrawn); Work domains Ready (1).
- *AI assistance data use* rendered: "Decision: Authorized (revision 1)"; the three classes that may be
  sent and the statement that everything else stays withheld; processor "Anthropic Messages API, review
  revision 1, under Anthropic commercial terms", not used for training, retained up to 30 days, models
  `claude-haiku-4-5-20251001`, "attested by the platform operator, not independently verified"; the box
  separating this decision from provider availability and from a model call. No other purpose listed,
  consistent with the readiness row.
- Controls: a reason field and **"Withdraw assistance authorization" only** — no Authorize control,
  which is correct for an authorization already in force. Nothing was clicked.
- Browser console: no messages. Network: same-origin only; no POST to `/governance/authority`, so no
  server action was invoked by this session.

The TRH authorization at revision 1 **pre-dates this release**; this release wrote no authorization and
the browser submitted none. Older notes saying TRH was unauthorized are stale.

**Evidence provenance, kept apart.**

| Evidence | Source | Measured by this session |
|---|---|---|
| Remote SHA, deployment, aliases, commit status, served marker, smoke, logs | git, Vercel CLI, GitHub API, HTTP; read-only | Yes |
| Signed-in render, controls, console, network | Built-in browser in the Director's session; read-only | Yes |
| Local test results | Implementation and release worktrees; session-owned PostgreSQL 18 | Yes |

## 5 · Not verified

- **Non-owner view.** No authorized non-owner session was available; that the control is withheld from
  non-holders is proven by tests and by the writer's refusal only (OR2-NON-OWNER-UI-1).
- **Server-side provider silence.** A render's absence of provider calls was not observed on the server;
  the browser shows only that no client request left the origin (OR2-SERVER-PROVIDER-CALLS-1).
- **Production database immutability.** The production database was not read; "nothing changed" is not
  measured (OR2-PROD-DB-IMMUTABILITY-1).
- **Authorize and Withdraw in production.** Neither was executed; their production behaviour is proven
  only locally (OR2-PROD-DECISION-EXECUTION-1).
- **Mulify.** Not inspected; it still needs genesis and its own decision before this surface applies.

## Closure Contract (v1)

- Phase: ORGANIZATION-READINESS-2
- Owner: apps/dashboard/src/features/external-ai-data-use/assistance-data-use.server.ts (assistance-only composition over the released writer) with the /governance/authority actions, page and ai-assistance-decision-card; the EXTERNAL-AI-DATA-USE writer, readers, recorded policy, attestations, generator gate, R2E, Governance and tenant authority unchanged
- Reached state: PRODUCTION-ACCEPTED
- Implementation commit: 4fb6e68ffe774da59f133ee27a048a5edffa2dd5 — released on `main` (fast-forward from 1ee39cd7)
- Verification level: V3 — Governance authorization boundary over external-AI disclosure; full suite justified before it ran, one regression found and fixed, focused set re-run at the deployed commit
- Verification evidence: at 4fb6e68f on 2026-10-23, 30/30 focused test files exit 0 PASS (incl. tests/organization-readiness-2/boundaries.ts and assistance-data-use-postgres.ts), tsc exit 0, eslint exit 0, git diff --check clean, npm run build exit 0; full suite on the change 1073 PASS / 2 FAIL / 1075 — relevance2a/firewall.ts REGRESSION fixed by file rename and re-run PASS, r3w-flow/ambient-database-safety.ts BLOCKED (not a pass)
- Test environment: worktrees `.claude/worktrees/organization-readiness-2` and `.claude/worktrees/organization-readiness-2-release` at 4fb6e68f, clean; detached copies for the full suite; macOS (Darwin 25.2.0); Node with tsx; session-owned PostgreSQL 18 at 127.0.0.1:55434 (own initdb, system_identifier 7699697181424456884, UTF8, disposable databases dropped in `finally`) via HEBUN_TEST_ADMIN_DATABASE_URL; no production database, no provider, no real network
- Deployment evidence: dpl_9K5vCr2fVwDRwwnPQadEdZTh55qD READY production, created 2026-10-23T07:07:20Z by the git integration, GitHub commit status for 4fb6e68f names it, aliases www.hebuntech.com and hebuntech.com
- Production acceptance evidence: SCOPED — (a) measured read-only: deployment Ready and aliased, served dpl marker, smoke `/` 200, `/login` 200, signed-out routes 307 to `/login`, apex 308, logs 0 error / 0 fatal / 0 5xx in the first 30 minutes (sampled); (b) signed-in read-only render of /governance/authority as the Turkish Rug House Governance holder: readiness five rows, assistance card Authorized revision 1 with processor qualifications, Withdraw control only, no console errors, no POST; (c) Director-authorized scoped acceptance 2026-10-23. Non-owner view, server-side provider calls, production database immutability and production Authorize/Withdraw UNVERIFIED (section 5)
- Deferred risks: OR2-NON-OWNER-UI-1 (DEFERRED); OR2-SERVER-PROVIDER-CALLS-1 (DEFERRED); OR2-PROD-DB-IMMUTABILITY-1 (DEFERRED); OR2-PROD-DECISION-EXECUTION-1 (DEFERRED); OR1-ARMING-COPY-1 (DEFERRED); OR2-R3W-AMBIENT-DB-BLOCKED-1 (DEFERRED)
- Director approvals: read-only discovery 2026-10-23; implementation GO with one local commit 2026-10-23; release preparation 2026-10-23; push and deploy GO for 4fb6e68f 2026-10-23 (fast-forward push executed by this session); read-only authenticated acceptance 2026-10-23; PRODUCTION-ACCEPTED — scoped and this closure documentation 2026-10-23; commit of this documentation approved, push NOT yet approved

### Deferred risk detail

- **OR2-NON-OWNER-UI-1 (DEFERRED).** The production view of a member who does not hold Governance was
  not observed. Acceptance dependency: a signed-in read-only render by an existing non-holder member.
- **OR2-SERVER-PROVIDER-CALLS-1 (DEFERRED).** Rendering was not observed server-side for provider
  calls; the read path names no transport, by tests. Acceptance dependency: a Director decision on a
  server-side observation, or accepting the static proof.
- **OR2-PROD-DB-IMMUTABILITY-1 (DEFERRED).** The production authorization ledger was not read before or
  after acceptance. Acceptance dependency: a Director-authorized read-only count of
  `tenant_ai_data_use_authorizations` revisions per tenant.
- **OR2-PROD-DECISION-EXECUTION-1 (DEFERRED).** No production authorization or withdrawal was made
  through the new surface. Acceptance dependency: a real decision by an organization's own Governance
  holder (e.g. a first customer after genesis), observed read-only.
- **OR1-ARMING-COPY-1 (DEFERRED).** ORGANIZATION-READINESS-1 renders "Arming is A platform operator
  ceremony; …" (sentence-cased constant inside a sentence). Cosmetic; OR-1 has no §16.1 record, so it is
  indexed here. Acceptance dependency: a Director-selected copy fix.
- **OR2-R3W-AMBIENT-DB-BLOCKED-1 (DEFERRED).** `tests/r3w-flow/ambient-database-safety.ts` cannot run
  without the canonical `hebun_r1` at :55432 and fails BLOCKED on the unchanged baseline too.
  Acceptance dependency: a run on a machine where that instance is up, or a Director decision on the
  test's environment.

**Behaviour change, intended.** A Governance holder can now authorize or withdraw assistance data use
in the app; the operator ceremony remains for other purposes. The two unused client-scope server
actions no longer exist.

**Weekly three.** *Learned:* exposing an authority to the product is a narrowing job, not a new
authority: fix the purpose server-side, carry other purposes through, and let the released writer keep
every check. *Turkish Rug House:* TRH's owner can now see, in the product, exactly what reaches the AI
processor and withdraw it without an operator. *Hebun AI:* a new customer's path to Heby no longer
needs an operator for the data-use decision; genesis remains the one operator step.
