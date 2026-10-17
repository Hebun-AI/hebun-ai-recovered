# AP-5 Entry — Acceptance Contract and Agent Platform Record Reconciliation — Closure

**Documentation only.** Baseline `main` = `origin/main` = `f9ae3b4c493035d8b27882e3500b866f0d90dd64`,
measured with `git ls-remote origin refs/heads/main` before work began. Written in the isolated
worktree `.claude/worktrees/ap-5-entry` (branch `docs/ap-5-entry-contract`). The primary tree and
every other worktree were not written.

## What this phase did

1. **AP-5 entry and acceptance contract** — `hebun-ap5-two-agent-acceptance-contract.md`. It keeps the
   original AP-5 requirement verbatim, separates BINDING, INHERITED and PROPOSED requirements, and
   leaves every PROPOSED criterion (A1–A15) **unapproved**. It records the first implementation target
   (Hebun AI tenant, Heby, an Engineering-focused candidate, `record-work`) as a design proposal only,
   and the blocker `WORK-UPDATE-AGENT-SELECTION-1` with its fix seam.
2. **Seven missing closure records**, each holding only what the repository supports:

   | Phase | Reached state | Record |
   |---|---|---|
   | AP-3 | DEPLOYED | `hebun-ap3-dispatch-safety-cap-closure.md` |
   | AP-5A | DEPLOYED | `hebun-ap5a-plurality-readiness-closure.md` |
   | L-1a | DEPLOYED | `hebun-l1a-agent-in-service-closure.md` |
   | L-1b | DEPLOYED | `hebun-l1b-agent-lifecycle-governance-closure.md` |
   | L-2a | DEPLOYED | `hebun-l2a-service-status-truth-closure.md` |
   | L-2b | DEPLOYED | `hebun-l2b-agent-suspension-closure.md` |
   | CONTENT-AGENT-2 | DEPLOYED | `hebun-content-agent-2-closure.md` |

   None is PRODUCTION-ACCEPTED: no repository record measures any of them in production. Each leaves
   its acceptance OPEN under its own `*-PROD-ACCEPTANCE-1` risk.
3. **AP-4A record** — a dated reconciliation note appended to `hebun-ap4a-work-domain-foundation.md`;
   the original text, which said "uncommitted at the time of writing", is kept (§18 rule 3).
4. **MASTER-ROADMAP** — §20.4's measured table marked superseded where AP-1, AP-4 and WORK-UPDATE-V1
   changed it; new §20.5 records the Agent Platform program state; §21 gains eight rows and §22 gains
   nine rows. No unrelated roadmap text changed.

## How evidence was judged

- **A commit on `main` is not acceptance.** Every record says IMPLEMENTED evidence (commit,
  ancestry) separately from deployment and production evidence.
- **Deployment evidence comes from existing repository records.** The deployment that serves a phase
  is either named for that SHA in another record (AP-3: `hebun-ap4a-work-domain-foundation.md`;
  CONTENT-AGENT-2: `hebun-content-integrity-gs2-closure.md`) or is the recorded production deployment
  `dpl_3WiFeB1jLebse3vTuBKdp1at21Ri` at `1f8f9a47` (`hebun-eai-history-origin-1-closure.md`), of which
  every phase commit is an ancestor (`git merge-base --is-ancestor`, all seven true). The Vercel read
  seam available to this session returned `404 not_found` for the project, so no deployment was
  re-measured; that gap is `AP-RECON-DEPLOY-REMEASURE-1`.
- **Verification evidence** is the release commit's own recorded counts where it has them (L-1a, L-1b,
  L-2a) plus a re-measure of each phase's non-database suites at `f9ae3b4c`. PostgreSQL suites and
  bite-proofs were not run: the authorization forbids database writes, and bite-proofs mutate source
  files (`AP-RECON-POSTGRES-UNMEASURED-1`).
- **Machine memory was not used as evidence.** Session memory on the Director's machine records
  further deployment ids and acceptance claims for some of these phases; memory is not authority
  (`CLAUDE.md`), so none of it is cited.
- **Production was not read.** No database credential or secret was accessed.

## Validation

| Check | Result |
|---|---|
| `node --import tsx tests/development-continuity/closure-contract.ts` (from `apps/dashboard`) | exit 0 — repository satisfies §16.1 (legacy census unchanged: 164 records, sha256 754f7b397a6594b4e65f4a500373016db9dbe859e7c245e1cb97432f10d7d48b) |
| Phase non-database suites at `f9ae3b4c` (12 files) | all exit 0 — listed in each record |
| `git diff --check` | clean |
| Changed paths | `docs/` only; no `apps/`, schema, migration or config path |
| Secret scan of the diff | no credential, token, key or environment value |

## Closure Contract (v1)

- Phase: AP-5-ENTRY-RECONCILIATION
- Owner: Agent Platform documentation (`docs/product-vision/runtime/hebun-agent-platform-phase0-design-gate.md` program; `docs/MASTER-ROADMAP.md` §20.4, §20.5, §21, §22)
- Reached state: VERIFIED
- Implementation commit: THIS COMMIT — the commit that adds this record (local only, not pushed)
- Verification level: V0 — documentation only, no behaviour change; closure records touched, so the continuity test runs
- Verification evidence: `node --import tsx tests/development-continuity/closure-contract.ts` exit 0 with the new records and §21/§22 rows; `git diff --check` clean; diff confined to `docs/`
- Test environment: worktree `.claude/worktrees/ap-5-entry` at base f9ae3b4c, `node --import tsx`, no database
- Deployment evidence: N/A — not deployed; push not authorized
- Production acceptance evidence: N/A — documentation only; AP-5 is not started
- Deferred risks: WORK-UPDATE-AGENT-SELECTION-1 (DEFERRED); EHO-1-RED-SUITE-BASELINE-1 (DEFERRED); AP-RECON-POSTGRES-UNMEASURED-1 (DEFERRED); AP-RECON-DEPLOY-REMEASURE-1 (DEFERRED)
- Director approvals: AP-5 documentation and acceptance contract reconciliation, one scoped local commit, no push, no deploy, no production action (Director, 2026-10-17); the PROPOSED criteria A1–A15 and the first implementation target are NOT approved

## Deferred risks

- **AP-RECON-POSTGRES-UNMEASURED-1 (DEFERRED)** — the PostgreSQL suites and bite-proofs of AP-3, AP-5A,
  L-1a, L-1b, L-2a, L-2b and CONTENT-AGENT-2 were not re-run by this reconciliation; four of the seven
  release commits record no counts at all. Closes with a Director-approved disposable PostgreSQL 18
  run of those suites against a recorded baseline (see `EHO-1-RED-SUITE-BASELINE-1`).
- **AP-RECON-DEPLOY-REMEASURE-1 (DEFERRED)** — deployment evidence in the seven records is copied from
  other repository records and git ancestry, not re-read from Vercel; the read seam available here
  returned 404 for the project. Closes with a read of the production deployment record by an account
  that can see the project.
- `WORK-UPDATE-AGENT-SELECTION-1` and `EHO-1-RED-SUITE-BASELINE-1` stay owned by their records; this
  record lists them because AP-5 depends on them.

## Three questions

1. **What did we learn?** Seven phases shipped to production without a record, and their commit
   messages are the only verification they left — four of them recorded no counts. The record was
   written after the fact without adding a fact the repository does not hold.
2. **How does this improve Turkish Rug House?** It does not change TRH. It records that TRH cannot be
   the AP-5 tenant without an EAI ceremony first.
3. **How does this become part of Hebun AI?** AP-5 now has a written contract and one narrow first
   code task (the work-state agent choice), instead of a one-line intent.
