# KNOWLEDGE-SEARCH-V1 — Heby `/search` over the organization's own Knowledge — Closure

Base `008aa7f6` (`origin/main`, SUITE-RECOVERY-1). Worktree `.claude/worktrees/knowledge-search-v1`,
branch `feat/knowledge-search-v1`. Local commit only; not pushed, not deployed.

Selected by the Director (2026-10-19) from the Intelligence capability discovery at `008aa7f6`, which
compared Research, Social Intelligence grounding, real Intelligence signals and Knowledge search.
Research needs Secure Content Ingestion (§13.1.1, PLANNED); Social grounding needs an EAI and
provider-observation decision; signals need a new authority. `/search` was the one candidate whose
authority already existed: KR3 built retrieval, and K1/KR3/KR4 pinned `/search` unavailable only
because "enabling one is a separate product phase". This is that phase.

Paths are relative to `apps/dashboard/src/`.

## What changed

| Piece | Change |
|---|---|
| `features/heby-commands/registry.ts` | `/search` available; `NO_SEARCH_AUTHORITY` removed; description names it lexical, not semantic |
| `features/heby-commands/read-commands.server.ts` | `case "search"`: KR3 `searchKnowledge` + Governance standing per result; five outcomes kept apart |
| `features/heby-answer/knowledge-evidence.server.ts` | `readKnowledgeGovernanceStandings` + `describeKnowledgeGovernanceStanding`; `resolveRatifiedKnowledgeEvidence` now uses the same function (behaviour unchanged) |
| `features/knowledge/capability-map.ts` | `search` → connected, with its real `canProve` / `cannotProve`; ingestion's sentence no longer counts search as missing |
| `components/knowledge-workspace/knowledge-records.tsx` | comment only: `searchKnowledge` now has two consumers |
| `features/public-claims/capability-claims.ts` | the public "Evidence-backed answers" limit no longer says "There is no search surface" — it became false; search is NOT added as a published claim (PUB-0 keeps it withheld) |

No table, migration, environment variable, permission, route, model call, provider call, writer or
EAI path was added. The Knowledge workspace was not changed.

## What a person gets

`/search <query>` in Heby returns the tenant's own records, best text match first. Each result shows
fact key, title, domain · scope, Knowledge status (lifecycle) and authority class, Governance standing,
a 200-character excerpt and `Read it: /source <key>`. The answer distinguishes: no searchable word ·
organization holds no Knowledge · no match · results · unavailable. Records that matched but were not
served are counted by reason (archived, retired, expired, not yet effective, deleted, a version
Governance declined) only when the seam reports them; their keys and text are never shown.

## Authority and security boundaries

- **Tenant:** only `resolveTenantContext()` through the existing server action; the query is text, never
  a key into another tenant. `/source` of another tenant's key does not resolve (Postgres-tested).
- **Rejected versions:** KR3's existing gate (KT-1) drops them before anything is shown and serves
  nothing when Governance's rejection read fails.
- **Standing is Governance's, never the row's.** `ratification_decision_id` is a claim; a result is
  "ratified" only when Governance holds exactly that `ratify` decision for exactly that version in this
  tenant. A claim Governance does not hold is shown as NOT confirmed. Any unanswerable or throwing
  standing read makes the whole search unavailable. This is one implementation, shared with the
  `/heby` grounding rule (HEBY-GROUNDED-CONVERSATION-1), not a second one.
- **g2/k4 hold:** no `heby-commands` file names the ratification mutation; the standing read and its
  wording live in `heby-answer/knowledge-evidence.server.ts`, outside that directory.
- **No model:** the command output never reaches the model (the only model crossing carries the
  prompt, not command output); the value-import reach of what `/search` adds contains no model,
  transport, provider, EAI or writer module (walker with positive control and four bite-proofs).

## Verification (V2)

V2: a new consumer of the shared KR3 retrieval seam and a shared helper extracted from the Heby
grounding rule; no write, schema, grant or provider boundary moves, so no V3 boundary is touched.

| Item | Result |
|---|---|
| Baseline, unchanged `008aa7f6`, disposable detached worktree | 180 files in the 67 suites that import the touched modules: 180 PASS, 0 FAIL |
| Candidate, same files + `knowledge-search-v1`, disposable detached worktree with the patch applied | 180 PASS, 2 FAIL — both stale `/search`-unavailable pins, updated here and re-run PASS |
| Second set: suites naming `search`, the capability map or public claims, plus `development-continuity` | see *Verification evidence* |
| `tsc --noEmit -p .` | exit 0 |
| `eslint` on every changed source and test file | exit 0 |
| `npm run build` (feature worktree, real `node_modules` clone) | exit 0 |

