# PRODUCT-INTEGRATION-1 · closure record · PRODUCTION-ACCEPTED (scoped)

**Scope of the acceptance, stated first.** This record is accepted against production *deployment
reality* and one signed-in, read-only view of one organization whose publishing is **not armed**: the
deployed commit, its production deployment and aliases, and that organization's render of `/workforce`,
`/platform`, `/governance/authority`, `/director/organization`, `/agents`, `/command` and `/governance`.
**Armed-state wording was not observed** (the organization is not armed), **cross-tenant isolation was
not exercised through a second signed-in organization**, and **execution refusal messages were not
observed** (they need a real external action). Those three are proven only by local tests or not at
all. §16.1 keeps the state one of six and puts the qualifier in the evidence text; nothing below widens
it.

## 1 · Problem

Customer-facing surfaces still described Hebun as it was before tenant-scoped reads existed:

- the mounted Platform Overview said nothing is connected, every provider is unconfigured, and
  persistence is in-memory, while Integrations and Providers & Models read live, per-organization state;
- the mounted Workforce Overview said "Humans: None connected", "AI agents: None connected" and
  "0 connected", while the people register on `/director/organization` lists members and `/agents` lists
  durable agents with service status, mandate, placement and capability truth;
- organization readiness was reachable only from the Governance Authority page itself;
- the readiness publishing row said that one arming covers email, Instagram and YouTube together only
  for an organization that is already armed — invisible to exactly the owners who need it before arming;
- execution refusals on `/approvals` showed bare server reason codes.

## 2 · What was released

| Commit | Content |
|---|---|
| `cf0b1669` | `feat(product): make readiness discoverable and navigation truthful`. 10 files, +280 / −11: navigation purposes in `workspace-nav.ts`; Governance Overview availability row linking `/governance/authority`; Command organization-context link to `/governance/authority#organization-readiness` (link only — Command reads no readiness); the `organization-readiness` card anchor; readiness arming-scope sentence; `execution-refusal-wording.ts` used by `action-authorizations.tsx`; `tests/product-integration-1/integration.ts`; the kind-arming design gate record; one `learnings.md` line |
| `658762a5` | `fix(product): stop Platform and Workforce overviews denying live state`. 14 files, +246 / −173: Platform Overview model, contract comment, page context and component; Workforce Overview model, directory, state strip, capabilities and boundary regions and page comment; readiness shared-arming sentence in every readable state and the capitalisation fix of the operator next step; `tests/product-integration-1/integration.ts` rewritten to render each mounted component; `tests/phase-25b/agents-truth.ts` pin changed with its reason; one `learnings.md` line |

On `main`: `cf0b1669` was already on `origin/main` when this release began. `658762a5` fast-forwarded
`cf0b1669 → 658762a5` (GitHub `cf0b1669..658762a5 -> main`); the remote HEAD was re-read immediately
before the push and proven to be the release commit's parent.

**Customer-visible behaviour now.**

- *Platform:* the state banner reads "Provider substrate · contract-only" and says live state is read
  where it is owned. Providers & Models, Integrations and execution rows are `external-authority` and
  link to `/director/provider-matrix` and `/integrations`. The Persistence row is gone. The substrate
  execution ladder is unchanged and still reaches only REGISTERED.
- *Workforce:* the overview reads no records and counts nothing. Humans are "Listed on Organization",
  AI agents "Listed on Agents", each with a link; the directory says "This overview lists no workers".
  True limitations stay: no combined directory, no human capability record, no capacity measure, no
  assignment surfaced here.
- *Readiness:* the publishing row states "Arming is not granted per kind: one arming covers email
  sending, Instagram publication and YouTube publication together." in the not-armed, withdrawn and
  armed states; an armed organization is also told each send or post still needs its own approval. An
  unreadable row stays only "unknown".
- *Navigation:* Command and the Governance Overview link to readiness.

**Released but not customer-visible.** The navigation purpose strings from `cf0b1669` render only in
`WorkspaceLanding`, which no route mounts. They are correct and pinned, and no customer sees them.

