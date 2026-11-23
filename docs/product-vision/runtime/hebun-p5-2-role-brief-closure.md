# P5-2 — An agent's mandate purpose reaches the model as its role

Second slice of the P5 commercial scope (`docs/product-vision/runtime/hebun-p5-scope-design-gate.md`),
Director decisions D5, D8 and D9. Released by PR #24 (merge `527c17f2`); migration 92 applied to
production; Turkish Rug House's assistance decision renewed to cover the new class.

## What changed

- The preparation seam reads the author agent's in-force mandate once. The ceiling judges that read,
  and its `purpose` travels as the agent's role, so the role and the permission cannot come from
  different revisions. Only a Governance mandate revision writes a purpose.
- The role is fenced material (`--- AGENT ROLE BEGINS/ENDS ---`). Only a minted Hebun sentence joins
  the instruction channel, so a purpose that says "ignore the rules" changes none. No agent, mandate,
  decision or tenant id is sent.
- New data class `agent-mandate` and platform cell `anthropic/messages × assistance × agent-mandate`,
  appended last with the same attestation bounds. A tenant that has not authorized the class is refused
  the whole agent draft. Migration `20261123113927_p5_2_agent_mandate_data_class` widens the
  `tenant_ai_data_use_scopes` data_class CHECK.
- `/governance/authority` names the class. The operator ceremony expects it.
- Research preparation is unchanged (P5-7).

## What is proven

- **Acceptance criterion 1.** The same work given to two agents produces two different role sections and
  one identical instruction channel. Shown in `tests/p5-2-role-brief` R1, and against PostgreSQL in
  `tests/agent-execution-2/specialist-delegation-postgres` S3.
- **Acceptance criterion 2.** A request carrying the role is refused `tenant-not-authorized` until the
  tenant's assistance decision includes `agent-mandate`. Renewing from the recorded policy adds exactly
  that pair (R4).
- **Acceptance criterion 3.** One module inserts mandate revisions, and it asks the released Governance
  resolver first (R6; `ama1` proves the refusal).
- **Production schema.**
  - The Director ran `platform:migrate` at a TTY from a detached worktree at `76a0c29c`. Before
    applying, it reported ledger 91 of 92, exactly one pending migration, and a validated backup
    `hebun_production_pre_migration_20261123-140525.dump` (1,126,006 bytes, 1028 entries,
    `pg_restore -l` OK).
  - Result: `SUCCESS`, ledger 91 → 92, digest `f74dd46e59c1f2e94f0daca8c7285745`, organizational data
    unchanged across every counted table.
  - A second run reported `ALREADY_CONVERGED`, 92 of 92.
  - A local rehearsal on a session-created PostgreSQL went first, with the same result.
- **Tenant authorization.**
  - On 2026-11-23, signed in as TRH's genesis Governance holder, the assistance decision was withdrawn
    (revision 2) and re-authorized (revision 3) through `/governance/authority`, with stated reasons.
  - The page then read "Authorized (revision 3)", bound to the same processor review.
  - The writer takes the new revision's pairs from the recorded policy, which holds four assistance
    classes.

## What is not proven

- No agent draft carrying a role has been prepared in production. The role section has been observed
  only against test transports.
- Revision 3's scope rows were not read from the database. The page lists the policy's classes, not
  the decision's rows, so the four-class claim rests on the writer's code and its tests.
- The in-app card cannot add a class to an assistance decision in force. Adding one took two decisions,
  and for a few seconds between them Heby assistance was refused for TRH.

## Closure Contract (v1)