Pins changed in this commit, each because `/search` became available — never to weaken a security
assertion: `kr3-flow/boundaries-and-firewall` §5, `kr4-flow/surfaces-and-firewall` §10,
`k1-flow/commands-and-grounding` §20–22 and the capability-map body, `k1-flow/knowledge-authority`,
`s1-flow/dispatch-and-availability`, `k2-flow/create-and-read-postgres` §25,
`knowledge-ingestion-flow/boundaries-and-firewall` §9, `pub1-public-surface/claim-truth` §4 and the
matching `pub1-public-surface/bite-proofs` proof (retargeted to the semantic denial the site still
publishes). Every "semantic retrieval and embeddings stay not-connected" and
"no search page / the evidence panel is not a search surface" assertion is kept.

## Known limitations

- Lexical only. A record worded differently, or in another language, may not be found (RELEVANCE-0
  measured EN→TR lexical Recall@8 ≈ 2%). The result says so. `pg_trgm` is not installed, so typos
  find nothing; the degraded reason is printed when the capability reports it.
- Up to 8 results (KR3 default); a partial sweep or per-source cap is stated, not paged.
- Ratification binds a Governance decision and does not move the Knowledge lifecycle, so a ratified
  record can read "Knowledge status: draft · Ratification: ratified". Both facts are shown as they are.

## Three questions

1. **What did we learn?** A product phase that an earlier phase explicitly deferred is the cheapest
   kind to ship: the authority and its fail-closed rules already existed, and the work was a result
   presentation plus moving the pins that said "not yet".
2. **How does this improve Turkish Rug House?** Its people can find a policy, care instruction or
   supplier fact they ingested by typing the words, with its Governance standing, instead of reading
   the whole list.
3. **How does this become part of Hebun AI?** As the reference for exposing an existing read seam to
   people: same tenant context, same Governance gate, standing stated per item, nothing inferred.

## Closure Contract (v1)

- Phase: KNOWLEDGE-SEARCH-V1
- Owner: Heby read commands (`features/heby-commands/`) over the Knowledge authority's KR3 retrieval seam (`features/knowledge/knowledge-read.server.ts`)
- Reached state: VERIFIED
- Implementation commit: THIS COMMIT
- Verification level: V2 — new consumer of the shared KR3 retrieval seam plus a helper extracted from the shared Heby grounding rule; no write, schema, grant, provider or EAI boundary changes
- Verification evidence: baseline at 008aa7f6, 180 files in 67 suites importing the touched modules: 180 PASS / 0 FAIL; candidate (this change applied in a disposable detached worktree): same 180 files + 2 new: 180 PASS / 2 FAIL, both stale `/search`-unavailable pins (k2-flow/create-and-read-postgres, knowledge-ingestion-flow/boundaries-and-firewall), updated in this change and re-run PASS; second set (pub1-public-surface, development-continuity, knowledge-search-v1, s1-flow, kr3-flow, kr4-flow, k1-flow and the two re-pinned files, after the public-claim and pub1 updates): 23 PASS / 0 FAIL; mutation bite-proof: `/search` reading the row's own ratification claim instead of Governance's makes search-postgres FAIL; `tsc --noEmit -p .` exit 0; `eslint` on all changed files exit 0; `npm run build` exit 0; 0 REGRESSION, 0 PRE-EXISTING, 0 BLOCKED in the measured set
- Test environment: worktree `.claude/worktrees/knowledge-search-v1` (build, tsc, eslint, focused tests); disposable detached worktree `.claude/worktrees/intel-discovery-008aa7f6` at `008aa7f6` for baseline and, with this change applied as a patch, for the candidate run; `node --import tsx` per file; PostgreSQL 18.6 on 127.0.0.1:55433 via `HEBUN_TEST_ADMIN_DATABASE_URL`, disposable databases created and dropped by the harness; no `DATABASE_URL`, no model key
- Deployment evidence: N/A — not deployed
- Production acceptance evidence: N/A — not released or deployed
- Deferred risks: KS1-BROWSER-UNVERIFIED-1 (DEFERRED)
- Director approvals: discovery and selection of Knowledge Search (Director, 2026-10-19); implementation of deterministic `/search` V1 with tests, V2 validation and one local commit, no push, no deployment, no production mutation (Director, 2026-10-19)

## Deferred risks

- **KS1-BROWSER-UNVERIFIED-1 (DEFERRED)** — `/search` was proven at the server boundary against a real
  database, not rendered in a signed-in browser. The command uses the existing read-command path and
  `HebyCommandResult` rendering that `/knowledge` and `/source` already use, but the result list has
  not been seen on screen. Closes with a signed-in local or production render of `/search`, read only.