**Unchanged:** schema and migrations, dependencies, configuration, environment, arming, approval,
permit and execution paths, the readiness reader, Integrations, Providers & Models, Agents, the people
register, Heby, provider adapters. No authority, persistence or execution path was added.
Kind-scoped arming is **not** implemented (`EA1-KIND-ARMING-1` stays DEFERRED under
EXECUTION-AUTHORITY-1; design gate in
`docs/product-vision/runtime/hebun-product-integration-1-kind-arming-design-gate.md`).
`AEO-1-PROD-DELIVERY-1` is untouched and stays DEFERRED under AUTH-EMAIL-OWNERSHIP-1.

## 3 · Verification (V2)

V2: the change crosses several workspace surfaces and the shared readiness composition, but touches no
authority, tenant boundary, lifecycle, schema, provider or execution path, so the full suite was not
run.

| Item | Measured |
|---|---|
| Composition test | `tests/product-integration-1/integration.ts` PASS at `658762a5`: for each changed component the route's page mounts it, the rendered markup carries the new text, the route's workspace audience reaches it, the content comes from its owning authority, and no boundary moved (Command still reads no readiness; seven workspaces; Governance L2 unchanged) |
| Negative assertions | Platform and Workforce markup must not render any of the stale claims (`nothing is connected`, `persistence is in-memory`, `None connected`, `0 connected`, `Identity model not connected`, …); bite-proof: restoring "None connected" in the state strip failed the test, restoring the text passed it |
| Pins changed with reason | `tests/phase-25b/agents-truth.ts`: `connected === 0` replaced by "no count, links to its recording surface" in the same commit |
| Touched-area suites | `phase-25b/agents-truth.ts`, `phase-25c/workforce-ia.ts`, `truth1-organizational-fiction/disclosure-and-firewall.ts`, `ama3-mandate-product/product-firewall.ts`, `vi1-visual-integrity/foundation.ts` all PASS at the change |
| Release candidate at `658762a5` | `tsc --noEmit` exit 0; `eslint` on changed files exit 0; `git diff --check` clean; `npm run build` exit 0 (installed Next 16.3.8 = `package.json`) |
| Mounted-route render (local) | worktree dev server, `/workforce` and `/platform` rendered the new text and none of the stale claims; no console errors |
| Baseline before change | NOT RECORDED — the touched suites were not separately run on the unchanged tree before `658762a5`; no red was observed after the change |

## 4 · Production release and acceptance

| Gate | Time | Measured |
|---|---|---|
| Prior release | 2026-10-25 06:38:23Z | `cf0b1669` deployed as `dpl_3Bkvc6bieJ5ZGnV75Y7MD4XkPd9j` (READY, production); superseded by the release below |
| Release | 2026-10-25 ~07:36Z | `origin/main` = `658762a54cd480a11b54f82d4dfd3fe56d004a66`, parent `cf0b1669` (`git ls-remote`, re-read after push) |
| Deploy | created 2026-10-25 07:36:33Z | `dpl_wB8NvLRUmvAGStyFD4UiAN1o1zeF`, target production, Ready (`vercel inspect`); the only deployment listed by `vercel ls --meta githubCommitSha=658762a5…` |
| Aliases | 2026-10-25 | `www.hebuntech.com`, `hebuntech.com` on `dpl_wB8N…` (`vercel inspect`, `vercel alias ls`); apex 308 → www |
| Unauthenticated boundary | 2026-10-25 | `/workforce`, `/platform`, `/governance/authority`, `/governance`, `/command`, `/agents`, `/director/organization`, `/approvals` all 307 → `/login` |
| Runtime logs | release to ~07:50Z | `vercel logs` (last 50 lines, sampled): the only error-level record is the known pg sslmode deprecation warning; no error, fatal or 5xx |
| Signed-in read-only view | 2026-10-25 | Built-in browser, a session the Director signed in themselves (no credential entered by this session), organization `f625b683…`. The new text itself proves the new deployment was served |
| Director scoped acceptance | 2026-10-25 | PRODUCTION-ACCEPTED — scoped, on exactly the evidence in this record |