- Phase: P5-2-ROLE-BRIEF
- Owner: P5 commercial scope design gate (`docs/product-vision/runtime/hebun-p5-scope-design-gate.md`), slice P5-2; apps/dashboard/src/features/work-artifacts/ (preparation seam and brief), apps/dashboard/src/features/external-ai-data-use/ (class and platform cell), migration 20261123113927_p5_2_agent_mandate_data_class
- Reached state: DEPLOYED
- Implementation commit: 76a0c29c62fb9499bff4811518c7598f0f04361f (feature 8af5b2f9 plus pin fix; released on main by merge 527c17f2f5823dc67cacaf94a13eeaf446e7e455)
- Verification level: V3 — a schema migration, a new External-AI data-use class and a change to what crosses the provider boundary; full suite run on the pull request for that reason
- Verification evidence: full-suite run 45181077580 on 76a0c29c: 1181 passed, 0 failed, 2 excluded (manifest); quick, targeted and Vercel checks passed on PR #24; the earlier run 45171005973 on 8af5b2f9 failed three missed pins, fixed in 76a0c29c; locally tsc clean, next build green, 125 affected suites and 14 bite-proofs green against a session-created PostgreSQL in a disposable worktree; tests/p5-2-role-brief R1–R6 pass
- Test environment: local macOS worktree, Node 24, session-created PostgreSQL 18 on 127.0.0.1:55499 (system_identifier 7711330523535860062); GitHub Actions full-suite with disposable PostgreSQL
- Deployment evidence: GitHub deployment record for 527c17f2, environment Production, state success, created 2026-11-23T14:08:49Z, environment URL hebun-ai-recovered-lxyfo6bjr-hebuntechs-projects.vercel.app; www.hebuntech.com / and /login 200; production migration ledger 92 of 92, digest f74dd46e59c1f2e94f0daca8c7285745 (platform:migrate ALREADY_CONVERGED); TRH assistance decision revision 3 read on /governance/authority
- Production acceptance evidence: N/A — no agent draft carrying a role has been prepared in production; P5 production acceptance is P5-9
- Deferred risks: P5-2-LIVE-ROLE-UNOBSERVED-1 (DEFERRED); P5-2-ASSISTANCE-ADD-CLASS-UX-1 (DEFERRED)
- Director approvals: P5 design gate decisions D1–D7, 2026-11-20; D8 (role brief is the mandate purpose) and D9 (new class, one rollout window), 2026-11-23; P5-2 implementation, commit and PR #24, 2026-11-23; production migration 92 confirmed by the Director at the TTY, 2026-11-23; PR #24 merge and production deploy, 2026-11-23; TRH assistance withdrawal and re-authorization (revisions 2 and 3), 2026-11-23; this closure record, 2026-11-23

### Deferred risk detail

- **P5-2-LIVE-ROLE-UNOBSERVED-1 (DEFERRED).** No production agent draft has carried a role yet.
  Acceptance dependency: one agent draft on TRH, by P5-9 or earlier, whose disclosure decision
  authorizes `agent-mandate` and whose draft follows the agent's purpose. The same read confirms
  revision 3's four scope rows.
- **P5-2-ASSISTANCE-ADD-CLASS-UX-1 (DEFERRED).** `ai-assistance-decision-card` offers only "Withdraw"
  while assistance is in force, although `authorizeAssistanceDataUse` can add a new policy pair in one
  revision. Every future assistance class will need a withdraw-and-re-authorize window. Acceptance
  dependency: a Director decision to offer "renew" on the card when the policy holds a pair the decision
  lacks.

## Weekly three questions

1. **What did we learn?** A new data class spreads through the test suite like a migration does:
   ledger counts, newest-migration lists and regexes, release digests, policy lists, the cell type,
   the ceremony table, the importer census and bite-proof anchors all pin it. Measure the whole fan-out
   before the first push. Renewing a tenant's decision needed two Governance acts, because the card has
   no "renew" action.
2. **How does this improve Turkish Rug House?** Each TRH agent now prepares work as the agent its
   Governance described — a content agent writes like one, an operations agent plans like one — and
   only TRH's Governance can change that description.
3. **How does this become part of Hebun AI?** The agent templates (P5-3) set a role through the same
   mandate seam, so every customer's agents differ by the role their organization wrote, under the
   organization's own data-use decision.
