# Approvals dashboard delivery — 2026-10-01

## Repository and scope

- Repository: `/Users/senolsevim/Developer/Hebun AI`.
- Isolated worktree: `/private/tmp/hebun-approvals-dashboard`.
- Branch: `feat/approvals-dashboard`.
- User-approved base: `01810404e2abe6057c1f4e78cb99b45f409d4fe1` (`feat/youtube-measurement-operations-projection-1`). The main branch did not contain the released publishing/measurement work.
- No writes to primary working files, merge into main, push, deployment, business-data seed, schema migration or live provider operation.

## Changed files

All application paths below are under `apps/dashboard/`:

| File | Change |
| --- | --- |
| `src/app/(dashboard)/approvals/page.tsx` | Compose the real dashboard into the existing route; retain horizon, standing envelopes, proposal and execution ledger controls. |
| `src/app/(dashboard)/operations/actions.ts` | Revalidate Approvals after existing content/media review actions. |
| `src/components/approvals-dashboard/approvals-dashboard.tsx` | Counters, filters, search, sort, checkbox selection, scoped bulk confirmation/results, queue and selected-item tabs. |
| `src/components/approvals-dashboard/content-detail.tsx` | Exact revision content, verified media preview, publication history and stored measurements. |
| `src/features/approvals-dashboard/read-dashboard.server.ts` | Read-only composition of released readers; no direct table access, persistence or new authority. |
| `src/features/approvals-dashboard/model.ts` | Pure filtering, display eligibility and sequential per-item outcome handling. |
| `src/components/decision-workspace/action-authorizations.tsx` | Export existing request/permit components for reuse; optional disable of permit decision controls. |
| `src/components/decision-workspace/decision-header.tsx` | Approvals heading. |
| `src/components/decision-workspace/decision-workspace.tsx` | Remove obsolete structural strip; explicitly distinguish legacy examples from the live inspector. |
| `tests/approvals-dashboard/selection-and-results.ts` | Filter scope, authority gating, unsupported decisions, deduplication, partial refusal and uncertain response tests. |
| `tests/approvals-dashboard/status-truth.ts` | Unknown versus failure, accepted publication identity, review eligibility and truthful work relationships. |
| `tests/approvals-dashboard/unavailable-render.ts` | Actual no-session reads rendered as unavailable, with closed decision controls and no fabricated records. |
| `tests/app2-decision-truth/bite-proofs.ts` | Update the mutation's exact text target to the new legacy-summary wording; retain the original failure assertion. |

Also changed this report and appended the isolated worktree's `learnings.md`.

## Existing read/action connections

- Requests / permits: `readPendingActionRequests`, `readActionPermits`; true unbounded pending-action count remains `readAwaitingDecisionAggregate`. Existing execution ledger and attention reads remain independent.
- Content: `listWorkArtifacts`, `resolveWorkArtifactReference`, `readCurrentRevisionReviewStates`, `readContentPackage`.
- Publishing: `readContentPublicationStates` (action request → permit → execution attempt). No alternate publication state is persisted.
- Measurements: `readPublicationMeasurements`, reusing the same publication read; its existing provider-observation identity/capability joins remain unchanged. Views, likes, comments and “as of” come only from stored measurements; null is not converted to zero.
- Preview: `readMediaAssetAction`, `readMediaVideoAction`, existing `InstagramApprovalPreview` and its request-bound image action. Private links are requested on demand after the existing integrity checks; no artificial thumbnail and no provider fetching at dashboard load.
- Authority: `resolveGovernanceAuthority`; this only controls presentation. Each mutation still independently resolves tenant/session and checks authority in its existing server seam.
- Decisions: `approveActionRequestAction`, `rejectActionRequestAction`, `acceptArtifactRevisionAction`, `requestArtifactRevisionChangesAction`.
- Existing `RequestCard` and `PermitRow` retain their single-item authorization, revoke, execute, YouTube read-back and explicit measurement-recording flows. Bulk code calls no execution action.

## Work/project relationships

Content relationships come from `readWorkEvidenceReferences` + `readWorkRegister`, grouped with `indexArtifactWorkPurpose`. Multiple declared work links survive; unavailable work names remain unresolved. This is a declared evidence relationship, not proof of content use or success. Action requests retain their existing `purposeWorkTitle` / `purposeUnresolved` projection. The permit reader does not expose a work relationship. These reads expose no separate authoritative project relationship, so the UI does not invent one.

## Bulk behavior

