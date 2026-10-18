# AP2-RULE6-RAW-SQL-1 — AP-2 Rule 6 Raw-SQL Hardening — Closure

Maintenance found by the AP-6b review (`hebun-ap6b-placement-aware-authorization-decision.md`, G2 and
G4). Test and comment only: no runtime behavior, schema, authority or placement changed.

**Status: VERIFIED, local, not released.**

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

## Closure Contract (v1)

- Phase: AP2-RULE6-RAW-SQL-1
- Owner: Organization Authority (AP-2 placement firewall, `tests/ap2-agent-placement/firewall.ts`); Governed Machine Execution (comment in `execute-record-work-as-machine.server.ts`)
- Reached state: VERIFIED
- Implementation commit: THIS COMMIT
- Verification level: V1 — one test seam and one comment; no runtime code changed (comment-stripped executable diff empty); the AP-2 firewall, its bite-proofs, and every suite naming the changed executor were run
- Verification evidence: AP-2 firewall PASS; 6/6 positive mutations caught, 2/2 negative controls pass; gap reproduced at e54cfa46; original rule 6 assertions still bite; 21/21 suites exit 0 on candidate and e54cfa46 copy; tsc 0; eslint clean (2026-10-18)
- Test environment: worktree `.claude/worktrees/ap6b-decision` (branch `maint/ap6b-decision-ap2-rule6`, base e54cfa46), disposable copies under the session scratchpad, per-file `node --import tsx`, disposable PostgreSQL 18 on 127.0.0.1:55433, `DATABASE_URL` unset
- Deployment evidence: N/A — not deployed
- Production acceptance evidence: N/A — not deployed; test and comment only
- Deferred risks: none
- Director approvals: AP-6b decision and the two maintenance changes, Director 2026-10-18; local commit only — push and deployment NOT approved

## Three questions

1. **What did we learn?** A firewall that names one spelling of a column guards that spelling: the
   Drizzle census could not see raw SQL or a whole-row read, and only a mutation proved it.
2. **How does this improve Turkish Rug House?** No runtime change; TRH keeps the same guarantee that its
   agent's placement cannot become authority, now enforced against more ways of reading it.
3. **How does this become part of Hebun AI?** "Placement grants nothing" is now held by the column's
   SQL name and by a ban on whole-row agent reads, so any future authority that needs placement has to
   be added openly, through review and its own gate.
