# P5-4 — Plan agent limit, Free schedules, BYOK outside the plan quota

Fourth slice of the P5 commercial scope (`docs/product-vision/runtime/hebun-p5-scope-design-gate.md`).

Director decisions:
- **D3:** BYOK model calls are not counted against the plan quota.
- **2026-11-23:** Pro admits 5 agents.
- **2026-11-23:** the operator cap counts every model call.

Released by PR #28 (merge `9d3de559`). No migration.

## What changed

- **Agent limit.** Free 1, Pro 5, Founding none.
  - An agent counts until it is retired; a suspended agent still counts.
  - The limit is enforced inside the agent registration transaction, under a per-tenant advisory lock,
    before the Governance decision is written. The count uses `agentNotRetiredCondition()` from the
    in-service rule module.
  - Templates (P5-3) go through the same writer.
  - Agents already above a limit are kept; only a new registration is refused.
- **Schedules.**
  - A Free plan cannot be granted standing research. Withdrawing one is always admitted.
  - A plan downgraded to Free stops the 08:00 run before the model. The check sits in
    `scanScheduledResearch`, the path the cron calls.
- **BYOK quota (D3).** The plan model quota counts platform-account disclosures only.
  - A disclosure whose `accountRef` is one of this tenant's own attested accounts is left out.
  - Rows recorded before BYOK carry no `accountRef` and still count.
  - A tenant-key call is bounded only by an operator-set deployment cap, which counts every model call
    of the day. Kill switches apply as before.
  - Media is unchanged.
- **Refusal wording.** `/agents` and the research affordance say what a plan refusal means.

## What is proven

- **A1–A4** (`tests/p5-4-plan-entitlements/entitlements-postgres.ts`).
  - Free refuses a second agent and writes nothing.
  - A retired agent frees its place.
  - Free → Pro takes effect on the next request, and Pro refuses the sixth agent.
  - Founding has no agent limit.
- **Q1–Q5** (same test).
  - With the platform key at the Free quota, a tenant-key call is still admitted.
  - Forty own-key calls leave the platform quota untouched.
  - A row with no `accountRef` counts as a platform call.
  - An operator cap of 3 refuses a tenant-key call when platform and own-key calls together reach 3.
  - A plan change applies to the next model request, and media is counted as before.
- **K1** (same test). With the operator switch paused, a call on the tenant's own account is refused in
  the disclosure decision.
- **Schedules** (`tests/p6-4-scheduled-research`).
  - A Free grant is refused, and nothing is written.
  - A plan downgraded to Free fails the run with `plan-schedule-not-included`, before any dispatch.

## What is not proven

- **Not observed in production.** No limit has been exercised there: no Free tenant was refused, and no
  own-key call was left out of a plan count. TRH holds no stored own key (read on
  `/integrations/anthropic`, 2026-11-23); other tenants were not checked.
- **The usage page.** `/account/plan` now shows platform-only model usage against the plan quota. No
  signed-in reader has seen it.

## Closure Contract (v1)

- Phase: P5-4-PLAN-ENTITLEMENTS
- Owner: P5 commercial scope design gate (`docs/product-vision/runtime/hebun-p5-scope-design-gate.md`), slice P5-4; apps/dashboard/src/features/tenant-entitlements/, the agent registration writer, the standing-research grant and scheduled run, and the AI dispatch safety cap
- Reached state: DEPLOYED
- Implementation commit: ee27402a86a64070e8c5458131c11de34ac376c1 (feature 7d8f0770 plus in-service rule fix; released on main by merge 9d3de55987775b546b530ebfbfa18c7062aac8cd)
- Verification level: V3 — an entitlement boundary at the seams that create agents, grant and run schedules, and admit model dispatch; full suite run on the pull request for that reason
- Verification evidence: full-suite run 45344655085 on ee27402a: 1183 passed, 0 failed, 2 excluded (manifest); the earlier run 45265546212 on 7d8f0770 failed l1a-agent-in-service/firewall (lifecycle column read outside the rule module), fixed in ee27402a; quick, targeted and Vercel checks passed on PR #28; locally tsc clean, eslint clean, next build green, 146 affected suites and, after the fix, 41 in-service and entitlement suites green against a session-created PostgreSQL (mutating ones in a disposable worktree, unchanged after)
- Test environment: local macOS worktree, Node 24, session-created PostgreSQL 18 on 127.0.0.1:55499 (system_identifier 7711330523535860062); GitHub Actions full-suite with disposable PostgreSQL
- Deployment evidence: GitHub deployment record for 9d3de559, environment Production, state success, created 2026-11-24T07:55:09Z, environment URL hebun-ai-recovered-f55np0q1f-hebuntechs-projects.vercel.app; www.hebuntech.com / and /login 200, /agents 307 to /login without a session
- Production acceptance evidence: N/A — no plan limit or own-key exemption has been exercised in production; P5 production acceptance is P5-9
- Deferred risks: P5-4-LIMITS-UNOBSERVED-1 (DEFERRED)
- Director approvals: D3 (2026-11-20); Pro agent limit 5 and operator cap counting every model call, 2026-11-23; P5-4 implementation, commit and PR #28, 2026-11-23; the fix commit and full-suite re-run, 2026-11-24; PR #28 merge and production deploy on green checks, 2026-11-24; this closure record, 2026-11-24

### Deferred risk detail

- **P5-4-LIMITS-UNOBSERVED-1 (DEFERRED).** The limits are proven against a test database, not
  production. Acceptance dependency, in P5-9:
  - a Free tenant refused a second agent and a schedule;
  - a Pro tenant admitted within its limits;
  - an own-key call excluded from the plan count, read back from `/account/plan`.

## Weekly three questions

1. **What did we learn?**
   - Grep for the function a real path calls before adding a gate there: `admitScheduledResearch` had
     no caller, and the 08:00 run re-checks inside `scanScheduledResearch`.
   - A lifecycle read belongs in the in-service rule module, not in a new counter.
   - Account-scoped quota counting can read the attestation table instead of importing the platform
     constant, which keeps the EAI importer census intact.
2. **How does this improve Turkish Rug House?** TRH is on Founding, so nothing it does is limited. If TRH
   brings its own Anthropic key, those calls will not spend any plan quota.
3. **How does this become part of Hebun AI?**
   - Free and Pro now differ where it costs: agents, schedules and platform model calls.
   - The limits are enforced where the act happens, so no screen can be bypassed to exceed them.
   - P5-5's agent schedules inherit the Free refusal.
