# PLAN-FOLLOW-UP-LINEAGE-1 · closure record · DEPLOYED

An AI plan recommendation says when Work already records an OPEN follow-up for the work items it
names — "An existing follow-up is already recorded: ‹title› (‹state›)." — and the work register names
each recorded follow-up with its current state. Advisory only: the recommendation and its follow-up
offer are unchanged, nothing is suppressed, refused or authorized.

## 1 · What was implemented

| Commit | Content |
|---|---|
| `b572bcee` | `feat(work): show existing open follow-ups on AI plan recommendations`. Work authority: `isOpenFollowUp` (in service and not declared complete) and `existingFollowUpsFor` over its tenant-scoped `readWorkFollowUpLinks` (`follow-up-source-work.server.ts`). Plan runtime reads the links only AFTER the one model call and attaches `existing` per step (`ai-operational-plan.server.ts`, `plan-follow-up.ts`); the composer renders the advisory; the register shows each follow-up's state and says when the relationship read is unavailable or truncated (`work-register.tsx`, `director/work/page.tsx`). New test `tests/plan-follow-up-lineage-1/lineage.ts`. |

**Truth semantics.** An unavailable or truncated relationship read, a register that is not a complete
read, or a recorded follow-up outside it yields `unknown`, shown as such — never "none". A failed read
never fails the plan. No migration, no new persistence, no change to the model request, plan prompt,
moves, PFR binding, canonical payload, digest, permits or execution.

## 2 · Verification (V2)

V2: a shared seam — the AI planning runtime now reads a Work reader — and two surfaces; no write path,
schema, secret or provider boundary changed. Full suite run because the new cross-feature import is
exactly what import-graph firewall censuses pin.

| Item | Measured |
|---|---|
| Full suite, baseline `2e2bf5b1` | 1061 PASS / 2 FAIL of 1063 |
| Full suite, candidate `b572bcee` | 1062 PASS / 2 FAIL of 1064 (+1 new test); failing sets identical; `heby-product-ux-1` soft-assert sets identical (1 assertion, "Hebyis"); `r3w-flow/ambient-database-safety` did not run on either tree (:55432 unreachable) |
| New test | open / complete / retired / no relationship / unknown (truncated, unavailable, incomplete register, follow-up outside it); runtime reads links from the resolved tenant after the model call; model request identical with and without follow-ups (correlation id aside); binding minted from the same fields; foreign id → unknown, never rendered; register renders state, unavailable and truncated notices |
| Bite-proofs | dropping the `complete` check, and replacing the advisory with "none known": both caught |
| Static | `tsc --noEmit` 0; eslint 0 over the 7 changed files; `next build` 0 (175/175) in a detached worktree at `b572bcee` with a cloned `node_modules` (Turbopack refuses a symlinked one); `git diff --check` clean |

## Closure Contract (v1)

- Phase: PLAN-FOLLOW-UP-LINEAGE-1
- Owner: apps/dashboard/src/features/organizational-work/follow-up-source-work.server.ts (open-follow-up rule over Work's relationship read), consumed by the AI planning runtime and the work register; Governance, permits, execution, the plan contract and the PFR binding unchanged
- Reached state: DEPLOYED
- Implementation commit: b572bcee — released on `main` with e1e905dc (fast-forward from 2e2bf5b1); RUNTIME VERIFICATION PENDING, PRODUCTION ACCEPTANCE PENDING
- Verification level: V2 — the planning runtime gains a Work read and two surfaces change; no write path, schema, secret or provider boundary
- Verification evidence: full suite 2e2bf5b1 1061/2 of 1063, b572bcee 1062/2 of 1064, failing and soft-assert sets identical; lineage.ts PASS with 2 bite-proofs caught; tsc 0; eslint 0; next build 0; git diff --check clean
- Test environment: throwaway detached worktrees `.claude/worktrees/pfl1-suite-b572bcee` and `pfl1-suite-2e2bf5b1`, run sequentially; macOS (Darwin 25.2.0); Node 24 with tsx; PostgreSQL 18.6 superuser instance at 127.0.0.1:55433; no provider, no model
- Deployment evidence: dpl_2BmjPH1pbcScgaAt4ja32yN6Jjdj READY production at e1e905dc9c2d04ee9a04690114fb4eb485dc52c0 (source git, ready 2026-10-21T04:10:36Z), www.hebuntech.com and hebuntech.com resolve to it; signed-out smoke `/` 200, `/login` 200, `/heby`, `/approvals`, `/director/work` 307 → `/login`
- Production acceptance evidence: N/A — runtime render and acceptance PENDING (LINEAGE-BROWSER-UNVERIFIED-1)
- Deferred risks: LINEAGE-BROWSER-UNVERIFIED-1 (DEFERRED); LINEAGE-LINK-BOUND-1 (DEFERRED)
- Director approvals: implementation, focused tests and local commit 2026-10-21; push of e1e905dc to `main` by the Director 2026-10-21; read-only deployment verification and this documentation update 2026-10-21; push of this update NOT approved

### Deferred risk detail

- **LINEAGE-BROWSER-UNVERIFIED-1 (DEFERRED).** The advisory and the register state line are proven by
  server render only. Acceptance dependency: a signed-in render after release; a positive advisory
  needs an organically recorded open follow-up (PFR-RUNTIME-ACCEPTANCE-1), none is created for it.
- **LINEAGE-LINK-BOUND-1 (DEFERRED).** Work's relationship read returns at most 500 links; beyond that
  every advisory reads `unknown`. Acceptance dependency: a tenant approaching 500 recorded follow-up
  relationships, then a Director decision on a source-filtered read.