Approve All targets only approvable candidates in the current filtered, loaded list. Filter/search/channel changes clear selection. Confirmation shows exact revision bytes or request parameters/consequences, takes a human justification, and shows the existing permit lifetime options for action approvals. The user acknowledges having reviewed the records.

Items execute sequentially through their existing single-item decision actions. Client eligibility is not trusted for authorization. Already decided action requests, foreign-tenant references, revoked authority or other stale conditions are refused by the released server authority. Ineligible items are skipped. Success, refusal, skip and unknown response are reported individually; unknown responses are never automatically retried.

Request Changes exists only for content review. Content Reject uses the same existing Governance rejection outcome (`changes-requested`) and says so before confirmation; no new decision state is invented. Action request rejection remains the existing rejection seam. Approval does not call a publisher; the pre-existing runtime behavior for authorized agent-proposed internal work is disclosed and unchanged.

## Honest gaps and bounds

- No independent project relationship: explicit empty state, no inferred project names.
- No content visibility field: explicitly not recorded; action parameters / existing YouTube read-back retain their actual visibility information.
- No selected media / unavailable storage: empty/unavailable preview; no substitute asset.
- No stored measurement or editorial analysis: empty state; no score, generated analysis or monitoring claim.
- No complete chronological review-history reader: show latest review + recorded decision count and explain the limit; publication history comes from the released reader and displays truncation.
- Content window is the latest 50 artifacts' current revisions; request/permit readers retain their existing 50-row windows. Counts describe loaded records, overlapping categories and provider-accepted revisions, not unique projects or whole-tenant totals. Unavailable sources yield “—”, not zero.
- “Published” is explicitly provider-accepted publication with a returned identity, not proof of public visibility (YouTube may be private). Unknown execution never becomes Failed.

## Validation

- TypeScript: `npm run typecheck` passed.
- Changed-file lint: zero errors / warnings. Repository lint: zero errors, 20 existing warnings outside the changed files.
- 34 distinct targeted test files passed: the 27-file approvals / R3A / R3W / artifact-review / publication / measurement regression set, two additional dashboard truth/render tests and five YouTube execution/measurement tests. Relevant PostgreSQL tests used the existing disposable local-database harness; provider behavior in those existing tests is simulated, not a live provider call.
- Existing APP-2 mutation tests were rerun after the summary wording changed; they still detect all 13 mutations.
- Browser: static rendering of the actual dashboard component fed by real no-session reader outcomes, using the repository's compiled styles; inspected at 1280px and 390px. No horizontal overflow. Fixed a conflicting button color detected visually.
- Browser limitation: no authenticated tenant was configured in the isolated worktree. Populated live-tenant rendering, real user clicks that record business decisions, and authenticated Next route end-to-end behavior were not exercised. No fake business rows were added to obtain a screenshot.
- Production build / deploy not performed.

The delivery commit is the commit containing this report; its hash is reported in chat after creation.


## Pre-push acceptance — 2026-10-01

Acceptance started at `ba605064019cf14afa16d36c92abf81e68c1d2bc`, on the same feature worktree. Overall acceptance is **INCOMPLETE**, not PASS: the authenticated local runtime cannot yet supply populated records.

### Demonstrated bug and narrow fix

The queue card showed revision approval without exposing the latest publication attempt outcome. An accepted revision could therefore hide a later unknown or failed attempt in the list (the detail history was already truthful). A render regression failed against the original card, then passed after the card reused `PUBLICATION_STAGE_WORDING` for a distinct latest-publication badge. No classification, authority, read, action or schema changed. Tests include prior acceptance followed by unknown and request/permit/execution stages that do not establish publication.

### Runtime and UI evidence

- Started the real feature Next application at `http://127.0.0.1:3128/approvals`, using the existing local auth/database configuration read from the primary environment. No environment file was copied or altered.
- Initially redirected to sign-in; subsequently inspected the ordinary authenticated session and opened Approvals through navigation. No session fabrication or auth bypass.
- The existing tenant supplied no content cards. Request and permit readers returned unavailable. The dashboard displayed five unknown counters, explicit unavailable sources and disabled decisions because Governance authority was unresolved. No business data was created to fill the page.
- A read-only schema metadata transaction confirmed both `heby_action_requests` and `action_permits` lack `standing_authorization_id`. The required migration `20260915100638_rung2_standing_mutation_authorization.sql` already exists in baseline `01810404`. This explains why their released full-row reads cannot succeed against this local schema. No migration was applied to the canonical database.
- Actual hydrated route inspected at 1280×900 and 390×844: document width matched viewport at both sizes. Desktop queue/detail columns and mobile stacked panels rendered correctly. Status filter, search and oldest/newest controls responded; bulk controls remained disabled. Screenshots: `/private/tmp/hebun-acceptance-shots/desktop.jpg` and `/private/tmp/hebun-acceptance-shots/mobile-full.jpg`.
- Populated selected-card/details/tabs, long titles, assets, stored measurement and recording/loading outcomes were NOT verified in this real browser session. Empty/unavailable rendering is evidence only for those states.

