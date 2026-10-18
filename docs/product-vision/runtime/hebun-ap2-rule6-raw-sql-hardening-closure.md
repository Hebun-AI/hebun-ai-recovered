# AP2-RULE6-RAW-SQL-1 — AP-2 Rule 6 Raw-SQL Hardening — Closure

Maintenance found by the AP-6b review (`hebun-ap6b-placement-aware-authorization-decision.md`, G2 and
G4). Test and comment only: no runtime behavior, schema, authority or placement changed.

**Status: RELEASED — production deployment verified (reached state DEPLOYED), 2026-10-18.**

## Release and deployment

| What | State | Evidence |
|---|---|---|
| Regression test implemented | `0ebf2d5e` (census + whole-row ban, executor comment); `f200eed4` (whole-row message narrowed, Limitations below) | git history |
| Test behavior verified | Repository-time only: the firewall runs when the suite is run, never in production | Verification, below |
| Commit released | `main` = `f200eed47de797ca5584237ef49b9188d6121f94`, one non-force fast-forward `87274f2c..f200eed4` (with `e54cfa46`), Director-approved, 2026-10-18 16:57:37Z | `git ls-remote origin refs/heads/main` before and after the push |
| Deployment | `dpl_EzZ1qbQYtgiSQisZXMVzvD6biomR`: production, READY, PROMOTED, `githubCommitSha` `f200eed4`, ready 16:59:14Z; `www.hebuntech.com` and `hebuntech.com` aliased to it | Vercel deployment record and alias inspection |
| Production runtime behavior | **Unchanged.** The release changed a test, one comment and documentation; executable code is byte-identical to `87274f2c` after comment stripping. Read-only smoke: `/login` 200, unauthenticated `/approvals` 307 → `/login`, `/` 200, apex 308 → www; no 5xx on those routes | curl, no session |

The firewall is not a production authorization control. Production authorization behavior is what
`87274f2c` already ran; this release makes a regression in it more likely to fail a test, nothing more.

## What changed

| Change | Before | After |
|---|---|---|
| AP-2 rule 6 (`tests/ap2-agent-placement/firewall.ts`) | Only the Drizzle identifier `agents.departmentId` was censused. Raw SQL (`a.department_id`) and whole-row reads of `agents` were invisible: a mandate module reading `select a.department_id from agents a` passed the firewall | Kept both existing assertions unchanged, and added two: (1) every file whose comment-stripped code names `department_id` is in a reviewed allowlist with its reason — schema declarations, the writer's column list, disclosure and Live Map prose, the diagnostics/shadow display join in `canonical-read/actor-resolution.ts`, and the quarantined legacy adapter and codec; (2) no module reads whole `agents` rows (`select().from(agents)`, `getTableColumns(agents)`, `db.query.agents.`, `select * from agents`, `select a.*`) — today none does |
| Machine executor comment (`governed-machine-execution/execute-record-work-as-machine.server.ts`) | Said the agent row is not read inside the spend transaction and the residual window is not zero | States what `spendPermit` does since L-2b: the executor's liveness and ceiling reads are early refusals; the binding checks run inside the spend with the agent row `FOR SHARE`, then mandate and responsibility; the mandate read stays unlocked (L-2b residual). Executable code byte-identical after comment stripping |

## Verification

- Firewall: candidate PASS. Mutations in disposable copies of the candidate tree — all caught by the
  new assertions: raw-SQL read in `agent-mandate/read-agent-mandate.server.ts`; `select().from(agents)`
  in `consume-action-permit.server.ts`; `getTableColumns(agents)` in `agent-origination/candidate-set.server.ts`;
  `db.query.agents.findFirst()` in the machine executor; `SELECT * FROM public.agents` in the standing
  issuer; an allowlisted file that stops naming the column (stale allowlist). Negative controls pass:
  the unmutated tree, and a comment-only mention of `department_id` in a mandate module.
- The gap was real: the same raw-SQL mutation PASSES the firewall at `e54cfa46`.
- Rule 6 is not weakened: a Drizzle `agents.departmentId` read and a placement-module import in a
  mandate module still fail the original assertions.