**What the signed-in view showed (read from page text; nothing submitted).**

- `/workforce`: "Listed on Organization", "Listed on Agents", "This overview lists no workers", "Human
  capabilities are not recorded", "no honest utilization measure is available", the new Agents boundary
  row; links `/director/organization` and `/agents` present. None of the stale claims present.
- The claims those links replace were false for this organization: `/director/organization` reports
  1 person whose membership Hebun holds in force; `/agents` reports "2 durable agent identities · 2 in
  service".
- `/platform`: "Provider substrate · contract-only", "Live state is read where it is owned", links
  `/integrations` and `/director/provider-matrix`. "Nothing is connected", "persistence is in-memory"
  and the other stale claims absent.
- `/governance/authority`: readiness card present; publishing row "Not armed for this organization.
  Proposals can still be filed and approved; nothing is executed. Arming is not granted per kind: one
  arming covers email sending, Instagram publication and YouTube publication together." and "Next
  (platform operator): Arming is a platform operator ceremony; it is not available in the app today."
- `/command`: following "Organization readiness · what this organization still needs" landed on
  `/governance/authority#organization-readiness` with the card present.
- `/governance`: following the "Authority & readiness" Open link landed on `/governance/authority` with
  the card present.
- Browser console: no error messages on `/workforce`, `/platform` or `/governance/authority`.

This session wrote nothing to production. Governance, arming and membership state pre-date this release
and are unchanged by it.

**Evidence provenance, kept apart.**

| Evidence | Source | Measured by this session |
|---|---|---|
| Remote SHA, deployments, aliases, HTTP boundary, logs | git, Vercel CLI, HTTP; read-only | Yes |
| Signed-in render, link navigation, console | Built-in browser in a Director-opened session; read-only | Yes |
| Local test results, build, local render | Implementation worktree `.claude/worktrees/product-integration-1` | Yes |

## 5 · Not verified

- **Armed-state wording (PI1-PROD-ARMED-WORDING-1).** "Armed for this organization. … Each send or post
  still needs its own approval." renders only for an armed organization; none was observed. Proven only
  by `tests/product-integration-1/integration.ts`.
- **Cross-tenant isolation through a second signed-in organization (PI1-PROD-CROSS-TENANT-1).** One
  organization was viewed; only the unauthenticated redirect was measured. The pages this release
  changed read no tenant records themselves (Platform and Workforce are static; readiness uses the
  released reader), which bounds but does not prove the risk.
- **Execution refusal wording on `/approvals` (PI1-PROD-REFUSAL-WORDING-1).** Seeing a refusal needs a
  real Execute; none was attempted. Proven only locally (`refusalsAreWorded`).

**Recorded during the phase, not changed by it.**

- The Knowledge workspace (`knowledge-sources.tsx`) also renders a static "0 connected". Whether it
  contradicts any authoritative record was not investigated; no sweep of other workspaces was run.
- `/agents` shows an email-confirmation banner ("could not be confirmed as sent") for the signed-in
  human; it belongs to `AEO-1-PROD-DELIVERY-1` and was not touched.

## Closure Contract (v1)

