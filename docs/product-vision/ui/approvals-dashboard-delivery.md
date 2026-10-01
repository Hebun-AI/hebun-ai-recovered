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
