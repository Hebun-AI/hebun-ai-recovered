# P5-5 — Scheduled agent task

Fifth slice of the P5 commercial scope (`docs/product-vision/runtime/hebun-p5-scope-design-gate.md`).

Director decisions, 2026-11-24:
- New parallel tables (migration 93). P6 is untouched.
- Live runs use the tenant's own key only, until GATE-D closes.
- The model gets the brief and the agent's role, with no grounding.
- The run is Monday 08:00 Istanbul, one ISO week per (tenant, template).
- One kill switch, `agent-task-schedule`, starting off.
- A new cron entry.

Released by PR #30 (merge `3a3baaf3`). Migration 93 was applied to production on 2026-11-24.

## What changed

- **Authorization.** `standing_agent_task_authorizations` holds one revisioned lineage per (tenant, template).
  - The templates are `weekly-content-plan` and `weekly-operations-summary`.
  - Granting and withdrawing are Governance decisions in the new `standing-agent-task` domain, made by
    a person holding Governance authority and checked against the current revision.
  - A CHECK requires a human authorizer.
  - A Free plan cannot be granted one (P5-4). Withdrawing one is always admitted.
- **The run.** Each Monday the cron calls `/api/standing-agent-task/scan`.
  - The route has its own bearer secret, `HEBUN_STANDING_AGENT_TASK_TRIGGER_SECRET`, and is listed in
    `MACHINE_INGRESS_PATHS`.
  - The scan claims a `scheduled_agent_task_runs` row for (tenant, template, ISO week) before it asks
    anything. A second tick in the same week finds the row and stops.
  - Before the model it re-checks:
    - the switch;
    - that the authorization is in force;
    - that the organization is active and the plan includes schedules;
    - that the granter is still an active member holding Governance;
    - that the agent is eligible and within its mandate ceiling;
    - authorship and the Claude control;
    - the tenant's own key, else `agent-task-requires-own-key`;
    - the data-use decision.
  - The model gets the template lead, the brief, and the role in fenced material. The run files one
    internal `operational-plan` draft, authored by a system creator.
  - Inside the filing transaction it re-reads the authorization and the mandate, then marks the run
    filed.
- **Surface.** `/agents` has a card to grant, replace or withdraw each template, with plan and refusal
  wording.
- **Eligibility at grant time is not read.**
  - Reading it pulled the agent-work seam, and with it the memory substrate, into the `/agents` action
    boundary, which `agent-id-0-1` forbids.
  - Tenant ownership of the work item and agent is a composite FK.
  - Eligibility is checked by every run before the model, which fails with `agent-not-eligible`.

## What is proven

- **W1–W8** (`tests/p5-5-scheduled-agent-task/scheduled-agent-task-postgres.ts`):
  - With the switch off, nothing runs and nothing is read or written (W1).
  - An authorized run files one internal draft authored by the agent. The request carries the brief,
    the template lead and the role (fenced), and declares conversation, work-artifact and
    agent-mandate. There is no external act (W2).
  - A second tick in the same ISO week asks nothing (W3), and the next week runs again (W4).
  - Each of these stops the run before the model, and the ledger records why (W5):
    - a withdrawn authorization;
    - a plan downgraded to Free;
    - the Claude control off;
    - a live run without an own key;
    - data use not authorized.
  - A Free plan cannot be granted a task, and nothing is written (W6).
  - The two templates are independent lineages and weeks (W7).
  - The ISO week is computed in Istanbul time (W8).
- **Censuses.** Each new route, cron, mandate enforcer, EAI importer, human-only CHECK, enum value,
  run ledger and `/agents` action is named in its census, with its reason.
- **Production schema.**
  - The Director ran `platform:migrate` at a TTY from a detached worktree at `3a3baaf3`.
  - Before applying, it reported ledger 92 of 93, exactly one pending migration, and a validated backup:
    `hebun_production_pre_migration_20261124-120116.dump` (1,128,058 bytes, 1028 entries,
    `pg_restore -l` OK).
  - Result: `SUCCESS`, ledger 92 → 93, digest `536609093728d14eb6a46caebd335747`, organizational data
    unchanged across every counted table.
  - A second run reported `ALREADY_CONVERGED`, 93 of 93.
  - A local rehearsal on a session-created PostgreSQL went first (92 → 93, same digest, then
    `ALREADY_CONVERGED`).
