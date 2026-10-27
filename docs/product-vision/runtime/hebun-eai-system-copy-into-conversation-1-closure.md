# EAI-SYSTEM-COPY-INTO-CONVERSATION-1 · closure record · DEPLOYED — PRODUCTION ACCEPTANCE PENDING

**Scope, stated first.** A narrow security remediation, authorized by the Director on 2026-10-26
("GO — Narrow Security Remediation") and released on 2026-10-26 ("GO — CONTROLLED PRODUCTION
RELEASE"). It removes two UI paths that copied authoritative Governance data into a user instruction
field. It is **deployed to production; production UI acceptance is pending** (§4): neither surface had a
naturally eligible change-requested record to render, so the risk stays open. It creates no provider
disclosure permission and no data-use class. CONTENT-AGENT-2 and HEBY-WORKFLOW-1
are **not reopened**; their records stand as written.

## 1 · Risk and root cause

**EAI-SYSTEM-COPY-INTO-CONVERSATION-1.** System-owned authoritative data is copied into a user
instruction field and subsequently disclosed as `conversation`, bypassing source-authority
classification.

Observed scope, exactly two paths, both verified active in source at `7f297320` (published `main`):

| Path | Control | Code at `7f297320` |
|---|---|---|
| CONTENT-AGENT-2 · Operations, "Prepare with Hebun" revision form | "Revise with Hebun from this review" | `prepare-with-hebun.tsx`: `setInstruction(reason.justification)` in the button's `onClick` |
| HEBY-WORKFLOW-1 · Heby work-draft revise panel | "Use this reason as my instruction" | `heby-work-draft-affordance.tsx`: `onClick={() => setInstruction(basis.justification)}` |

Root cause: the server keeps the Governance justification out of the model by construction (the
preparation seam asks only the yes/no `isReviewBasisCurrent`; neither seam nor brief names a
justification — pinned by `tests/content-agent-2/surface-and-firewall.ts` §1). The client undid that:
one click put the justification in the textarea, the textarea is submitted as `prompt`, and the prompt
is the human's words, disclosed under `conversation`. The data-use classification was correct; the UI
relabelled the data before it reached it.

**Historical exposure is not assessed.** Whether any production preparation was submitted with a copied
justification was not measured; no production data was opened (ESC1-HISTORICAL-DISCLOSURE-1).

## 2 · What changed

| Commit | Content |
|---|---|
| `f7488863` | `fix(security): stop copying Governance justifications into agent instructions`. 6 files, +177 / −12, all under `apps/dashboard`: the two components above; `tests/content-agent-2/surface-and-firewall.ts` (the released pin "copied into the instruction verbatim" inverted to "never copied" — a legitimate change of a pinned behaviour, made in the same commit); `tests/helpers/system-copy.ts` (the checker); `tests/eai-system-copy-1/contract.ts` and `bite-proofs.ts`. |

**The two flows closed.**

1. CONTENT-AGENT-2: the button keeps its label and now only binds the revision to the read review
   (`setFromReview` → `expectedRevisionNo` + `reviewBasisDecisionId`). The justification is not written
   into the instruction. The hint now says the reason is not copied and not sent.
2. HEBY-WORKFLOW-1: the copy button is removed; a hint says to write one's own instruction.

**Not only the button.** The checker refuses every way the instruction setter can receive anything but
the human's typed `event.target.value` or `""`: a click handler, an effect, the state's initial value,
and a `prompt:` built from a justification. A read-only scan (§5) found no other handler or auto-fill
reaching either field.

**Preserved, by test.** The justification is still rendered as recorded on both surfaces; the typed
instruction is submitted as the prompt; no agent is preselected and nothing is asked without an explicit
agent and a read change request; revision N → N+1 still carries the staleness keys; the seam still asks
`mayReviseFromReview` and `isReviewBasisCurrent`; preparation egress classes are byte-identical; neither
the work title nor a justification is named by the seam, the assign path or the brief.

**Unchanged:** no server, action, prompt, egress composer, data-use policy, Governance, lifecycle,
schema or migration change. A human may still type anything, including the reason's words, by their own
hand; this phase adds no control over that (Director scope §3).

## 3 · Verification (V3)

V3: the change sits on the external-model egress classification boundary. The full suite was justified
by that boundary before it ran, in a disposable detached worktree.

**Baseline first.** On the unchanged tree `7f297320`: `tests/content-agent-2/surface-and-firewall.ts`
PASS, `tests/heby-workflow-1/revision-contract.ts` OK.

| Item | Measured (2026-10-26, worktree `.claude/worktrees/eai-system-copy-1`) |
|---|---|
| Targeted contract | `tests/eai-system-copy-1/contract.ts` exit 0 `PASS` (items 1–9 of the Director's list) |
| Negative bite-proof | `tests/eai-system-copy-1/bite-proofs.ts` exit 0, 6/6 mutations caught (B1 released CONTENT-AGENT-2 handler, B2 released HEBY-WORKFLOW-1 button, B3 initial state, B4 effect, B5 prompt built from the justification, B6 title copied). The checker run on the two **released** files at `7f297320` returns `setInstruction(reason.justification)` and `setInstruction(basis.justification)` |
| UI regression (static) | PASS: content-agent-2 surface-and-firewall, heby-workflow-1 revision-contract, agent-execution-1 capability-contract, agent-execution-2 specialist-contract, aor-1a diagnosis-contract, ap5a surface-and-firewall, ca2-preparation-failure-legibility surface-and-firewall, cgo9 surface-and-firewall, ops-ui-control-clarity control-grouping, work-outcome-closure-1 outcome-contract |
| Server regression (PostgreSQL) | PASS: content-agent-2 revise-from-review-postgres, heby-workflow-1 revision-postgres, content-ground1 grounding-and-firewall, aor-1b draft-mode-postgres |
| TypeScript | `tsc --noEmit` exit 0 |
| ESLint | changed files exit 0 |
| Build | `npm run build` exit 0 (Next 16.3.8 from `npm ci` against the published lockfile; 175 static pages) |
| Full suite | 2026-10-26 20:14:51Z–20:44:15Z, detached `.claude/worktrees/esc1-suite-f7488863` at `f7488863`: **1104 PASS / 1 FAIL / 1105**, zero REGRESSION. The one failure is BLOCKED, not PASS: `tests/r3w-flow/ambient-database-safety.ts` requires the canonical `hebun_r1` at 127.0.0.1:55432, which was not running and which this session may not start or touch ("R3W BLOCKED … unreachable (ECONNREFUSED) … this is NOT a pass"); it reads neither changed file |

**Test environment.** macOS (Darwin 25.2.0), Node with tsx. PostgreSQL 18.6 initialised by this session
in its scratchpad on 127.0.0.1:55499 (`system_identifier` 7701071965303287020, read from both
`pg_control_system()` and `pg_controldata`), reached only through `HEBUN_TEST_ADMIN_DATABASE_URL`;
`DATABASE_URL` unset; disposable `hebun_test_*` databases. No production database, no provider, no
network beyond `npm ci`.

**Not covered by execution.** No browser render of either surface; the bite-proof mutates text in memory,
not the source tree; no real provider; the source-mutating bite-proof files of other phases ran only
inside the full suite in the disposable worktree.

## 4 · Production

**Release.** `git ls-remote` read `7f297320` immediately before the push; `3c6c1204` descends from it.
Fast-forward push `7f297320..3c6c1204` to `refs/heads/main` on 2026-10-26 (~20:49:11Z), no force; remote
read back `3c6c1204f58f35500ca1aecde65085062f711681`. Released commits: `f7488863` (implementation),
`3c6c1204` (this record, VERIFIED state). Pre-push: `tsc --noEmit` exit 0, `git diff --check` clean,
contract and bite-proofs PASS, continuity PASS; full suite not rerun (code unchanged since §3).

**Deployment** (Vercel record, project `hebun-ai-recovered`): `dpl_DpEGhWjvjU89TwhqHtf41DZHbDtf`, target
production, READY 2026-10-26T20:49:52.892Z, `githubCommitSha` `3c6c1204…`, ref `main`, source git. Aliases
`www.hebuntech.com`, `hebuntech.com`, `hebun-ai-recovered-hebuntechs-projects.vercel.app` on it. Smoke:
`/` 200, `/login` 200; signed-out `/operations`, `/heby`, `/dashboard` 307 → `/login`. Runtime logs since
20:49Z: 23 requests, 0 × 5xx. READY is not functional acceptance.

**Production UI acceptance — UNVERIFIED on both surfaces** (2026-10-27, Director-signed-in built-in
browser, read-only: page loads and DOM/bundle reads, no click that writes, no model call):

| Surface | Result |
|---|---|
| CONTENT-AGENT-2 `/operations` | **UNVERIFIED.** No content draft whose current revision carries a `changes-requested` decision; the change-request block (`data-content-agent-2="change-request"`) is not rendered, so justification, control absence and binding could not be seen live. 5 "Prepare with Hebun" forms render. |
| HEBY-WORKFLOW-1 `/heby` | **UNVERIFIED.** The revise panel renders only for a `changes-requested` draft; the known example is rev 2 `awaiting-review`. No decision was created and no artifact changed to make one. |

Bundle evidence, **not** UI evidence: the JavaScript served for `/operations` contains the new CA2 hint
("The reason is not copied into it") and neither old string; the JavaScript served for `/heby` contains
the new HW1 hint ("the reason is not sent to the agent") and not "Use this reason as my instruction".
So the live tab runs post-fix code, but no rendered change request was observed.

**To close the risk:** a signed-in, read-only render of a naturally `changes-requested` record on each
surface showing the reason readable, no copy control, manual instruction field present (and for HW1,
explicit agent choice).

## 5 · Read-only scan for the same mechanism

Searched every component for setters of instruction, prompt, draft, input, composer or query state
fed by anything but typed input or `""`, and for prefill, initial-prompt and default-value patterns.

- Found: only the two paths above.
- Examined, not the same mechanism: Heby conversation suggestions (`buildConversationSuggestions`) are
  fixed product templates plus the route label, not authoritative records; HEBY-MEDIA-3 media prefill
  (`heby-media-prefill.tsx`) carries asset ids and codes, never text into a prompt; Heby command-palette
  submit sends a command id; `knowledge-version-control.tsx` initialises a Knowledge title field
  for a Knowledge write, which is not a model instruction.
- Not scanned: server-side composition beyond the two seams named in §2.

## Closure Contract (v1)

- Phase: EAI-SYSTEM-COPY-INTO-CONVERSATION-1
- Owner: apps/dashboard/src/components/operations-preparation/prepare-with-hebun.tsx (CONTENT-AGENT-2 revision form) and apps/dashboard/src/components/layout/heby/heby-work-draft-affordance.tsx (HEBY-WORKFLOW-1 revise panel); preparation seam, assign path, brief, EAI data-use policy, Governance and lifecycle unchanged
- Reached state: DEPLOYED
- Implementation commit: f7488863fb64f4108d1caf63af65c0fecb7194c3 — released to main by fast-forward 7f297320..3c6c1204
- Verification level: V3 — external-model egress classification boundary; full suite run in a disposable detached worktree
- Verification evidence: 2026-10-26, tests/eai-system-copy-1/contract.ts exit 0 PASS; tests/eai-system-copy-1/bite-proofs.ts exit 0, 6/6 caught, checker positive on both released files; 10 static UI regression files PASS; 4 PostgreSQL suites PASS; tsc exit 0; eslint on changed files exit 0; npm run build exit 0; full suite 1104 PASS / 1 BLOCKED / 1105, zero REGRESSION (tests/r3w-flow/ambient-database-safety.ts BLOCKED: canonical hebun_r1 at 127.0.0.1:55432 unreachable, not a pass)
- Test environment: worktree .claude/worktrees/eai-system-copy-1 at f7488863 (dependencies from npm ci, published lockfile); full suite in detached .claude/worktrees/esc1-suite-f7488863; macOS Darwin 25.2.0; PostgreSQL 18.6 initialised by this session on 127.0.0.1:55499, system_identifier 7701071965303287020, via HEBUN_TEST_ADMIN_DATABASE_URL; no production database, no provider
- Deployment evidence: dpl_DpEGhWjvjU89TwhqHtf41DZHbDtf — production, READY 2026-10-26T20:49:52.892Z, githubCommitSha 3c6c1204f58f35500ca1aecde65085062f711681, aliases www.hebuntech.com and hebuntech.com; / and /login 200; 0 × 5xx since 20:49Z
- Production acceptance evidence: N/A — production UI acceptance UNVERIFIED on both surfaces (no naturally changes-requested record); served bundles carry the fix, which is not UI evidence (§4)
- Deferred risks: EAI-SYSTEM-COPY-INTO-CONVERSATION-1 (DEFERRED); ESC1-HISTORICAL-DISCLOSURE-1 (DEFERRED); ESC1-ROLLBACK-RESTORES-1 (DEFERRED)
- Director approvals: narrow security remediation of the two observed copy paths, isolated worktree, targeted and regression tests, local commit, 2026-10-26; controlled production release of f7488863 + 3c6c1204 with read-only UI acceptance, 2026-10-26; closing the risk only on verified UI of both paths (not met)

### Deferred risk detail

- **EAI-SYSTEM-COPY-INTO-CONVERSATION-1 (DEFERRED).** Observed scope: CONTENT-AGENT-2 and HEBY-WORKFLOW-1
  Governance justification copying. Remediated in `f7488863`, deployed in
  `dpl_DpEGhWjvjU89TwhqHtf41DZHbDtf`. Production UI acceptance UNVERIFIED on both surfaces (§4).
  Acceptance dependency: a read-only signed-in render of a naturally `changes-requested` record on each
  surface; only then may a record mark it CLOSED (scoped to the two copy paths).
- **ESC1-HISTORICAL-DISCLOSURE-1 (DEFERRED).** Preparations already submitted with a copied justification
  sent Governance text to the provider as `conversation`; how many is unknown. Acceptance dependency: a
  Director-authorized read-only production measurement (no content read) and a decision on it.
- **ESC1-ROLLBACK-RESTORES-1 (DEFERRED).** After release, every older production deployment carries both
  copy controls; an instant rollback restores them. Acceptance dependency: any rollback below the release
  commit is a Director decision.

**Weekly three.** *Learned:* a server that keeps a record out of the model is undone by one client
handler that moves the record into the field the human owns; the data-use class follows the field, not
the origin, so the field's setter must accept only typed input. *Turkish Rug House:* TRH Governance
change-request reasons stay in Governance and no longer reach the provider labelled as a member's words.
*Hebun AI:* the source-authority classification now holds at the UI edge too, with a checker any new
instruction field can reuse.
