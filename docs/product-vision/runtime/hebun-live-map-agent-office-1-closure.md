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
| 6a | Dark theme and scenes render; phone width (375 px) has no horizontal scroll on `/live-map`, the office and `/agents`; one H1, scene `aria-hidden`, every control named | PASS |
| 6b | Keyboard focus stays visible | PASS at `94949084`: whole ring on all 4 cards at 350 px, and on the second and third columns at 1280 px; Enter opens the office |
| 6c | Headings do not skip a level | NOT PASS in production: `/live-map` goes H1 then H3, since `8fb299e1`. Fixed locally in `2886f0d2`, unverified until released (`LMO-A11Y-HEADING-SKIP-1`). The office page is ordered |
| 7 | No console or hydration error on `/live-map` and the office route | PASS: only the two deliberate 404s |
| 8 | Lifecycle words are true | PASS for `In service`, on all 4 agents, agreeing with `/agents`. Suspended and retired are PENDING: no such agent exists to observe (`LMO-PROD-LIFECYCLE-UNOBSERVED-1`) |
| 9 | Counts are true | PASS at `94949084`: Engineering never executed 0, internal 1; Heby never executed 0, internal 1, unknown 1 (`hebun-approved-outcome-truth-1-closure.md`) |

Item 5 is `LMO-PROD-CROSS-TENANT-1`. The tests below prove source and read seams only.

**Signed-in acceptance, 2026-11-01.** Read-only in the built-in browser on the Director's own session, tenant Hebun AI, production `471e0dc8`. No form or action was used. Items 6b and 9 failed there, were fixed in `94949084`, and passed on a second signed-in read the same day (`dpl_HyXkPShcXaAsuZCAAePA6cV9THsc`). Each `/operations` load raises React #418 and no other page does: a separate existing issue, OPEN as `MEDIA3-ADMITTED-AT-HYDRATION-1`, not a Live Map defect. Live Map is not closed.

**Correction.** The first reading called `/live-map` headings ordered; only the office page had been measured, and item 6c records the truth.

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
- Production acceptance evidence: N/A — not accepted: heading item 6c is not passed, and lifecycle and cross-tenant items remain PENDING; every other item passed the signed-in reads recorded in the checklist
- Deferred risks: LMO-PROD-SIGNED-IN-1 (CLOSED); LMO-PROD-CROSS-TENANT-1 (DEFERRED); LMO-PROD-LIFECYCLE-UNOBSERVED-1 (DEFERRED); LMO-A11Y-HEADING-SKIP-1 (DEFERRED)
- Director approvals: closure record from verified evidence only, 2026-11-01 ("RA-PREP-1, ADIM 1", item 4); the approvals of the original Phase 1–4B pushes are not recorded in the repository and are not restated here

### Deferred risk detail

- **LMO-PROD-SIGNED-IN-1 (CLOSED).** Signed-in reads on 2026-11-01 at `471e0dc8` and `94949084`.
- **LMO-A11Y-HEADING-SKIP-1 (DEFERRED).** `PageHeader` prints the H1 and `LiveMapCanvas` printed every section as
  an H3. Fixed locally in `2886f0d2`: the five section headings are H2, by Director decision. Closes on a
  signed-in read after release. Evidence so far: `map-surface` asserts every map section is a sibling H2 on the
  present and unavailable branches, red before the change, and the four heading sites each bit a mutation; 30
  affected suites exit 0 including four bite-proofs; `tsc` and `eslint` exit 0; 14 computed style properties and
  the geometry of all 4 headings unchanged when the tags were swapped in the production DOM of one tab. `next build`
  is NOT RUN: the 10 GiB watchdog stopped it at 9.41 GiB, and the Director's no-cleanup rule stands. The full
  suite was not repeated: since 1131/0/1 at `4149c43f` the only code change is these tags and one test.
- **LMO-PROD-LIFECYCLE-UNOBSERVED-1 (DEFERRED).** All 4 agents are in service, so the suspended and retired words
  have never rendered here in production. Closes on an organic state, read only; a state is not forced to test it.
- **LMO-PROD-CROSS-TENANT-1 (DEFERRED).** Tenant isolation of the office route is proven by the Postgres
  suite, not in production. Closes with a read by a second signed-in organization.
