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
| 1 | A card is one link and opens that agent's office | PASS: 4 cards, one link each; click and Enter both opened the office |
| 2 | Details holds the inspector content; Team reads `no-authority`, never "0 subagents" | PASS on all 4 agents |
| 3 | Theme comes only from a current department placement; an unplaced agent stays neutral | PASS: Engineering and Security themed, Heby and Content `neutral` |
| 4 | An unknown agent id renders not-found | PASS: a well-formed unknown uuid and `not-a-uuid` both 404 with the not-found page |
| 5 | Another tenant's agent renders the same not-found | PENDING — needs a second signed-in organization |
| 6a | Dark theme and scenes render; phone width (375 px) has no horizontal scroll; one H1, ordered headings, scene `aria-hidden`, no unnamed control | PASS |
| 6b | Keyboard focus stays visible | NOT PASS in production: the ring shows only around the footer. Fixed locally, unverified until released (`AOT-NOT-RELEASED-1`) |
| 7 | No console or hydration error on `/live-map` and the office route | PASS: only the two deliberate 404s |
| 8 | Lifecycle words are true | PARTIAL: `In service` on all 4 agents agrees with `/agents`; suspended and retired are PENDING, no such agent exists to observe (`LMO-PROD-LIFECYCLE-UNOBSERVED-1`) |
| 9 | Counts are true | NOT PASS in production: "never executed" was false for internal acts. Fixed locally, unverified until released (`hebun-approved-outcome-truth-1-closure.md`) |

Items 6b and 9 need a re-read after a release (`LMO-PROD-SIGNED-IN-1`); item 5 is
`LMO-PROD-CROSS-TENANT-1`. The tests below prove source and read seams only.

**Signed-in acceptance, 2026-11-01.** Read-only in the built-in browser on the Director's own session, tenant Hebun AI, production `471e0dc8`. The checklist states are that reading. No form or action was used. `/operations` raises React #418: a separate existing issue, OPEN as `MEDIA3-ADMITTED-AT-HYDRATION-1`, not a Live Map defect. Live Map is not closed.

**Acceptance attempt, 2026-11-01, not performed.** The Director asked for a read-only signed-in pass. The
built-in browser, gstack's headless browser and the Chrome DevTools browser all reached `/login`: none holds a
Hebun session, and Aside is not installed. No credential was entered, requested or imported, and the
person's own Chrome was not used. All seven items stay PENDING, and the state stays DEPLOYED, not closed.
`dpl_B9w4jJGs6HL48c8DAB1i2uH2EN9z` (`471e0dc8`) now serves these phases; no Live Map file changed in it.

## Closure Contract (v1)

- Phase: LIVE-MAP-AGENT-OFFICE-1
- Owner: features/live-map (read seam, contracts, theme) + components/live-map (surface)
- Reached state: DEPLOYED
- Implementation commit: e284bf3c, 68deee7d, 56578b11, 803ab995, 5c6a1674
- Verification level: V2 — a shared Live Map surface and a tenant-scoped office read; no schema, provider, authority or lifecycle change
- Verification evidence: 2026-11-01 on e7b0c0d3 (source identical to 5c6a1674 for every Live Map file), with a node_modules matching the lockfile: full suite 1128 PASS, 1 FAIL, 1 BLOCKED of 1130, 0 REGRESSION, every live-map-experience, l4-live-map and e23-live-map-intelligence suite among the PASS, including live-map-experience bite-proofs and agent-office-postgres; `tsc --noEmit` exit 0; `next build` exit 0. The one FAIL (plan-step-idempotency-1 bite-proofs) and the one BLOCKED (r3w ambient) are classified in hebun-ra-prep-1-closure.md and touch no Live Map file
- Test environment: disposable detached worktree at e7b0c0d3; session-created PostgreSQL 18.6 on 127.0.0.1:55496, C locale, system_identifier 7703148169181862376, removed after the run
- Deployment evidence: dpl_5HZuaK7pgTNTQJqKcH4FMLMd3dQm (READY, PROMOTED, 5c6a1674, www and apex aliased), measured 2026-11-01
- Production acceptance evidence: N/A — the 2026-11-01 signed-in read found two defects (items 6b, 9), and lifecycle and cross-tenant items remain PENDING; recorded in the checklist, not accepted
- Deferred risks: LMO-PROD-SIGNED-IN-1 (DEFERRED); LMO-PROD-CROSS-TENANT-1 (DEFERRED); LMO-PROD-LIFECYCLE-UNOBSERVED-1 (DEFERRED)
- Director approvals: closure record from verified evidence only, 2026-11-01 ("RA-PREP-1, ADIM 1", item 4); the approvals of the original Phase 1–4B pushes are not recorded in the repository and are not restated here

### Deferred risk detail

- **LMO-PROD-SIGNED-IN-1 (DEFERRED).** Read on 2026-11-01: items 1–4, 6a and 7 pass. Blocks PRODUCTION-ACCEPTED:
  a signed-in re-read of items 6b and 9 after the fix is released.
- **LMO-PROD-LIFECYCLE-UNOBSERVED-1 (DEFERRED).** All 4 agents are in service, so the suspended and retired words
  have never rendered here in production. Closes on an organic state, read only; a state is not forced to test it.
- **LMO-PROD-CROSS-TENANT-1 (DEFERRED).** Tenant isolation of the office route is proven by the Postgres
  suite, not in production. Closes with a read by a second signed-in organization.
