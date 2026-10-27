# OUTPUT-INTEGRITY-1 · closure record · DEPLOYED — a draft cut at the model output limit is never filed

**Scope, stated first.** Authorized by the Director on 2026-10-27 ("WORK ARTIFACT OUTPUT INTEGRITY"). One refusal
added to the preparation seam. No model or provider was called; the truncated artifact `1196db5f-de47-4b5b-9b09-9f6a547930e0`
was not modified, accepted, retried or linked; no Work, Governance or mandate record changed; the 1024-token ceiling
is unchanged.

## 1 · Observation and root cause

The Security Planning Agent's Part 1 preparation (message `f63579da-d8d9-4169-981a-67916ec14ed7`) logged
`served: model`, `issueCodes: []`, `stopReason: max_tokens`, and was filed as revision 1 of artifact `1196db5f…`
(5146 characters) ending mid-sentence ("…rotation practices, sample"), with no warning on the artifact.

Five states were collapsed into one. *Model response received* and *validator accepted* were true; *output completed*
was false; *artifact persisted* followed anyway, and the artifact read as *ready for human review*. The stop reason
was read (`classifyProviderStopReason` → `answer.modelStopReason`) and used in two places only: the AOR-1a diagnosis
line and `MODEL_OUTPUT_LIMIT_NOTE` in the answer's `limitations`, which a preparation never stores.
`prepareWorkArtifact` filed every model-origin, durable reply; the response validator judges what a text says, not
whether it ended.

## 2 · Design

**Option A — withhold persistence.** The seam already has a post-invocation refusal class (`no-model-answer`,
`not-durable`, `agent-mandate-changed-while-preparing`, `changed-while-preparing`, `write-refused`): the model was
invoked, its message provenance stays, no artifact or revision is written. A truncated reply is one more member.
Option B (persist with incomplete-output metadata) would need a durable field or status on the artifact, a reader
for it, and acceptance surfaces that refuse it — a schema and lifecycle change with no current owner. A was chosen.

## 3 · What changed (`1bb2de37`)

| File | Change |
|---|---|
| `src/features/work-artifacts/prepare-work-artifact.server.ts` | `PreparationRefusal` gains `output-truncated`; after the model-origin and durability checks and before either writer, `answer.modelStopReason === "max_tokens"` returns it. An unreported stop reason is not treated as a cut |
| `src/components/operations-preparation/prepare-with-hebun.tsx` | Wording for `output-truncated`, ending in the post-invocation sentence "No prepared work was written; any model call that happened stays in its message record." Read by Operations and by both Heby draft affordances (assign, revise), which prefix "No draft was written." / "No revision was written" |
| `tests/cgo9-hebun-preparation/surface-and-firewall.ts` | The pinned post-invocation set adds `output-truncated` (the pin changes with the union it pins) |
| `tests/output-integrity-1/truncation-postgres.ts` | New, T1–T10 |

`assignWorkDraft` and `reviseWorkDraft` pass the refusal through unchanged as `not-prepared`.

## 4 · Verification (V2)

V2: the shared preparation seam and its two callers. The full suite was not run: the change is one refusal before the
writers, and every suite that reaches the seam, its callers, the wording, or the validator was run on baseline and
candidate.

| Check | Result (2026-10-27) |
|---|---|
| `tests/output-integrity-1/truncation-postgres.ts` | PASS — T1 end_turn files the Security Planning Agent's plan once, verbatim, agent-authored; T2 max_tokens → `output-truncated`, artifacts +0, revisions +0, message record kept; T3 AOR-withheld → `no-model-answer`/`withheld`, +0; T4 provider failure → `provider-failed`, +0; T5 Content Agent content draft refused on max_tokens, filed on end_turn; T6 Engineering Agent plan the same; T7 revision from a change request: max_tokens files no revision, end_turn files exactly revision 2; T8 no work row, request or permit change in any case; T9 one model call per case and exact artifact/revision deltas; T10 the guard sits after the model-origin check and before both writers, and the wording says nothing was filed |
| Mutation: guard disabled (copy) | T10 fails; with T10 also disabled, T2 fails "artifacts +0" — the behaviour bites |
| 48 suites touching the seam, callers, wording or validator | baseline `eaae2f0c` 47/47 PASS (the new suite absent) · candidate 48/48 PASS · 0 REGRESSION, 0 PRE-EXISTING, 0 BLOCKED |
| `tsc --noEmit`, `eslint` on the four files, `git diff --check`, `npm run build` | exit 0 |

