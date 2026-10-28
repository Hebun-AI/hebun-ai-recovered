# GOVERNANCE-DECISION-EVIDENCE-READ-1 · closure record · PRODUCTION-ACCEPTED — a Governance authority can read back a recorded review decision

**Scope, stated first.** Authorized by the Director on 2026-10-28 ("GOVERNANCE DECISION EVIDENCE READ
IMPLEMENTATION"), after a read-only evidence audit of decision `9e4291a3-8601-4f2b-a94d-bd65436488c6` found that
the stored justification, the decider's id, the decision's bound content digest and the audit event id had no
production reader. No new table, writer, event type, migration or Governance decision. No model or provider call.
Release (push to `main`) was approved on 2026-10-28. The session's push was refused by the Claude Code permission
layer; the Director pushed `de654fd1..1aadb59f` manually, and production acceptance was read back the same day (§4).

## 1 · What was missing

| Stored in | Field | Reader before this phase |
|---|---|---|
| `decision_records` | `justification` of an `accepted` review | none (only changes-requested reasons were readable) |
| `decision_records` | `actor_id`, `authority_source_actor_id` | none |
| `decision_records.evidence` | `workArtifactId`, `revisionNo`, `contentDigest` | none |
| `audit_log` | event `id`, `entity_id`, `actor_id` | `readGovernanceHistory`, called by no route |

The released review-state reader feeds the `/approvals` page payload and an `/operations` server action for anyone
who reaches those surfaces, so widening it would have handed a Governance decision's own words to non-Governance
members. A separate on-demand reader was built instead.

## 2 · What changed

| Commit | File | Change |
|---|---|---|
| `da7f0302` | `src/features/work-artifact-review/read-review-evidence.server.ts` | New. `readRevisionReviewEvidence(tenant, {artifactId, revisionNo})`: no session → `not-authorized`; no store → `unavailable`; `resolveGovernanceAuthority` before any record (fails closed) → `not-authorized`; revision by tenant + artifact + number → else `not-found`; every decision on that revision row, newest first, with justification verbatim, actor and authority source, evidence fields as `recorded`/`absent`/`malformed`, digest `match`/`mismatch`/`not-recorded` against the stored `content_digest`, and the audit events filed under the decision id (`linked`/`missing`/`multiple`/`unexpected-action`, all returned). Writes nothing, imports no writer |
| `da7f0302` | `src/features/governance-audit/governance-decision-audit.server.ts` | `readGovernanceHistory` gains an optional `entityId` equality inside its tenant predicate; a malformed id reads as no events |
| `da7f0302` | `src/features/work-artifact-review/contracts.ts` | `RevisionReviewEvidence` and its parts |
| `da7f0302` | `src/app/(dashboard)/approvals/actions.ts` | `readReviewEvidenceAction({artifactId, revisionNo})`; tenant from `resolveTenantContext()`, nothing else forwarded |
| `da7f0302` | `src/components/approvals-dashboard/decision-evidence.tsx`, `content-detail.tsx`, `approvals-dashboard.tsx` | A read-only "Decision evidence" section in the History tab of the selected item, loaded on click, shown only when the server's Governance answer (`data.authorized`) is true; the decision dialog is unchanged |
| `da7f0302` | `tests/gia1-governed-internal-action/internal-act-firewall.ts` | The closed server-action census grows to fifteen, with its reason (a read) |
| `da7f0302`, `5c1e7005` | `tests/governance-decision-evidence-read-1/{evidence-postgres,surface-and-firewall,action-invocation}.ts` | New |

No display label is resolved for the decider: the human-label read has a closed consumer census (HLR-1), and joining
it is a Director decision (GDER1-ACTOR-LABEL-1).

## 3 · Verification (V3)

The change touches an authorization and tenant boundary, so V3 with a full suite; the reason was written before it ran.

| Check | Result |
|---|---|
| Baseline, 63 suites importing the touched modules, at `de654fd1` | 62 PASS / 1 FAIL (`heby-product-ux-1`, "Hebyis") |
| `evidence-postgres.ts` (authorized read verbatim; unauthorized refused before any revision, justification, evidence or audit selection — measured by a recording proxy with a positive control; cross-tenant `not-found`; forged tenant ignored; revision-exact; absent/malformed/array evidence; digest match/mismatch/not-recorded; audit linked/missing/multiple/unexpected; foreign-tenant event never attached; `entityId` filter cannot leave the tenant; unavailable; read writes nothing across four tables) | PASS |
| `surface-and-firewall.ts` (review-state readers and page payload select no justification/actor/evidence; state type unchanged; action takes only the target; authority before the first record; reader writes nothing; UI gated, dialog unchanged; each pattern with a negative control) | PASS |
| `action-invocation.ts` (`5c1e7005`; the real action, no session: `not-authorized` and no other field, also with forged tenant/actor/authority fields) | PASS |
| Bite-proofs in disposable copies | 12/12 caught: authority check, revision tenant predicate, subject scope, `entityId` filter, digest comparison, absent-as-recorded, linkage action, justification in review state, client tenant in action, ungated UI, session check, action leaking a read |
| Full suite on `da7f0302`, sequential, disposable detached worktree | 1113 files: 1110 PASS / 3 FAIL. `heby-product-ux-1` PRE-EXISTING (same assertion on `de654fd1`); `plan-step-idempotency-1/bite-proofs` PRE-EXISTING flaky (sequential reruns: `de654fd1` 1 PASS + 1 FAIL with the same message, `da7f0302` 2 PASS); `r3w-flow/ambient-database-safety` BLOCKED (canonical `hebun_r1` @ :55432 not running; OR2-R3W-AMBIENT-DB-BLOCKED-1, not a pass). 0 REGRESSION |
| Regressions found and fixed before that run | `hlr-human-legibility` (2 suites: the reader had joined the closed label census → label resolution removed); `gia1` server-action census (grown with reason); `rung2-ingress` (action moved before the standing-envelope block; pin untouched) |
| `tsc --noEmit`, `eslint` (changed files), `git diff --check`, `npm run build` | exit 0 on `da7f0302`; `5c1e7005` adds one test file (tsc exit 0, eslint exit 0) |
| Integrated tree `2f6b3ad3` (`5c1e7005` + `a31969c8` merged) | differs from `5c1e7005` only in `CLAUDE.md`; continuity test PASS |

A first parallel attempt (4 shards per tree, same worktree) was discarded: concurrent in-place bite-proofs left five
mutations in source and produced about forty false reds.

## Closure Contract (v1)

- Phase: GOVERNANCE-DECISION-EVIDENCE-READ-1
- Owner: work-artifact-review (decision evidence reader) over the Governance decision ledger; governance-audit (history reader filter)
- Reached state: PRODUCTION-ACCEPTED
- Implementation commit: da7f0302, 5c1e7005
- Verification level: V3 — authorization, Governance authority and tenant isolation boundary of a new decision reader and server action
- Verification evidence: 2026-10-28, evidence-postgres, surface-and-firewall and action-invocation PASS; bite-proofs 12/12 caught; full suite on da7f0302 1110 PASS / 3 FAIL / 1113 with 0 REGRESSION (heby-product-ux-1 PRE-EXISTING, plan-step-idempotency-1/bite-proofs PRE-EXISTING flaky, r3w-flow/ambient-database-safety BLOCKED not a pass); tsc, eslint, git diff --check, npm run build exit 0
- Test environment: worktrees .claude/worktrees/governance-decision-evidence-read-1 and disposable detached copies (gder1-baseline-de654fd1, gder1-candidate-da7f0302); macOS Darwin 25.2.0, Node 24.16.0; session-created PostgreSQL 18.6 on 127.0.0.1:56431, system_identifier 7701466443679519186, via HEBUN_TEST_ADMIN_DATABASE_URL; no production database, no provider
- Deployment evidence: 2026-10-28, dpl_62c5GxNzJzSq4MDhM1Mtrska6L4h, githubCommitSha 1aadb59f9b88b5c5318e0d0e6b90c4b1ad9f3009 (main, Director push de654fd1..1aadb59f), target production, READY; www.hebuntech.com, hebuntech.com, hebun-ai-recovered.vercel.app aliased
- Production acceptance evidence: 2026-10-28, Director's signed-in session on www.hebuntech.com/approvals: decision 9e4291a3 accepted, justification byte-equal to the approved text, bound digest 175db80c…a76a611c match, audit event 3c7af7a9 linked by entity id, artifact draft rev 3 unchanged (SHA-256 recomputed), Work ca82db41 planned, ledger still 187 after the read, unauthenticated /approvals → /login; non-Governance member not measured (GDER1-NONGOV-PROD-1)
- Deferred risks: GDER1-NOT-RELEASED-1 (CLOSED); GDER1-AUTH-ACTION-UNVERIFIED-1 (CLOSED); GDER1-ACTOR-LABEL-1 (DEFERRED); GDER1-NONGOV-PROD-1 (DEFERRED)
- Director approvals: architecture assessment and implementation, 2026-10-28 ("GOVERNANCE DECISION EVIDENCE READ IMPLEMENTATION"); V3 validation, 2026-10-28; integration, release and closure, 2026-10-28 ("GOVERNANCE EVIDENCE & TEST POLICY RELEASE CLOSURE"); manual Director push de654fd1..1aadb59f and production acceptance, 2026-10-28 ("FINAL PRODUCTION ACCEPTANCE")

### Deferred risk detail

- **GDER1-NOT-RELEASED-1 (CLOSED).** The session's push was refused by the Claude Code auto-mode permission classifier
  (not Git, GitHub or Hebun: `hebuntech` holds push/admin, `main` is unprotected, 0 rulesets); no alternative path was
  tried. Closed by the Director's manual push `de654fd1..1aadb59f` and deployment `dpl_62c5GxNzJzSq4MDhM1Mtrska6L4h`.
- **GDER1-AUTH-ACTION-UNVERIFIED-1 (CLOSED).** No test harness provides a session cookie inside a Next request; the
  authenticated invocation was measured in production instead (§4), returning the decision for the Governance authority.
- **GDER1-ACTOR-LABEL-1 (DEFERRED).** The decider is shown by type and id, not by name. Acceptance dependency: a
  Director decision to grow the HLR-1 label census, or to keep ids.
- **GDER1-NONGOV-PROD-1 (DEFERRED).** An authenticated member without Governance authority was not observed in
  production (the tenant has none). Proved on the reader (`evidence-postgres.ts`: refused before any record is
  selected). Acceptance dependency: a read by such a member when one exists.

## 4 · Production acceptance (2026-10-28)

Deployment `dpl_62c5GxNzJzSq4MDhM1Mtrska6L4h`, target production, READY, `githubCommitSha`
`1aadb59f9b88b5c5318e0d0e6b90c4b1ad9f3009` (`main`), aliased to `www.hebuntech.com`, `hebuntech.com` and
`hebun-ai-recovered.vercel.app` (Vercel CLI `inspect` and `/v13/deployments`).

Read on `www.hebuntech.com` in the Director's signed-in session, read-only:

| Check | Observed |
|---|---|
| Initial `/approvals` payload | no justification text, no audit action; the evidence section absent until requested |
| Control shown | "Read decision evidence" present in the History tab — the server answered `authorized` |
| Decision | `9e4291a3-8601-4f2b-a94d-bd65436488c6`, outcome `accepted` · `approve`, decided `2026-10-27T21:16:20.491Z`, by and under authority of human `d5b496df-588c-49c5-9cc2-17672b82dd10` |
| Justification | rendered text equal, byte for byte, to the Director-approved text |
| Bound evidence | artifact `311f1e25-4093-4d32-9cfd-d1bc2374e8f4`, revision number 3, digest `175db80cbcef821a2480b9eacd38b8156722e2a99398901fe1355bb5a76a611c`; comparison `match` |
| Audit linkage | `linked`: one event `3c7af7a9-130e-41e8-bcdb-72f5e9f0bcac`, `governance.decision.recorded`, entity `9e4291a3…`, human `d5b496df…`, committed, `2026-10-27T21:16:20.491Z` |
| Artifact | `draft`, current revision 3, revision `c688dff3…`; served bytes 3140, SHA-256 recomputed = stored digest |
| Work | `ca82db41-7790-4bd5-9890-0ae3001fe2f1` `planned`, `active`; evidence reference `7d776902…` → artifact `311f1e25…` |
| Read wrote nothing | Security Center: 187 recorded acts, the latest still the decision's own event |
| Unauthenticated | `/approvals` without a session redirects to `/login`; no evidence markup |

Not measured in production: an authenticated member WITHOUT Governance authority. The Hebun AI tenant has one
member, the Governance authority, and creating an account is outside this release; the path is proved on the reader
against PostgreSQL (GDER1-NONGOV-PROD-1).

**Weekly three.** *Learned:* a ledger that records why is not auditable until someone with authority can read the why
back, and parallel bite-proofs in one tree corrupt the very evidence they produce. *Turkish Rug House:* every review
of a TRH draft or plan becomes checkable after the fact — who decided, why, on which exact bytes. *Hebun AI:* every
Governance-reviewed artifact gains a read-back path without a second audit system.