- **Ingress.** In production, `/api/standing-agent-task/scan` with no credentials answers 401, not
  307 to `/login`. The middleware lets the path through, and the route refuses.

## What is not proven

- **No run has happened in production.**
  - The trigger secret is not set, and the `agent-task-schedule` switch is off.
  - No tenant holds an authorization.
  - TRH holds no stored own key (read on `/integrations/anthropic`, 2026-11-23).
- **The `/agents` card** has not been read by a signed-in user in production.

## Closure Contract (v1)

- Phase: P5-5-SCHEDULED-AGENT-TASK
- Owner: P5 commercial scope design gate (`docs/product-vision/runtime/hebun-p5-scope-design-gate.md`), slice P5-5; apps/dashboard/src/features/standing-agent-task/, the `/agents` agent task card and actions, `/api/standing-agent-task/scan`, and the internal draft writer's scheduled entry
- Reached state: DEPLOYED
- Implementation commit: ffc4464cb05ff925f8b42dbdc31ddacd2420f4e5 (released on main by merge 3a3baaf396f8de2e1326e226cef3b4b38cb20dd1)
- Verification level: V3 — a schema migration, a new Governance domain, a machine ingress and a model dispatch path; full suite run on the pull request for that reason
- Verification evidence: full-suite run 45380407358 on ffc4464c: 1184 passed, 0 failed, 2 excluded (manifest), tree unchanged; quick, targeted and Vercel checks passed on PR #30; locally tsc clean, eslint clean, next build green, W1–W8 green against a session-created PostgreSQL. The local full suite in a disposable worktree read 1179 passed and 7 red: agent-id-0-1 (2) and media-storage-acceptance were fixed in ffc4464c; plan-step-idempotency-1/bite-proofs passed on rerun with no change; br1 (pg_dump 14), br2 (disk below floor) and r3w (pre-existing) were BLOCKED by the local environment
- Test environment: local macOS worktree, Node 24, session-created PostgreSQL 18 on 127.0.0.1:55499 (system_identifier 7711330523535860062); GitHub Actions full-suite with disposable PostgreSQL
- Deployment evidence: GitHub deployment record 8026862189 for 3a3baaf3, environment Production, state success, created 2026-11-24T11:46:32Z, environment URL hebun-ai-recovered-a2z4qfdgw-hebuntechs-projects.vercel.app; www.hebuntech.com / 200, /agents 307 to /login without a session, /api/standing-agent-task/scan 401 without credentials; production migration 93 SUCCESS then ALREADY_CONVERGED, digest 536609093728d14eb6a46caebd335747
- Production acceptance evidence: N/A — no scheduled agent task has run in production; the trigger secret is unset and the switch is off; P5 production acceptance is P5-9
- Deferred risks: P5-5-RUN-UNOBSERVED-1 (DEFERRED)
- Director approvals: P5-5 design decisions (parallel tables, own key only, brief and role with no grounding, Monday 08:00 with one switch, new cron), 2026-11-24; P5-5 implementation, 2026-11-24; commit and PR #30, 2026-11-24; PR #30 merge and production deploy on green checks, 2026-11-24; production migration 93 at a TTY, 2026-11-24; this closure record, 2026-11-24

### Deferred risk detail

- **P5-5-RUN-UNOBSERVED-1 (DEFERRED).** The run is proven against a test database, not production.
  Acceptance dependency, in P5-9:
  - the trigger secret set and the switch turned on (each a Director gate);
  - a tenant holding its own Anthropic key and a granted template;
  - one Monday run that files a draft, read back on the work item, with its ledger row `filed`.

## Weekly three questions

1. **What did we learn?**
   - A new cron route needs its path in `MACHINE_INGRESS_PATHS`. Without it the scheduler gets
     `307 -> /login`, and only the ingress censuses caught it.
   - Census lists are sorted, so a new entry goes where it sorts, not next to its sibling.
   - Reading eligibility in a writer reachable from an action boundary drags the whole agent-work seam
     behind it. The run re-checks eligibility anyway.
2. **How does this improve Turkish Rug House?** Once TRH stores its own key and grants a template, an agent
   it already mandated drafts a weekly content plan or operations summary every Monday, for a person to
   review. Nothing is sent or published.
3. **How does this become part of Hebun AI?**
   - Agents now do recurring work, not only on request.
   - The work still goes through the same Governance grant, mandate ceiling, data-use decision and kill
     switch as every other agent act.
   - P5-6 and later slices can add templates to the same lineage without a new table.
