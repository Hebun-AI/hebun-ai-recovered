# AOR-1b-ATTRIBUTIVE-1 · closure record · DEPLOYED — internal drafts may use attributive approval terms

**Scope, stated first.** Authorized by the Director on 2026-10-27 ("AOR-1b TARGETED VALIDATOR FIX"). A narrow
change to the AOR-1b `internal-draft` action-claim mode in `src/features/heby-runtime/response-validator.ts`,
after two production preparations by the Security Planning Agent were withheld. AOR-1b stays on; the answer mode,
the eight AOR-1a verbs, the governing distance and `MODEL_OUTPUT_TOKEN_CEILING` (1024) are unchanged. No model or
provider was called, no agent, mandate, work or artifact was created, and the Security plan was not retried.

## 1 · Production evidence and root cause

| Call | Diagnosis line (`work-preparation-model-outcome`, runtime log) |
|---|---|
| 1 | `served: withheld`, `issueCodes: ["action-claim:authorized"]`, `stopReason: max_tokens`, message `b3719168-6de7-4a21-b871-d18ba0da43ec` |
| 2 | `served: withheld`, `issueCodes: ["action-claim:approved"]`, `stopReason: end_turn`, message `c15c9655-f71b-4d9e-bd57-df9a9051c29f` |

The withheld text is never stored, so the exact sentence is unknown. The rule explains it: in `draftClaimsAnAction`
a participle with no auxiliary passed only straight after a condition word or as `who <verb>`, and a modal's reach
ended at `and`. Run against the released rule, "Evidence to request: approved access list", "Evidence: list of
authorized integrations", "all integrations have an approved owner" and "every privileged role must be documented
and approved" were all withheld — the ordinary vocabulary of a security review plan. Call 1 also reached the
1024-token ceiling; the shorter Part 1 instruction ended with `end_turn`, so the ceiling is not this phase's issue.

## 2 · What changed (`986ff586`)

In `internal-draft` mode only:

1. **Attributive participle.** A bare `approved`/`authorized`/… passes when the next token is noun-like (not `by`,
   a determiner, pronoun, preposition, coordinator or time word) and the previous token is a determiner or
   preposition, or the participle opens a clause straight after a colon. `that` is not a determiner here.
2. **Coordination.** A bare participle after `and`/`or` inherits the frame of the participle before it, judged by
   the same rules; a completed chain there (`was reviewed and approved`) is still a claim.
3. **Two draft-only report verbs.** `completed` and `changed` are claims only as reports — a completed auxiliary or
   self-attribution — with their own codes `action-claim:completed` / `action-claim:changed`. `validateResponse`
   adds them only when the mode is `internal-draft`.

Clause splitting, negation, self-attribution, the open-question rule and the B1–B8 anchors are unchanged.

## 3 · Verification (V2)

V2: a shared output-validation seam used by every Heby preparation; its callers' suites are the boundary. The full
suite was not run: the change is confined to `draftClaimsAnAction` and the claim list `validateResponse` iterates in
one mode, and every suite that reaches either (`validateResponse`, `claimsAnAction`, `response-validator`,
`actionClaimMode`, `prepareWorkArtifact`, `assignWorkDraft`) was run on baseline and candidate.

| Check | Result (2026-10-27) |
|---|---|
| `tests/aor-1b/draft-claims-contract.ts` | PASS — D1–D6 unchanged; D7 13 planning sentences pass (the Director's five included); D8 20 reports withheld (the Director's six included) plus every earlier D2/D3 claim; D9 answer mode does not judge the new verbs, draft mode withholds with `action-claim:completed`; D10 three known residuals pinned withheld |
| `tests/aor-1b/bite-proofs.ts` | 10 mutations bit, 0 void (B1–B8 unchanged, B9 attributive ignores the preceding word, B10 completed chain inherited) |
| 46 suites touching the seam (aor-1a, aor-1b, e25–e28, heby-prompt-injection-boundary-1, ca2, cgo3–cgo9, content-agent-specialist-1, content-agent-2, agent-execution-1/2, heby-workflow-1, ap5a, work2, relevance2a, security-center and others) | baseline `8bbcdecf` 46/46 PASS · candidate 46/46 PASS · 0 REGRESSION, 0 PRE-EXISTING, 0 BLOCKED |
| `tsc --noEmit`, `eslint` on the three files, `git diff --check`, `npm run build` | exit 0 |

