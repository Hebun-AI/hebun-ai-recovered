# GOVERNANCE-DECISION-EVIDENCE-READ-1 · closure record · VERIFIED — a Governance authority can read back a recorded review decision

**Scope, stated first.** Authorized by the Director on 2026-10-28 ("GOVERNANCE DECISION EVIDENCE READ
IMPLEMENTATION"), after a read-only evidence audit of decision `9e4291a3-8601-4f2b-a94d-bd65436488c6` found that
the stored justification, the decider's id, the decision's bound content digest and the audit event id had no
production reader. No new table, writer, event type, migration or Governance decision. No model or provider call.
Release (push to `main`) was approved on 2026-10-28 and **refused by the session's permission layer**; nothing was
pushed or deployed, so this record stops at `VERIFIED`.

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
- Reached state: VERIFIED
- Implementation commit: da7f0302, 5c1e7005
- Verification level: V3 — authorization, Governance authority and tenant isolation boundary of a new decision reader and server action
- Verification evidence: 2026-10-28, evidence-postgres, surface-and-firewall and action-invocation PASS; bite-proofs 12/12 caught; full suite on da7f0302 1110 PASS / 3 FAIL / 1113 with 0 REGRESSION (heby-product-ux-1 PRE-EXISTING, plan-step-idempotency-1/bite-proofs PRE-EXISTING flaky, r3w-flow/ambient-database-safety BLOCKED not a pass); tsc, eslint, git diff --check, npm run build exit 0
- Test environment: worktrees .claude/worktrees/governance-decision-evidence-read-1 and disposable detached copies (gder1-baseline-de654fd1, gder1-candidate-da7f0302); macOS Darwin 25.2.0, Node 24.16.0; session-created PostgreSQL 18.6 on 127.0.0.1:56431, system_identifier 7701466443679519186, via HEBUN_TEST_ADMIN_DATABASE_URL; no production database, no provider
- Deployment evidence: N/A — not deployed; the push to main was refused by the session permission layer and origin/main stayed de654fd1
- Production acceptance evidence: N/A — not deployed
- Deferred risks: GDER1-NOT-RELEASED-1 (DEFERRED); GDER1-AUTH-ACTION-UNVERIFIED-1 (DEFERRED); GDER1-ACTOR-LABEL-1 (DEFERRED)
- Director approvals: architecture assessment and implementation, 2026-10-28 ("GOVERNANCE DECISION EVIDENCE READ IMPLEMENTATION"); V3 validation, 2026-10-28; integration, release and closure, 2026-10-28 ("GOVERNANCE EVIDENCE & TEST POLICY RELEASE CLOSURE")

### Deferred risk detail

- **GDER1-NOT-RELEASED-1 (DEFERRED).** The approved push of `2f6b3ad3` (fast-forward `de654fd1..5c1e7005` plus the
  `docs/test-validation-policy` merge) was refused by the permission layer; no alternative path was tried. Acceptance
  dependency: a Director push (or a permission that allows it) after re-reading the remote HEAD, then the Vercel
  deployment record, then the production acceptance in §4.
- **GDER1-AUTH-ACTION-UNVERIFIED-1 (DEFERRED).** An authenticated invocation of `readReviewEvidenceAction` was not
  executed in any test: no harness here provides a session cookie inside a Next request. The unauthenticated call is
  proved directly; authority and tenant isolation are proved on the reader. Acceptance dependency: the production
  read in §4 by the Governance authority.
- **GDER1-ACTOR-LABEL-1 (DEFERRED).** The decider is shown by type and id, not by name. Acceptance dependency: a
  Director decision to grow the HLR-1 label census, or to keep ids.

## 4 · Production acceptance still to run

On `/approvals`, History tab of "Quarterly Access & Integration Review — Access Controls", "Read decision evidence":
decision `9e4291a3-8601-4f2b-a94d-bd65436488c6` `accepted` on revision `c688dff3-c0d6-449e-a5fc-9122be5bf058`;
justification readable; recorded digest `175db80cbcef821a2480b9eacd38b8156722e2a99398901fe1355bb5a76a611c` with
comparison `match`; one `governance.decision.recorded` event linked by entity id; artifact still `draft`, revision 3,
same digest; Work `ca82db41-7790-4bd5-9890-0ae3001fe2f1` still `planned`.

**Weekly three.** *Learned:* a ledger that records why is not auditable until someone with authority can read the why
back, and parallel bite-proofs in one tree corrupt the very evidence they produce. *Turkish Rug House:* every review
of a TRH draft or plan becomes checkable after the fact — who decided, why, on which exact bytes. *Hebun AI:* every
Governance-reviewed artifact gains a read-back path without a second audit system.
