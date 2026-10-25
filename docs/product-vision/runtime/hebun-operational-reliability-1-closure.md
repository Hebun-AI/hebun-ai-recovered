# OPERATIONAL-RELIABILITY-1 · closure record · DEPLOYED

**Scope, stated first.** Two reliability fixes to production-accepted Enterprise Operations surfaces are
released in production deployment `dpl_8HjxizaAyYap5byZAaNKasW7KnGZ` (commit `11699b3e`). Both were
reproduced and shown fixed locally under production conditions (server in UTC, browser in
Europe/Istanbul, the same disposable data on unchanged `main` and on the fix). **Not observed in
production:** no signed-in session was available to this session (the built-in browser reached
`/login`), so the signed-in renders of `/approvals` and `/heby` are UNVERIFIED and the state is
`DEPLOYED`, not production-accepted. The login return path (`WORK-UPDATE-LOGIN-QUERY-LOSS-1`) is not in
this release and stays BLOCKED.

## 1 · Problem

- **APPROVALS-EXPIRY-HYDRATION-1.** `PermitRow` printed `expires {new Date(…).toLocaleString()}`. The
  server rendered it in UTC and the browser again in its own zone, so the hydrated text differed and
  React raised #418 on `/approvals` (observed in production by ENTERPRISE-OPERATIONS-1). The execution
  ledger printed `started`/`concluded` the same way, server-only, so it did not mismatch but showed UTC
  wall-clock time without saying so.
- **EO1-WORKSTATE-LIFECYCLE-WORDING-1.** Heby's lifecycle kept its own hand-written list of internal
  kinds (`record-work`, `place-human-in-department`). `set-work-declared-state`, released later, fell
  through to the external-delivery branch: an executed state change read "The authorization was used,
  but no delivery attempt is recorded, so no effect can be claimed", with no work-register link.

## 2 · What was released (`11699b3e`)