- 21 suites — `ap2-agent-placement/{firewall, bite-proofs, placement-postgres}`, every suite naming the
  machine executor, `l2b-agent-suspension/*`, `apf1-agent-containment/*` — exit 0 on the candidate and
  on a disposable copy of `e54cfa46`; identical exit sets; the candidate tree unchanged after the
  bite-proofs ran.
- `tsc --noEmit` 0 errors; eslint clean on both changed files; continuity test and `git diff --check`
  clean.

## Limitations

The census is regression protection for the read shapes it names, not proof that no placement read is
possible. Known blind spots:

- **File-level allowlist.** An allowlisted file (the display join, the legacy adapter and codec, the
  two prose files, the schema files) can gain a real read without failing; review of those files is
  the guard.
- **Composed or dynamic SQL.** A column name built from parts or passed through `sql.raw` with a
  variable is not seen.
- **Aliased table imports.** `import { agents as a }` then `.from(a)` evades the whole-row pattern.
- **Whole-row joins.** `select()` with `agents` joined in returns its columns and is not recognized
  (none exists today).
- **Computed property access.** `agents["departmentId"]` or destructuring evades the Drizzle census.
- **Sources outside the scan.** Only `src/**/*.ts(x)` outside migrations is read: `scripts/`, SQL
  views, functions and other database objects are not.

Possible false positives: a legitimate new `department_id` use (for example a work item's) fails until
allowlisted with its reason; `select a.*` for a non-agent alias `a`; any `db.query.agents.` read, even
one selecting explicit columns.

## Closure Contract (v1)

- Phase: AP2-RULE6-RAW-SQL-1
- Owner: Organization Authority (AP-2 placement firewall, `tests/ap2-agent-placement/firewall.ts`); Governed Machine Execution (comment in `execute-record-work-as-machine.server.ts`)
- Reached state: DEPLOYED
- Implementation commit: 0ebf2d5e76af83d4a784e7c3ab9741be41af295a, f200eed47de797ca5584237ef49b9188d6121f94
- Verification level: V1 — one test seam and one comment; no runtime code changed (comment-stripped executable diff empty); the AP-2 firewall, its bite-proofs, and every suite naming the changed executor were run
- Verification evidence: AP-2 firewall PASS; 6/6 positive mutations caught, 2/2 negative controls pass; gap reproduced at e54cfa46; original rule 6 assertions still bite; 21/21 suites exit 0 on candidate and e54cfa46 copy; tsc 0; eslint clean (2026-10-18)
- Test environment: worktree `.claude/worktrees/ap6b-decision` (branch `maint/ap6b-decision-ap2-rule6`, base e54cfa46), disposable copies under the session scratchpad, per-file `node --import tsx`, disposable PostgreSQL 18 on 127.0.0.1:55433, `DATABASE_URL` unset
- Deployment evidence: dpl_EzZ1qbQYtgiSQisZXMVzvD6biomR, production, READY, PROMOTED, githubCommitSha f200eed47de797ca5584237ef49b9188d6121f94, aliased to www.hebuntech.com and hebuntech.com (2026-10-18)
- Production acceptance evidence: N/A — a repository test and a comment have no production behavior to measure; read-only smoke after deployment showed no 5xx on /login, /approvals, /
- Deferred risks: none
- Director approvals: AP-6b decision and the two maintenance changes, Director 2026-10-18; local commits 0ebf2d5e and f200eed4; release of f200eed4 and its production deployment (Director, 2026-10-18); documentation closure of this record (Director, 2026-10-18), local commit, push NOT approved

## Three questions

1. **What did we learn?** A firewall that names one spelling of a column guards that spelling: the
   Drizzle census could not see raw SQL or a whole-row read, and only a mutation proved it.
2. **How does this improve Turkish Rug House?** No runtime change; TRH keeps the same guarantee that its
   agent's placement cannot become authority, now enforced against more ways of reading it.
3. **How does this become part of Hebun AI?** "Placement grants nothing" is now held by the column's
   SQL name and by a ban on whole-row agent reads, so any future authority that needs placement has to
   be added openly, through review and its own gate.