**Test environment.** macOS Darwin 25.2.0; PostgreSQL 18.6 initialised by this session (`initdb --no-locale -E UTF8`)
on 127.0.0.1:55499, `system_identifier` 7701404459474523701, via `HEBUN_TEST_ADMIN_DATABASE_URL`; `DATABASE_URL`
unset; suites and the mutation in disposable copies outside the repository; model faked at the transport.

## Closure Contract (v1)

- Phase: OUTPUT-INTEGRITY-1
- Owner: apps/dashboard/src/features/work-artifacts/prepare-work-artifact.server.ts (preparation seam); refusal wording in prepare-with-hebun.tsx
- Reached state: DEPLOYED
- Implementation commit: 1bb2de37c2c8cbc3b5ff62dbc953b2414e8a773b — on main via fast-forward eaae2f0c..1bb2de37
- Verification level: V2 — shared preparation seam and both callers; every suite reaching them run on baseline and candidate
- Verification evidence: 2026-10-27, truncation-postgres T1–T10 PASS; guard mutation bites; 48/48 suites PASS on the candidate, 47/47 on eaae2f0c; tsc, eslint, build exit 0
- Test environment: worktree .claude/worktrees/security-agent-d1 (npm ci, published lockfile); macOS Darwin 25.2.0; PostgreSQL 18.6 on 127.0.0.1:55499, system_identifier 7701404459474523701, via HEBUN_TEST_ADMIN_DATABASE_URL; disposable copies; no production database, no provider
- Deployment evidence: 2026-10-27, dpl_8SUyn8jq1md3FccJL9J6VU6VKSbg, githubCommitSha 1bb2de37, target production, READY; www.hebuntech.com, hebuntech.com, hebun-ai-recovered.vercel.app aliased; smoke / 200, /login 200, apex 308 → www, /heby and /operations 307 → /login; runtime log sample 0 5xx, 0 errors (low traffic)
- Production acceptance evidence: N/A — not production-accepted; dependency OI1-PROD-UNVERIFIED-1
- Deferred risks: OI1-PROD-UNVERIFIED-1 (DEFERRED); OI1-EXISTING-TRUNCATED-ARTIFACT-1 (DEFERRED); OI1-UNREPORTED-STOP-1 (DEFERRED); OI1-CEILING-FIT-1 (DEFERRED)
- Director approvals: output-integrity fix, commit, fast-forward push and production verification, 2026-10-27 ("WORK ARTIFACT OUTPUT INTEGRITY")

### Deferred risk detail

- **OI1-PROD-UNVERIFIED-1 (DEFERRED).** No production preparation has been refused as `output-truncated` yet, and
  the refusal wording has not rendered in production. Acceptance dependency: a Director-approved preparation, read
  back (refused with the wording, or filed complete with `end_turn`).
- **OI1-EXISTING-TRUNCATED-ARTIFACT-1 (DEFERRED).** Artifact `1196db5f…` revision 1 remains truncated and unmarked;
  by Director decision it is not accepted and not linked. Acceptance dependency: a Director decision (request changes,
  retire, or leave).
- **OI1-UNREPORTED-STOP-1 (DEFERRED).** A transport that reports no stop reason is not treated as truncated, so a cut
  without a reported reason would still be filed. The production Anthropic transport reports it.
- **OI1-CEILING-FIT-1 (DEFERRED).** At 1024 output tokens a four-area plan did not fit; such requests are now refused
  instead of filed cut. Acceptance dependency: a Director decision on request size or the ceiling.

**Weekly three.** *Learned:* received, accepted, completed, persisted and review-ready are five states; a guard on what
text says proves nothing about whether it ended. *Turkish Rug House:* no TRH plan or caption can reach review half
written. *Hebun AI:* every specialist's drafts inherit the same completeness floor from the one seam they share.