### Actions, truth and regression

- Single approval/rejection and content accepted/changes-requested regression tests passed through the released server adjudicators with durable sessions and Governance in disposable PostgreSQL. No canonical business decision or publication was performed; browser server-action mutation was not executed.
- Added a bulk scenario to the existing authorization PostgreSQL test: six real disposable requests read through `readPendingActionRequests`, passed through `buildQueue`/`decideVisibleItems`, with each callback calling `approveActionRequest`. Verified stale rejection, cross-tenant refusal, simulated response loss AFTER durable approval, later independent success, deduplication, filtered Approve All, exactly four issued permits and zero execution attempts. These test records are not real-business render evidence.
- Counters/filter membership share `buildQueue.filters`; categories intentionally overlap. Provider acceptance requires a returned identity and does not establish public visibility. Unknown is never classified as failed. Unsupported request changes are skipped; content Reject uses the existing changes-requested outcome with disclosure.
- Read seams unchanged: content artifact/revision/review/package readers; request/permit readers; `readContentPublicationStates`; `readPublicationMeasurements`; verified media actions. Work links use `work_evidence_references` via `readWorkEvidenceReferences` + `readWorkRegister`/`indexArtifactWorkPurpose`, or recorded request purpose. No inferred project label or live measurement claim.
- 34 distinct targeted test files passed (29 approvals/regression + 5 YouTube measurement/execution). Provider transports in existing tests are simulated; no real provider operation. Final status render test was also rerun after adding the extra cases.
- TypeScript passed. Baseline changed-file lint passed with zero warnings/errors. Diff whitespace check passed. Full suite and deployment build were not run.
- Baseline diff reviewed: dashboard presentation/composition, route revalidation, related tests and delivery/learnings documentation only. Primary HEAD remained `e96dd36558745143afa0cf3b1235e8952816e457`; its pre-existing dirty/untracked status was unchanged. Generated `next-env.d.ts` change restored; existing module symlink and editor swap file left unstaged.

Remaining production gate: verify the intended environment has the released baseline schema and an authorized tenant with existing content/publication/observation/media records, then repeat populated desktop/mobile and authenticated action UI checks. No push or deploy.

## Release-gate repair — one approval surface, per-act authority, no Media door (2026-10-02)

The first release gate failed: four tests that pass at baseline `01810404` broke at `0420bf8f`. This supersedes the statements above that contradict it.

- **Preview removed from Approvals.** `AssetPreview`, `readMediaAssetAction` / `readMediaVideoAction` and every Media Asset identifier are gone from `src/components/approvals-dashboard/`. Selected media is listed from the `readContentPackage` projection (kind, dimensions, origin, lifecycle) with a link to Operations, where preview and media review remain. The Media Asset firewall's allowlist is unchanged. The request-bound `InstagramApprovalPreview` is unchanged.
- **No general authority flag on single-record controls.** The released `RequestCard` is rendered for the focused request regardless of `data.authorized`, and `PermitRow` is disabled only while a bulk decision is recording. Purpose declaration and Execute carry no Governance requirement on the server, so this surface no longer hides or disables them. `data.authorized` still closes only the queue and bulk controls, whose acts (authorize/refuse, content review) do require Governance authority.
- **Quick/bulk review summary.** It now shows the proposer (agent name or class, retired note), tool, declared purpose, target kind, payload locks and integrity values, and the stored-evidence distinction. A rationale block appears only for agent proposals; a human proposal shows none.
- **Restored statements.** The elapsed-time disclaimer beside the oldest pending action, and an explicit statement when requests or permits cannot be read.
- **Structure.** `RequestCard` keeps its released declaration and is exported by name. `ActionAuthorizations` is no longer mounted and was deliberately not removed; three older tests still pin its text and are cleanup for a separate change. Section order on the page was not changed.
- **Tests.** `agent-proposal-2/surface-and-firewall` now proves its invariant on the one surface: the page hands the pending requests to `ApprovalsDashboard`, the surface queues them and decides each through `RequestCard`, and no second approval surface is mounted. New `approvals-dashboard/single-surface-authority` pins the points above, including the firewall's own pattern finding nothing in the Approvals components.
