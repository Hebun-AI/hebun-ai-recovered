# P5-3 — An agent set up from a template

Third slice of the P5 commercial scope (`docs/product-vision/runtime/hebun-p5-scope-design-gate.md`).
Director decisions of 2026-11-23: the narrowest mandate scope, and an honest partial result. Released by
PR #26 (merge `de52acae`). No migration.

## What changed

- **Three templates** (`src/features/agent-templates/templates.ts`). Each carries a suggested name, the
  mandate purpose that P5-2 sends as the agent's role, the narrowest scope and organization
  responsibility.
  - Content and Operations: `set-work-declared-state`.
  - Research: `prepare-research`.
- **`createAgentFromTemplate`.** It calls the released writers in order and owns nothing:
  1. identity;
  2. mandate;
  3. placement, when a department is chosen.

  A refused first step writes nothing. A later refusal keeps the steps already done and names the failed
  step with the writer's own reason.
- **`/agents`** gains a template card and `createAgentFromTemplateAction`.
- **Out of scope:** agent-count limits per plan belong to P5-4.

## What is proven

`tests/p5-3-agent-templates/templates-postgres.ts`, against PostgreSQL:

- **Acceptance criterion 1** (T1). Each template registers the agent and records its mandate, with the
  template's purpose and scope. That is two Governance decisions. With a department, the agent is also
  placed, and one placement audit event is written.
- **Acceptance criterion 2** (T2). A member without Governance authority is refused, and nothing is
  written.
- **Acceptance criterion 3** (T7). The seam imports only the three released writers, the template
  constants and the tenant type, and makes no direct database call.
- **Refusals are reported.** T3: a name in use is refused at registration. T5: a refused placement
  leaves the identity and the mandate in place and returns `partial`. T6: an unknown template writes
  nothing.

## What is not proven

- **The refused-mandate branch is not driven.** The identity and mandate writers share validators, so
  no input passes step 1 and fails step 2 deterministically. Its result has the same shape as the
  placement branch.
- **Nothing observed in production.** No agent has been set up from a template in production, and the
  card has not been seen there by a signed-in reader.

## Closure Contract (v1)

- Phase: P5-3-AGENT-TEMPLATES
- Owner: P5 commercial scope design gate (`docs/product-vision/runtime/hebun-p5-scope-design-gate.md`), slice P5-3; apps/dashboard/src/features/agent-templates/ and the /agents template card
- Reached state: DEPLOYED
- Implementation commit: 841f6c18a98e2adc3a98c21e5f9f652903700a92 (released on main by merge de52acae165de9f10bd5138eca0eb1625d5f742d)
- Verification level: V2 — a product seam over three released writers (identity, mandate, placement) with their caller and importer censuses; no schema, data-use or provider change
- Verification evidence: full-suite run 45236244124 on 841f6c18: 1182 passed, 0 failed, 2 excluded (manifest); quick, targeted and Vercel checks passed on PR #26; locally tsc clean, eslint clean, next build green, 152 affected suites green against a session-created PostgreSQL (20 mutating ones in a disposable worktree, unchanged after)
- Test environment: local macOS worktree, Node 24, session-created PostgreSQL 18 on 127.0.0.1:55499 (system_identifier 7711330523535860062); GitHub Actions full-suite with disposable PostgreSQL
- Deployment evidence: GitHub deployment record for de52acae, environment Production, state success, created 2026-11-23T19:14:35Z, environment URL hebun-ai-recovered-cm41sod9s-hebuntechs-projects.vercel.app; www.hebuntech.com / and /login 200, /agents 307 to /login without a session
- Production acceptance evidence: N/A — no agent has been set up from a template in production; P5 production acceptance is P5-9
- Deferred risks: P5-3-TEMPLATE-UNOBSERVED-1 (DEFERRED); P5-3-MANDATE-PARTIAL-UNDRIVEN-1 (DEFERRED)
- Director approvals: P5-3 decisions (narrowest scope, honest partial result), 2026-11-23; P5-3 implementation, commit and PR #26, 2026-11-23; PR #26 merge and production deploy on green checks, 2026-11-23; this closure record, 2026-11-23

### Deferred risk detail

- **P5-3-TEMPLATE-UNOBSERVED-1 (DEFERRED).** No agent has been set up from a template in production.
  Acceptance dependency: P5-9 sets up the Content and Research agents on TRH from templates (D1). That
  run reads back their mandates and the template card on `/agents`.
- **P5-3-MANDATE-PARTIAL-UNDRIVEN-1 (DEFERRED).** The `partial` result for a refused mandate step has no
  test that drives it. Acceptance dependency: a test seam on the mandate writer, if a future change
  makes step 2 refusable on its own.

## Weekly three questions

1. **What did we learn?** A new caller of a released writer trips every census that pins who calls or
   imports it: the actions boundary, mandate importers, product callers, placement importers and the
   mandate entry. Grep the tests for the writer's path before the first run. Agent placement is a column
   on `agents` plus an audit row, not a decision record.
2. **How does this improve Turkish Rug House?** TRH can add a Content, Research or Operations agent in
   one form. Each agent comes with a role its Governance can read, and with the narrowest permission
   that lets it do that one kind of work.
3. **How does this become part of Hebun AI?** Every customer starts with the same three presets over the
   same Governance acts. P5-4 then decides how many agents each plan admits, and P5-5 gives a template
   agent its scheduled task.