- `utcInstant` (`src/lib/format.ts`): one fixed en-GB/UTC formatter that states its zone ("25 Oct 2026,
  11:38 UTC") and shows an unparseable value as stored. Used by the permit row, both "Authorized; permit
  expires …" messages and the execution ledger. Stored timestamps, expiry rules and permit lifecycle are
  unchanged; nothing re-derives expiry.
- `GOVERNED_INTERNAL_ACTION_KINDS` (`heby-action-inlet/contracts.ts`): the three governed internal acts,
  the client-safe copy of the registry's `internal-authority` postures, pinned to them by a test. The
  registry itself is not imported client-side (it would pull the `heby-runtime` barrel into the bundle,
  and the R3A pin forbids it in the reader).
- A spent `set-work-declared-state` is described as applied only when the Work Authority's own
  `work.state-declared` audit row — written in the spend's transaction, system-authored — names that
  spend's `handoff_id`: "Executed …. The work register recorded the change: <item> moved from <from> to
  <to>." with "Open the work register". The states are the ones the human approved (bound payload),
  shown only with that link. Without the link: "Hebun could not confirm the work register's record of
  this change, so no effect is claimed here." with "Check the work register". The permit alone is never
  taken as proof of effect.
- The declared audit reader (`governed-work-link-read.server.ts`) reads either `work.recorded` or
  `work.state-declared`, one action per read, from a closed pair checked at runtime too; tenant, entity
  type and system-actor predicates are unchanged. No schema, migration, Governance, provider,
  authentication, middleware or login change.

Not changed, by measurement: the standing-mutation form's `datetime-local` defaults are computed in the
server's zone, but a controlled input's value mismatch does not throw — React 19.2.4 adopts the client
value (measured in a production React build: no recoverable error, DOM and state hold the client value).

## 3 · Verification (V2)

V2: the change crosses a shared seam (a declared reader of the shared audit sink, tenant-scoped) and two
customer surfaces; no authority, schema or execution path changes, so V3 bite-proofs of those
boundaries were not required, but the full suite was run as the consolidated validation.

| Check | Result |
|---|---|
| Baseline of touched areas on unchanged `1e8f42a0` (disposable worktree) | 72/72 PASS |
| New tests `tests/operational-reliability-1/` (time determinism, lifecycle wording, lifecycle Postgres S1–S8) | 3/3 PASS |
| Affected tests on the candidate (disposable copy) | 106/106 PASS |
| Bite-proofs of the new tests (disposable copy) | 9/9 caught |
| `tsc --noEmit`, `eslint` on changed files, `git diff --check`, `npm run build` | PASS |
| Full suite (`npm run test:run`, candidate copy) | 1084/1088; 3 red only on the session's `en_US` collation instance, PASS on a C-collation instance and identical on the unchanged baseline (`hlr-human-legibility` ×2, `work2-provider-disclosure/bite-proofs`); 1 BLOCKED on both (`r3w-flow/ambient-database-safety`: canonical `hebun_r1` not running). REGRESSION: 0. Not a full-suite PASS |
| Local rendered acceptance, server `TZ=UTC`, browser Europe/Istanbul, disposable data | unchanged `main`: React's hydration diff names `PermitRow` (`10/25/2026, 11:38:53 AM` vs `2:38:53 PM`); fix: no console error, `expires 25 Oct 2026, 11:38 UTC`. `/heby` Your requests: "The work register recorded the change: Reliability item 1 moved from planned to active." + "Open the work register" → `/director/work` shows the item declared active; the approved, unspent request reads "Authorized and not yet executed" + "Execute or revoke it in Approvals" |
| Login continuity, local | `/heby?workItem=…` signed out → `/login` → `/command`: unchanged secure behaviour |

## 4 · Production release

| Fact | Evidence |
|---|---|
| Pre-release | `origin/main` = `1e8f42a0`; `11699b3e` one commit ahead, fast-forward; 13 paths, none in middleware, login, D1, schema, migrations or providers |
| Push | `1e8f42a0..11699b3e` fast-forward; `git ls-remote` reads `11699b3e0bd095b39637fa2c2ac160f3a7e37be6` |
| Deployment | `dpl_8HjxizaAyYap5byZAaNKasW7KnGZ`, target production, `READY`, `githubCommitSha` `11699b3e0bd095b39637fa2c2ac160f3a7e37be6`, ref `main` (Vercel CLI; the Vercel MCP was 403 for this team) |
| Aliases | `www.hebuntech.com`, `hebuntech.com` (and the project aliases) on this deployment |
| HTTP, signed out | apex 308 → www; `/` and `/login` 200; `/approvals` and `/heby` 307 → `/login` |
| Runtime errors | none in the first 15 minutes (`vercel logs --level error`) |
| Signed-in renders | UNVERIFIED — no authenticated session available; no credential entered |

## 5 · Not verified in production

- `/approvals` signed in: UTC expiry text and the absence of #418 on a fresh load.
- `/heby` Your requests signed in: the state-change wording and its register link; the unconfirmed
  wording can only be observed if a spent state change lacks its audit row, which no read-only walk can
  provoke.

## Closure Contract (v1)

- Phase: OPERATIONAL-RELIABILITY-1
- Owner: Action Authorization surfaces (`/approvals` permit row, execution ledger) and Heby request lifecycle (`heby-origination-affordance.tsx`, `read-action-authorizations.server.ts`), reading Organizational Work's declared audit link
- Reached state: DEPLOYED
- Implementation commit: 11699b3e0bd095b39637fa2c2ac160f3a7e37be6
- Verification level: V2 — a shared seam (a declared reader of the shared audit sink, tenant-scoped) and two customer surfaces; no authority, schema, migration, provider or authentication change
- Verification evidence: baseline 72/72; new tests 3/3; affected candidate tests 106/106; bite-proofs 9/9; tsc, eslint, diff --check, npm run build PASS; full suite 1084/1088 with 0 REGRESSION (3 collation-environmental, PASS on a C-collation instance; 1 BLOCKED, canonical hebun_r1 absent); local render under server UTC and browser Europe/Istanbul: #418 reproduced on unchanged main in PermitRow, absent on the fix; Heby state-change wording and register handoff rendered
- Test environment: worktree `.claude/worktrees/operational-reliability-1` at 1e8f42a0; disposable detached worktrees `or1-baseline` (1e8f42a0) and `or1-candidate` (1e8f42a0 + change); macOS Darwin 25.2.0; Node 24.16.0 with tsx; Next 16.3.8; React 19.2.4; session-owned PostgreSQL 18 at 127.0.0.1:55491 (own initdb, system_identifier 7700550470240009325, en_US.UTF-8) and 127.0.0.1:55492 (own initdb, system_identifier 7700556678041189892, C); local dev servers with TZ=UTC and a generated local session secret; no production database, provider or model
- Deployment evidence: dpl_8HjxizaAyYap5byZAaNKasW7KnGZ — READY, production, githubCommitSha 11699b3e0bd095b39637fa2c2ac160f3a7e37be6, aliased to www.hebuntech.com and hebuntech.com
- Production acceptance evidence: N/A — no authenticated production session was available; signed-out HTTP and error logs measured only (section 4)
- Deferred risks: APPROVALS-EXPIRY-HYDRATION-1 (DEFERRED); EO1-WORKSTATE-LIFECYCLE-WORDING-1 (DEFERRED); WORK-UPDATE-LOGIN-QUERY-LOSS-1 (BLOCKED)
- Director approvals: OPERATIONAL-RELIABILITY-1 mandate and one local implementation commit 2026-10-25; release — fast-forward push of 11699b3e with its automatic production deployment, read-only verification, and one local documentation-only closure commit 2026-10-25; WORK-UPDATE-LOGIN-QUERY-LOSS-1 kept BLOCKED by Director instruction; push of this documentation NOT approved

### Deferred risk detail

- **APPROVALS-EXPIRY-HYDRATION-1 (DEFERRED).** Cause removed in `11699b3e`, deployed in
  `dpl_8HjxizaAyYap5byZAaNKasW7KnGZ`; reproduction on unchanged `main` and its absence on the fix were
  measured locally under the production zone pair. Not closed, because production was not observed.
  Acceptance dependency: a signed-in read-only fresh load of `/approvals` on this or a later deployment
  showing the expiry in UTC and no React #418.
- **EO1-WORKSTATE-LIFECYCLE-WORDING-1 (DEFERRED).** Fixed in `11699b3e`, deployed in
  `dpl_8HjxizaAyYap5byZAaNKasW7KnGZ`; wording, register handoff and the unconfirmed case are proven by
  `work-state-lifecycle-postgres.ts` (S1–S8) and a local render. Acceptance dependency: a signed-in
  read-only view of Heby's Your requests showing an executed state change worded from the Work
  Authority's record with "Open the work register".
- **WORK-UPDATE-LOGIN-QUERY-LOSS-1 (BLOCKED).** Unchanged; the detail and the §22 pointer stay with
  `hebun-enterprise-operations-1-closure.md`. Re-measured locally: a signed-out deep link still lands on
  `/command` after sign-in. The only legitimate carrier is a third login form field, which the D1 pin
  (`tests/d1-flow/boundaries-and-firewall.ts`, `formData.get` reads exactly `email`, `password`) forbids;
  side channels (cookie, bound action arguments, referer) would carry the same client input past the pin
  and are not used. It blocks its own resolution until a Director exception admits one optional `next`
  field: closed allow-list (`/heby` with a UUID `workItem` only, extended explicitly), rejecting external,
  protocol-relative, backslash, percent-encoded, scheme-bearing, control-character and unknown-parameter
  values; re-validated at middleware, login page and action; reaching only `redirect()`, never the
  session service; the forged-identity list unchanged; its own negative control; carried through
  workspace selection and expired-session redirects.

**Behaviour change, intended.** A permit's expiry reads the same on the server and in every browser and
says it is UTC; an executed work-state change in Heby says which item moved and from what to what, only
when the work register's own record says so, and leads to the register.

**Weekly three.** *Learned:* "executed" and "applied" are different facts, and a hydration defect is
proven by rendering the same data under the production zone pair on both the old code and the fix.
*Turkish Rug House:* its owner reads expiries in one stated zone and sees which work a state change
moved. *Hebun AI:* every governed internal act is worded from its own evidence.