- Phase: PRODUCT-INTEGRATION-1
- Owner: apps/dashboard customer surfaces — features/platform-overview, features/workforce/workspace-model and components/workforce-workspace, features/organization-readiness wording, Command and Governance Overview links, execution-refusal wording; readiness reader, Integrations, Providers & Models, Agents, people register, arming and execution authorities unchanged
- Reached state: PRODUCTION-ACCEPTED
- Implementation commit: cf0b16694f7181f31fc3dc139a3402f26d1c66b7, 658762a54cd480a11b54f82d4dfd3fe56d004a66 — released on `main` (658762a5 fast-forward from cf0b1669)
- Verification level: V2 — several workspace surfaces and the shared readiness composition; no authority, tenant, lifecycle, schema, provider or execution boundary touched, so the full suite was not run
- Verification evidence: at 658762a5, 2026-10-25: tests/product-integration-1/integration.ts exit 0 PASS (mounted, rendered, reachable, authoritative, bounded; negative stale-claim assertions, bite-proof caught); phase-25b/agents-truth.ts, phase-25c/workforce-ia.ts, truth1-organizational-fiction/disclosure-and-firewall.ts, ama3-mandate-product/product-firewall.ts, vi1-visual-integrity/foundation.ts exit 0 PASS; tsc --noEmit exit 0; eslint on changed files exit 0; git diff --check clean; npm run build exit 0; local mounted-route render of /workforce and /platform without stale claims or console errors; baseline on the unchanged tree NOT RECORDED
- Test environment: worktree `.claude/worktrees/product-integration-1` at cf0b1669 then 658762a5; macOS (Darwin 25.2.0); Node 24.16.0 with tsx; Next 16.3.8; local dev server on port 3100 without environment; no database, no provider, no model
- Deployment evidence: dpl_wB8NvLRUmvAGStyFD4UiAN1o1zeF READY production, created 2026-10-25T07:36:33Z by the git integration, the only deployment for githubCommitSha 658762a5, aliases www.hebuntech.com and hebuntech.com; prior cf0b1669 deployment dpl_3Bkvc6bieJ5ZGnV75Y7MD4XkPd9j superseded
- Production acceptance evidence: SCOPED — (a) measured read-only: remote main 658762a5, deployment Ready and aliased, apex 308, eight dashboard routes 307 to /login unauthenticated, sampled logs show only the known pg sslmode warning; (b) signed-in read-only render of organization f625b683: /workforce new copy and links without stale claims (organization has 1 member and 2 durable agents in service), /platform new copy and links without stale claims, /governance/authority not-armed publishing row with the shared-arming sentence, Command and Governance Overview links land on the readiness card, no console errors, nothing submitted; (c) Director-authorized scoped acceptance 2026-10-25. Armed-state wording, cross-tenant isolation and execution refusal wording UNVERIFIED in production (section 5)
- Deferred risks: PI1-PROD-ARMED-WORDING-1 (DEFERRED); PI1-PROD-CROSS-TENANT-1 (DEFERRED); PI1-PROD-REFUSAL-WORDING-1 (DEFERRED)
- Director approvals: the cf0b1669 implementation and release were approved in an earlier session and are not re-measured here (this record measured only that cf0b1669 was on origin/main and deployed); local completion commit 2026-10-25; fast-forward push of 658762a5 with its automatic production deployment and read-only production verification 2026-10-25 (push executed by this session); PRODUCTION-ACCEPTED — scoped and this closure documentation with one local documentation-only commit 2026-10-25; push of this documentation NOT approved

### Deferred risk detail

- **PI1-PROD-ARMED-WORDING-1 (DEFERRED).** The armed-state publishing row was not observed in
  production. Acceptance dependency: a signed-in read-only render of `/governance/authority` by an
  organization that is already armed.
- **PI1-PROD-CROSS-TENANT-1 (DEFERRED).** Isolation was not exercised with a second signed-in
  organization. Acceptance dependency: a read-only render of the same pages by a second organization,
  confirming each sees only its own readiness, members and agents.
- **PI1-PROD-REFUSAL-WORDING-1 (DEFERRED).** Worded execution refusals were not observed. Acceptance
  dependency: a refusal observed read-only during a Director-authorized real execution attempt.

**Behaviour change, intended.** Platform and Workforce no longer deny live state they cannot see; they
describe what they are and link to the surfaces that read it. Owners learn before arming that arming is
not per kind.

**Weekly three.** *Learned:* a customer-facing change is delivered only when the route mounts the
component and the rendered UI shows the text; a config string or a compiled component proves nothing
about a screen, and the first nav-purpose fix shipped invisible for that reason. *Turkish Rug House:* its
owner no longer reads that the organization has no people, no agents and no connections. *Hebun AI:*
static overviews link to authoritative reads instead of restating or denying them.
