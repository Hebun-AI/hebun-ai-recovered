# LIVE-MAP-AGENT-OFFICE-1 · Live Map Phases 1–4B · closure record · DEPLOYED

The base Agent section of Live Map as production serves it: scoped dark theme, accessible agent cards,
static isometric scenes and the dynamic agent office route. Deployed, not accepted: **no signed-in
production read has been made**, so nothing below claims that a page renders correctly for a person.

## Scope

| Phase | Commit | Contains | First production deployment holding it |
|---|---|---|---|
| 1 | `e284bf3c` | Scoped dark theme foundation | `dpl_AKMq57UcZ79XQnavxD4bGoBV77Uc` (at `56578b11`) |
| 2 | `68deee7d`, `56578b11` | Accessible agent cards; metric wrapping and focus occlusion fix | `dpl_AKMq57UcZ79XQnavxD4bGoBV77Uc` |
| 3 | `803ab995` | Static isometric office scenes | `dpl_JCCP4sgUb735cZoyZBUVBXQJEhJJ` |
| 4B | `5c6a1674` | `/live-map/agents/[agentId]`, inspector content in the office Details section | `dpl_5HZuaK7pgTNTQJqKcH4FMLMd3dQm` |

Phase numbers 1 and 2 are read from commit order, not from a record: no earlier record names them.

**Out of scope, unchanged.** Cinematic office scenes, Tenant Office Profiles and migration 84 stay on
local branches (`feat/cinematic-office-visuals`, `feat/tenant-office-profiles`,
`feat/live-map-cinematic-office`), parked by Director decision on 2026-11-01. None is on `origin`.

## Production measurement (2026-11-01, read-only)

| Check | Result |
|---|---|
| Deployment record | `dpl_5HZuaK7pgTNTQJqKcH4FMLMd3dQm`, READY, PROMOTED, `githubCommitSha` `5c6a1674` |
| Aliases | `www.hebuntech.com`, `hebuntech.com` on that deployment |
| Anonymous `GET /live-map` | 307 to `/login` |
| Anonymous `GET /live-map/agents/<uuid>` | 307 to `/login` |
| Office images under `public/live-map/offices` on `main` | 0 files |

The anonymous reads prove the session gate, not the page. Rollback target for 4B:
`dpl_JCCP4sgUb735cZoyZBUVBXQJEhJJ`.

## Acceptance checklist

| # | Item | State |
|---|---|---|
| 1 | A card is one link and opens that agent's office | PENDING |
| 2 | Details holds the inspector content; Team reads `no-authority`, never "0 subagents" | PENDING |
| 3 | Theme comes only from a current department placement; an unplaced agent stays neutral | PENDING |
| 4 | An unknown agent id renders not-found | PENDING |
| 5 | Another tenant's agent renders the same not-found | PENDING — needs a second signed-in organization |
| 6 | Dark theme and scenes render; phone width has no horizontal scroll; keyboard focus stays visible | PENDING |
| 7 | No console or hydration error on `/live-map` and the office route | PENDING |

Items 1–4, 6 and 7 are a Director signed-in read (`LMO-PROD-SIGNED-IN-1`); item 5 is
`LMO-PROD-CROSS-TENANT-1`. The tests below prove source and read seams only.

## Closure Contract (v1)

- Phase: LIVE-MAP-AGENT-OFFICE-1
- Owner: features/live-map (read seam, contracts, theme) + components/live-map (surface)
- Reached state: DEPLOYED
- Implementation commit: e284bf3c, 68deee7d, 56578b11, 803ab995, 5c6a1674
- Verification level: V2 — a shared Live Map surface and a tenant-scoped office read; no schema, provider, authority or lifecycle change
- Verification evidence: 2026-11-01 on integration commit 265d6afd (source identical to 5c6a1674 for every Live Map file): firewall l4-live-map, e23-live-map-intelligence, ap2-agent-placement, live-map-experience; surface e2-4 and e23; live-map-experience agent-office, card-anatomy, dark-scope, map-surface, office-scene; agent-office-postgres, all exit 0; `tsc --noEmit` exit 0. Not run: live-map-experience bite-proofs and the full suite, withheld by the disk gate (BLOCKED, minimum 9.00 GiB)
- Test environment: worktree .claude/worktrees/ra-prep-1-integration; session-created PostgreSQL 18.6 on 127.0.0.1:55496, C locale, system_identifier 7703038436500671166, removed after the run
- Deployment evidence: dpl_5HZuaK7pgTNTQJqKcH4FMLMd3dQm (READY, PROMOTED, 5c6a1674, www and apex aliased), measured 2026-11-01
- Production acceptance evidence: N/A — no signed-in production read has been made; seven checklist items are PENDING
- Deferred risks: LMO-PROD-SIGNED-IN-1 (DEFERRED); LMO-PROD-CROSS-TENANT-1 (DEFERRED)
- Director approvals: closure record from verified evidence only, 2026-11-01 ("RA-PREP-1, ADIM 1", item 4); the approvals of the original Phase 1–4B pushes are not recorded in the repository and are not restated here

### Deferred risk detail

- **LMO-PROD-SIGNED-IN-1 (DEFERRED).** Nothing in production has been read behind the session gate for any
  Live Map phase. Blocks PRODUCTION-ACCEPTED: a Director signed-in read of checklist items 1–4, 6 and 7.
- **LMO-PROD-CROSS-TENANT-1 (DEFERRED).** Tenant isolation of the office route is proven by the Postgres
  suite, not in production. Closes with a read by a second signed-in organization.