**Test environment.** macOS Darwin 25.2.0; PostgreSQL 18.6 initialised by this session (`initdb --no-locale -E UTF8`)
on 127.0.0.1:55499, `system_identifier` 7701404459474523701, via `HEBUN_TEST_ADMIN_DATABASE_URL`; `DATABASE_URL`
unset. Source-mutating bite-proofs and all suites ran in disposable copies outside the repository (baseline from
`git archive 8bbcdecf`, candidate rsynced from the worktree), `node_modules` from `npm ci` on the published lockfile.

## 4 · Release

Remote `main` read as `8bbcdecf` immediately before push; `986ff586` its child. Fast-forward `8bbcdecf..986ff586`,
no force. Deployment evidence in the Closure Contract below.

## Closure Contract (v1)

- Phase: AOR-1b-ATTRIBUTIVE-1
- Owner: apps/dashboard/src/features/heby-runtime/response-validator.ts (internal-draft action-claim mode); tests/aor-1b
- Reached state: DEPLOYED
- Implementation commit: 986ff58661d7c9fca61ccf966523bcff4c76ffe3 — on main via fast-forward 8bbcdecf..986ff586
- Verification level: V2 — shared output-validation seam; every caller suite run on baseline and candidate, bite-proofs B1–B10
- Verification evidence: 2026-10-27, draft-claims-contract D1–D10 PASS; bite-proofs 10 bit, 0 void; 46/46 seam suites PASS on 8bbcdecf and on the candidate; tsc, eslint, build exit 0
- Test environment: worktree .claude/worktrees/security-agent-d1 (npm ci, published lockfile); macOS Darwin 25.2.0; PostgreSQL 18.6 on 127.0.0.1:55499, system_identifier 7701404459474523701, via HEBUN_TEST_ADMIN_DATABASE_URL; disposable copies; no production database, no provider
- Deployment evidence: 2026-10-27, dpl_5TszkpT9B5AGM2AQjhfRrUGTzQwt, githubCommitSha 986ff586, target production, READY; www.hebuntech.com, hebuntech.com, hebun-ai-recovered.vercel.app aliased; smoke / 200, /login 200, apex 308 → www, /heby 307 → /login; runtime log sample 0 5xx, 0 errors (low traffic)
- Production acceptance evidence: N/A — not production-accepted; dependency AOR1BA-PROD-UNVERIFIED-1
- Deferred risks: AOR1BA-PROD-UNVERIFIED-1 (DEFERRED); AOR1BA-ATTRIBUTIVE-PRESUPPOSITION-1 (DEFERRED); AOR1BA-LABEL-TELEGRAPHIC-1 (DEFERRED); AOR1B-HEURISTIC-RESIDUAL-1 (DEFERRED)
- Director approvals: targeted AOR-1b internal-draft fix, commit, fast-forward push and production verification, 2026-10-27 ("AOR-1b TARGETED VALIDATOR FIX")

### Deferred risk detail

- **AOR1BA-PROD-UNVERIFIED-1 (DEFERRED).** No production preparation has yet passed under the new rule. Acceptance
  dependency: a Director-approved Security Planning Agent retry, or an organic internal draft, read back.
- **AOR1BA-ATTRIBUTIVE-PRESUPPOSITION-1 (DEFERRED).** An attributive participle presupposes a past act: "the approved
  budget" now passes in a draft. Accepted by the Director's pass list; a reviewer still accepts every draft.
- **AOR1BA-LABEL-TELEGRAPHIC-1 (DEFERRED).** After a colon a participle followed by a noun passes, so a telegraphic
  report ("Note: approved deployment of 4.2") passes; outside a label ("Approved deployment to production.") it is
  withheld.
- **AOR1B-HEURISTIC-RESIDUAL-1 (DEFERRED, narrowed).** Still lexical. Pinned fail-closed in D10: a marker beyond three
  tokens, a comma-separated participle list, a clause-initial participle outside a label (`- Approved vendor list`).
  The draft-only report verbs pass bare ("The policy changed.").

**Weekly three.** *Learned:* a fail-closed lexical guard needs the vocabulary of each new domain measured — security
planning is dense in participles used as adjectives. *Turkish Rug House:* internal plans and checklists for TRH stop
being withheld for naming an "approved supplier list". *Hebun AI:* specialist agents can write domain plans in their
own vocabulary while the claim guard stays on.
