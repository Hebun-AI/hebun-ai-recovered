# SUITE-RECOVERY-1 — Controlled Local Integration and V3 Validation — Closure

Integrates four suite-recovery commits from `fix/suite-recovery-1` onto the local documentation
closure `61485c3f`, adds one test-only hardening commit for the two confirmed INT-5A gaps, and
measures the result at V3 against the production baseline. This record takes over
`hebun-suite-recovery-1-findings.md`.

**Status: VERIFIED locally, 2026-10-18. Not released, not deployed, not production-accepted.**

## Integration lineage

Branch `integration/suite-recovery-1-v3`, worktree `.claude/worktrees/suite-recovery-1-v3`, base
`61485c3fc0e01d71d3809760523b3a03fce3c23c` (descendant of production `f200eed4`, docs only on top).
Cherry-picked with `-x`, in this order:

| Integrated | Source | Subject | Patch identity |
|---|---|---|---|
| `30067b66` | `b378e7b3` | fix(heby): restore model-answer read-only firewall | identical patch-id |
| `63ed7ba1` | `64ee8a7a` | test(eai): align disclosure firewalls with B2 policy | test diff identical; `learnings.md` conflict resolved |
| `3f7d0528` | `45c1dd34` | test(db): restore historical migration integrity pins | identical patch-id |
| `d31cef37` | `bebde54f` | test(heby): restore source-class census contracts | identical patch-id |
| `c936a394` | — | test(int5a): make M11 and side-effect imports bite | new, test-only |

`a90ae98c` (the `hebun-loop.md` impact-set rule) is excluded: `hebun-loop.md` and `CLAUDE.md` are
byte-identical to `61485c3f`.

**Conflict resolution.** One conflict, `learnings.md`, append-only ledger: `61485c3f` added three
AP-6a / AP2-RULE6 lines, `64ee8a7a` added one SUITE-RECOVERY-1 B1 line at the same position. Both
kept, base lines first. `docs/MASTER-ROADMAP.md` merged without conflict (the SR1 §22 row landed next
to the AP-6a rows).

## Production source change (b378e7b3 only)

Twelve files under `apps/dashboard/src/features/`, all of them media or review read paths. Five new
read-only modules take readers out of modules that also hold writers or transports, so Heby's answer
graph stops reaching the Governance decision writer (G6C) and the media transports' `fetch`
(INT-5A/5B1/5C):

| New module | Moved from (which re-exports it) |
|---|---|
| `media-asset-review/read-media-asset-review-states.server.ts` | `review-media-asset.server.ts` |
| `media-assets/media-asset-records.server.ts` | `read-media-assets.server.ts` |
| `media-assets/media-video-records.server.ts` | `read-media-videos.server.ts` |
| `media-assets/read-video-generations.server.ts` | `async-generation-lifecycle.server.ts` |
| `work-artifact-review/read-revision-review-states.server.ts` | `review-revision.server.ts` |

`content-composition/heby-content-media-source.server.ts` and `read-content-package.server.ts` now
import from the new modules. Measured:

- **Moved verbatim.** Line multiset of the diff: every non-import, non-comment added line matches a
  removed line, except that ten moved helpers and row types gained `export` and the generations reader's `deps`
  type is named (`AsyncGenerationReadDeps`, `{ getDb? }`, structurally equal to the old
  `Pick<AsyncGenerationDeps, "getDb">`). Tenant predicates moved with the bodies.
- **Export surface unchanged.** TypeScript checker export list with types, all seven pre-existing
  modules, `f200eed4` vs integrated: identical except that one `deps` type name.
- **New modules are reads.** No `insert`, `update`, `delete`, `transaction` or `fetch`; imports are
  drizzle, schema tables, `media-db.server`, `client.server` (type or `getControlPlaneDb`), contracts,
  and one type-only `media-object-store` import. No new module imports an old one (no cycle added).
- **No schema or migration change**, no instruction file, no config, no secret, no authorization or
  provider module touched. Owners unchanged: writers and transports stay where they were.
- **Runtime equivalence is not claimed from bodies alone.** It is supported by the suite below,
  including the MV-4, media, review and Heby answer suites, and by the hybrid check (integrated tests
  on production `src/`), which isolates what the source change does and does not affect.

## INT-5A hardening (c936a394, test-only)

**M11 (`SR1-INT5A-M11-SURVIVOR-1`).** Cause confirmed: EAI-B2 renders `[integrations] withheld — not
disclosed to the external model` for the resolved read and for the pure resolver's unavailable
placeholder alike, so the model-facing assertion held with `withIntegrations` unwired.
`connection-grounding.ts` §11 now also reads `result.outcome.response.evidence` — the answer's
human-facing evidence, the same seam `e28-knowledge-coverage-grounding` reads — and requires
`integrations / google-workspace/drive.metadata`, which only the real tenant-scoped read produces. The
B2 assertions are unchanged; nothing new reaches the model; no production code changed.

- Unmutated: PASS. M11 in a disposable copy: FAIL, `withIntegrations is not wired — the answer's
  evidence carries no resolved integration capability`. Negative control: the pre-hardening test
  with M11 applied: PASS (the survivor reproduced).

**Side-effect imports.** `grounding-firewall.ts` follows `import "module";` as an edge
(`/(?:from\s+|^\s*import\s+)"([^"]+)"/gm`); the `from` arm is unchanged. Bite-proof M12 adds
`import "@/features/provider-google/read-drive-metadata.server";` to the grounding source.

- Forbidden side-effect import: new firewall FAIL, `may perform network I/O`, names
  `provider-google/google-transport.server.ts`. Old firewall (`d31cef37`): PASS (gap reproduced).
- Legitimate side-effect import (`import "./contracts";`): new firewall PASS.
- Graph sizes unchanged on today's tree (738 / 689 / 145 modules): no current module was hidden.
- `int5a-flow/bite-proofs.ts` in a disposable copy: 11/11 bit (M1, M3–M12); source restored.

**Remaining blind spots** (`SR1-IMPORT-GRAPH-BLINDSPOTS-1`): dynamic `import()`, `require()`,
single-quoted specifiers, and network clients other than the `fetch` identity. Out of scope here by
Director instruction.

## V3 results

Full suite, `npm run test:run`, PostgreSQL 18.6 on 127.0.0.1:55433 via
`HEBUN_TEST_ADMIN_DATABASE_URL`, `postgresql@18` first on `PATH`, `ANTHROPIC_BASE_URL` unset, no
`DATABASE_URL`, no model key. Both runs in disposable detached worktrees so bite-proofs never mutated a
shared tree; both left clean.

| Tree | Result |
|---|---|
| Production `f200eed4` | 999 passed, 47 failed, 1046 total, exit 1 (matches `EHO-1-RED-SUITE-BASELINE-1`'s 47) |
| Integrated `c936a394` | 1025 passed, 21 failed, 1046 total, exit 1 |

Classification: **introduced 0, fixed 26, pre-existing 21, unknown 0.**

- **Fixed (26):** `dh1-decision-horizon/bite-proofs`, `g5a-flow/bootstrap-boundary`,
  `g5a1-flow/recovery-boundary`, `g6c-flow/authority-reachability`, `g6d-flow/source-truth-consistency`,
  `glp-picker-per-file/boundaries-and-firewall`, `hebycap1-flow/bite-proofs`, `int5a-flow/bite-proofs`,
  `int5a-flow/grounding-firewall`, `int5b1-flow/{bite-proofs, provider-read-firewall}`,
  `int5b2-flow/{bite-proofs, pull-request-firewall}`, `int5c-flow/cross-source-firewall`,
  `invitation-revocation-flow/boundaries-and-firewall`, `knowledge-ingestion-flow/boundaries-and-firewall`,
  `kr4-flow/surfaces-and-firewall`, `kr5-flow/boundaries-and-firewall`,
  `osa-owner-eligibility/eligibility-firewall`, `osa3-departmental-placement/{bite-proofs, firewall,
  placement-truth}`, `osa4-people-register/people-truth`, `r4b-flow/lifecycle-boundary`,
  `r7-1-flow/boundaries-and-firewall`, `stranded-enrollment-flow/boundaries-and-firewall`.
- **Pre-existing (21).** Each re-run alone on production `f200eed4`, on the integrated tree, on a
  hybrid tree (integrated tests, `src/` byte-identical to `f200eed4`) and on `bebde54f`: all exit 1.
  14 fail with the same first assertion on every tree. 7 fail on production at an older pin that
  `45c1dd34` corrected, and on the integrated tree at a later assertion — the same later assertion on
  the hybrid and on `bebde54f`, so the production source fails it too and `b378e7b3` does not cause it.
  These were masked, not introduced.

### Triage of the 21 (read-only, 2026-10-18)

Method: first failure from a solo run; hidden assertions after it measured in the disposable worktree
`sr1-v3-suite-c936a394` with a preload that swallows only the named stale assertion and keeps every
other assertion hard (no repository file changed); masked bite-proofs re-run with the same preload in
their child suites; the worktree left clean after each run. Classes: A stale test pin, B harness or
fixture defect, C environment dependency, D legitimate architecture evolution, E production defect,
F security or authorization regression, G unknown.

| Test file | Failing assertion | Root-cause evidence | Class | Hidden after it |
|---|---|---|---|---|
| `cmd0-seeded-goals/containment` | server-action boundaries are exactly these | 6 `"use server"` modules added by approved phases: WF-1 `95b46e36`, WF-3C `5abab3ec`, AI planning `ef48cb4a`, request lifecycle `51eed3de`, WORK-UPDATE V1 `3ec2fb38`, YOUTUBE-WRITE-1 `ba64d4a0`; the current set is pinned and PASSes in `agent-id-0-1-acceptance/read-seam-and-truth.ts`; each action's own suites PASS | A/D | none |
| `cmdb1-command-overview/canonical-overview` | same census | same | A/D | none |
| `cmdfinal-command-cockpit/cockpit` | same census | same | A/D | none |
| `cmdb2-canonical-command-l2/navigation` | same census | same; then `CMD-B1 section "More intelligence"`, removed by CMD-FINAL `dd20b62d` | A/D | that one only |
| `cmdv3-command-composition/composition` | StateBlock consumer census | WF-2 `agent-capability-truth.tsx` (`8af0e7d9`), AP-2 `agent-placement-card.tsx` (`db970ef8`); then the server-action census | A/D | census only |
| `cmdb2-canonical-command-l2/bite-proofs` | M13 fails for the wrong reason | its target suite stops at the stale census; with that swallowed, M13 still does not bite: `command-overview.tsx` renders "Needs your decision" twice (lines 100, 113) and `replaceOnce` changes one | A (guard gap) | M13 does not bite |
| `dh1-decision-horizon/horizon-firewall` | `DECISION_SOURCE_KEYS.length` 4 ≠ 3 | `knowledge-public-use` added by KT-3/4/5 `c95a7e22` | A/D | none |
| `g3-flow/boundaries-and-firewall` | no Heby command may name an authority mutation | regex `grant.*author` matches the string literal "it grants no authority" in `heby-commands/action-plan.ts` (`877514de`); the file imports only types and `capability-truth`; the writer-symbol assertion before it passes | B (false positive) | none |
| `hlr-human-legibility/legibility-firewall` | legibility consumer census | `(dashboard)/layout.tsx` reads the session user's own label for the account menu (`0495b901`), tenant-scoped | A/D | none |
| `hlr-human-legibility/bite-proofs` | H7 fails for the wrong reason | target suite stops at that census; with it swallowed, 9/9 bite | B (masked) | none |
| `instagram-account-lifecycle/lifecycle-firewall` | refusal unconditional on caller permission | regex pins the pre-refactor inline comparison; `20811052` extracted `isAccountChange` (same predicate, no permission parameter); `account-changed` is proved behaviourally by 6 passing postgres suites | A | none |
| `instagram-account-observation/provider-firewall` | `bind-instagram-grant` contains no `db.transaction(` | `ef83522f` (INSTAGRAM-OAUTH-INTEGRITY-AUDIT-1) moved the bind into one transaction to close a token-binding race; the module imports no schema and no ORM and writes only through the integration and credential authorities | D (boundary decision) | none |
| `instagram-oauth-admission/ceremony-firewall` | ceremony requests exactly one scope | `instagram_business_content_publish` added by PUBLISH-0 `f2005e84`, PRODUCTION ACCEPTED in `hebun-publish-0-closure.md`; then 2 migration censuses (PUBLISH-0, YOUTUBE-WRITE-2) | A/D | 2 censuses |
| `media2a-openai-image-transport/bite-proofs` | B12 anchor not found (0 ≠ 1) | MV-6/MV-7 appended keys after `OPENAI_IMAGE_GENERATION_CONTROL_KEY` in `scripts/lib/provider-connectivity.ts`; the key is still enumerated (line 195). B1–B11 bite; with B12 removed in the disposable copy, B13 bites | A | B12 unproven |
| `mv6-higgsfield-video/lifecycle-postgres` | `dispatch-safety-cap-reached` | the test predates AP-3 and registers more than the default 5 media dispatches per tenant day; with `HEBUN_AI_DISPATCH_CAP_MEDIA_PER_TENANT_DAY=100` the whole file PASSes; the cap behaves as designed (1000 is out of range and fails closed to 0) | B (fixture) | none |
| `prodmig-flow/boundaries-and-firewall` | only the migration ceremony imports migration mechanics | `i2v`/`mv7` acceptance (`5a130086`, `c2905715`) import `createValidatedBackup`/`readServerVersion`; processor attestation (`33733cdd`) imports fingerprint helpers; none imports `applyPendingMigrations` or the migration lock | D (boundary decision) | none |
| `prodmig-flow/bite-proofs` | M6 fails for the wrong reason | target suite stops at that census; with it swallowed, 18/18 bite | B (masked) | none |
| `provenance-vocabulary/provenance-vocabulary` | only a declaring schema module names the production root | EAI `601db194` declares the root inside an array in `db/schema/external-ai-data-use.ts` (not the recognized single-const form) and repeats the literal in `external-ai-data-use/contracts.ts` | A + vocabulary duplication | none |
| `r3w-flow/ambient-database-safety` | unhandled `57P01`, no assertion | the test reads canonical `hebun_r1` on `127.0.0.1:55432`, which is not running (connection refused, measured); the outer `finally` drops the disposable database while `setup` is still connected, so the drop's backend termination crashes the process and hides the refusal | C + B | the whole proof |
| `supplied-media-account-provenance-1/provenance-postgres` | connection row cannot be deleted while an asset names it | the delete IS refused, by `integration_credentials_tenant_integration_fk` (INT-2), code 23001, message "violates RESTRICT setting of foreign key constraint"; the regex expects "violates foreign key", the wording PostgreSQL 18 changed for RESTRICT (derived) | C | the media FK itself is not isolated |
| `wev1-work-evidence/evidence-firewall` | closed executable set is what GIA-2 left | PUBLISH-0 `f2005e84`, YOUTUBE-WRITE-2 `e9a715cd`, WORK-UPDATE V1 `3ec2fb38`; then source-class count 22 ≠ 21 (HEBY-MEDIA-1 `content-media`, already pinned by `bebde54f` elsewhere) | A/D | count only |

Result: E 0, F 0, G 0. No failure shows production violating its contract. Four need a Director
boundary decision rather than a pin update — `instagram-account-observation` (a transaction in a
provider module), `prodmig-flow` (who may import migration helpers), `provenance-vocabulary` (a second
spelling of the production root) and `r3w-flow` (the canonical-protection proof does not run here).
Two are guard gaps: `cmdb2` M13 and `media2a` B12.

**Count reconciled.** The 13 came from an 85-file impact subset run by the suite-recovery session
(scratchpad `2fd95cd0…/sr/impact.txt`, results `res-C.txt` and `res-D.txt`, identical: 72 pass, 13
fail), on a tree before `c936a394`. The 21 are from the full 1046-file suite. Both count test files;
the runner never reports cases. 12 of the 13 are among the 21; the 13th, `int5a-flow/bite-proofs`, was
the M11 survivor that `c936a394` fixed. The other 9 of the 21 are outside the 85-file subset:
`cmdb2…/bite-proofs`, `hlr…/bite-proofs`, the three Instagram firewalls, `media2a…/bite-proofs`,
`prodmig…/bite-proofs`, `r3w-flow/ambient-database-safety`, `supplied-media…/provenance-postgres`.

Targeted (all inside the integrated run, all PASS): `int5a-flow/{grounding-firewall,
connection-grounding, bite-proofs}`; `ap2-agent-placement/{firewall, bite-proofs, placement-postgres}`;
`development-continuity/closure-contract`; 67 Heby answer / grounding / EAI files; 73 authorization,
authority, tenant and isolation files; 50 media files (the 3 media failures above are pre-existing).
`tsc --noEmit` 0 errors; eslint clean on the three changed test files; `git diff --check` clean.

## Release readiness

Ready for a future controlled release **as a candidate**, with these facts for the Director:

- Exactly five commits over `61485c3f`, all listed above; 49 files: 12 `src/` (b378e7b3), test files,
  `docs/MASTER-ROADMAP.md`, the findings record, `learnings.md`. No migration, schema, config,
  instruction, environment or dependency file.
- No new authorization, provider, execution or tenant authority. Production executable change is the
  read-module split only.
- The suite stays red at 21 pre-existing failures. A release on this branch improves 47 → 21 and
  introduces none; it does not make the suite green.
- Production source is unchanged by this phase until a push; `origin/main` = `f200eed4`.

Release blockers, exactly: no push or deploy approval; the Director's decision on the 21 (above) and
on the four boundary decisions; `EHO-1-RED-SUITE-BASELINE-1` stays DEFERRED with its owner. Before any
push: a local `npm run build`, and after deployment an authenticated read-only look at `/operations`
(content package, media and video lists, review states) and one Heby answer that grounds on content
media, since those are the only surfaces that read the moved modules.

## Closure Contract (v1)

- Phase: SUITE-RECOVERY-1
- Owner: Heby answer read-only firewall (G6C, INT-5A/5B1/5C) and the Media Asset / Work Artifact Review read authorities that own the moved readers; INT-5A test suites
- Reached state: VERIFIED
- Implementation commit: 30067b660a998d3932845d5c961927bfbe17d9d6, 63ed7ba101b14e795ae9508b7d4e4f4b0f2c36f0, 3f7d0528ede3571985865419194e2e30285869d2, d31cef37192290331609feb8620ee3c9e119ec8a, c936a394f9cca5658f1bb76c4eebacdbd3d3392f
- Verification level: V3 — the change moves readers across the Heby answer graph's authority and network boundary, so security firewalls, bite-proofs and the full suite against the production baseline were required
- Verification evidence: full suite f200eed4 999/47/1046 exit 1, c936a394 1025/21/1046 exit 1; introduced 0, fixed 26, pre-existing 21 (re-run alone on f200eed4, c936a394, hybrid src=f200eed4, bebde54f); int5a bite-proofs 11/11 in a disposable copy; M11 and M12 mutation and negative controls; export surface identical; tsc 0; eslint clean; git diff --check clean (2026-10-18)
- Test environment: worktree `.claude/worktrees/suite-recovery-1-v3` (branch `integration/suite-recovery-1-v3`, base 61485c3f); disposable detached worktrees `sr1-v3-baseline-f200eed4`, `sr1-v3-suite-c936a394`, `sr1-v3-hybrid`, `sr1-v3-bebde54f`; disposable scratchpad copies for mutations; `node --import tsx`; PostgreSQL 18.6 on 127.0.0.1:55433; `DATABASE_URL` and model credentials unset
- Deployment evidence: N/A — not deployed
- Production acceptance evidence: N/A — not deployed; production remains f200eed4
- Deferred risks: SR1-INT5A-M11-SURVIVOR-1 (CLOSED); SR1-IMPORT-GRAPH-BLINDSPOTS-1 (DEFERRED); SR1-PRE-EXISTING-21-1 (DEFERRED)
- Director approvals: SUITE-RECOVERY-1 controlled local integration, 2026-10-18 — new integration worktree, cherry-pick of b378e7b3, 64ee8a7a, 45c1dd34, bebde54f, V3 validation, one test-only hardening commit, this local closure record; push, deployment, production mutation, live provider and live model calls, changes to existing worktrees and a90ae98c NOT approved. Local documentation closure commit and read-only triage of the 21, Director 2026-10-18; source and test changes, push and deployment NOT approved

### Deferred risk detail

- **SR1-INT5A-M11-SURVIVOR-1 (CLOSED).** Resolved by `c936a394`: `connection-grounding` fails, for
  the intended reason, when `withIntegrations` is unwired, and `int5a-flow/bite-proofs.ts` passes.
- **SR1-IMPORT-GRAPH-BLINDSPOTS-1 (DEFERRED).** The INT-5A firewall does not follow dynamic
  `import()`, `require()` or single-quoted specifiers, and recognizes network reach only through the
  `fetch` identity. Acceptance dependency: a Director-selected firewall hardening phase.
- **SR1-PRE-EXISTING-21-1 (DEFERRED).** 21 test files fail on production and on this candidate for
  the same reasons. Triaged above: no production defect and no authorization regression found; four
  need a boundary decision, two are guard gaps, the rest are stale pins, fixtures or environment.
  Acceptance dependency: a Director-selected test-repair phase, preceded by the four boundary decisions.

Preserved unchanged: AP-6a PRODUCTION-ACCEPTED; AP-6b DEFERRED — NOT IMPLEMENTED; AP2-RULE6-RAW-SQL-1
DEPLOYED; every AP-6a deferred risk; `EHO-1-RED-SUITE-BASELINE-1` DEFERRED (owner EAI-HISTORY-ORIGIN-1;
this phase reduces the measured red set from 47 to 21 but does not resolve it).

## Three questions

1. **What did we learn?** A withheld model-facing line is the same for "resolved" and "never read",
   so it cannot prove a seam is wired; the human-facing evidence can. And a firewall that follows only
   `from "…"` misses a bare side-effect import that still loads the transport.
2. **How does this improve Turkish Rug House?** TRH's Heby answers keep their guarantee that an answer
   cannot reach a media transport or the decision writer, and that guarantee is now tested again
   instead of masked by a red suite.
3. **How does this become part of Hebun AI?** The read/write split for media and review readers and
   the two bite-proofs (M11 behavioral, M12 side-effect import) are part of the suite every later
   phase runs.
