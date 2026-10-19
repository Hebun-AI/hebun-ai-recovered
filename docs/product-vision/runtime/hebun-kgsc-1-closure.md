# KGSC-1 — Knowledge Governance standing consistency: `/source`, `/knowledge` and the Knowledge workspace show Governance's reading, not the record's claim — Closure

Base `9a8b2cb3` (`origin/main`, production `dpl_HXzerzjq7GEHdBwjsprDov3vdzJG`). Worktree
`.claude/worktrees/kgsc-1`, branch `fix/kgsc-1-knowledge-governance-standing`. Local commit only; not
pushed, not deployed.

Paths are relative to `apps/dashboard/src/`.

## Root cause

`knowledge_nodes.ratification_decision_id` is writable (SCI-2A), so a non-null value is the record's
CLAIM. KNOWLEDGE-EVIDENCE-STANDING-1 made Heby grounding, `/search` and `/brief` ask Governance; these
surfaces still printed the claim as approval:

| Surface | Before |
|---|---|
| `/source`, `/knowledge` (`describeKnowledgeRecord`) | `· ratified ·` from `record.ratified` |
| Knowledge workspace record list (`knowledge-records.tsx`) | "ratified" from `record.ratified` |
| Governance review card (`knowledge-review-card.tsx`) | "Version N is ratified — Governance approved this exact version" from `record.ratified` |
| Version history (`knowledge-version-control.tsx`) | "ratified" from `Boolean(node.ratificationDecisionId)` |
| Coverage card, ingested-sources card | "N ratified" counted from claims; withdrawal block said "ratified by your Governance authority" |

A row naming another version's genuine decision therefore read as Governance-ratified everywhere here.

## What changed

| Piece | Change |
|---|---|
| `governance-decision/knowledge-ratification-read.server.ts` | `readKnowledgeGovernanceStandings` MOVED here from `heby-answer/knowledge-evidence.server.ts`, unchanged in logic; takes only `{ratificationDecisionId, activeKnowledgeNodeId}` so a history row qualifies |
| `heby-answer/knowledge-evidence.server.ts` | re-exports it (every Heby caller unchanged); `describeKnowledgeGovernanceStanding` gains `unavailable` |
| `knowledge-ratification/contracts.ts` | `GovernanceStandingReading` and `GOVERNANCE_STANDING_LABEL` — the Heby evidence card's words, client-safe |
| `knowledge/knowledge-read.server.ts` | `describeKnowledgeRecord` no longer prints the claim |
| `heby-commands/read-commands.server.ts` | `/knowledge` and `/source` (found and ambiguous) add Governance's line per record via `standingsOf`; an unanswered read → every record "verification unavailable", still shown |
| `app/(dashboard)/knowledge/page.tsx` | one standings read for the listed records, keyed by fact id, passed to the record list and each review card |
| `app/(dashboard)/knowledge/actions.ts`, `knowledge/knowledge-version-history.server.ts`, `knowledge/supersede-contracts.ts` | the version-history action injects the shared reader; each version gets `governanceStanding`; the reader is absent → no standing (released shape) |
| `components/knowledge-workspace/knowledge-records.tsx`, `knowledge-version-control.tsx` | the label is `GOVERNANCE_STANDING_LABEL[standing]`; no reading → "unavailable" |
| `components/knowledge-workspace/knowledge-review-card.tsx` | the approval box only when Governance says `ratified`; a claim it does not hold → "not confirmed", with the id labelled as the record's claim; unreadable → "neither confirmed nor denied" |
| `components/knowledge-workspace/company-understanding-card.tsx`, `knowledge-sources-card.tsx` | claim counts labelled "claiming ratification (not verified by Governance)"; the withdrawal-block sentence no longer asserts a Governance approval |
| `tests/kgsc-1/` (new) | `standing-postgres` (A–G against real Governance), `surfaces-render` (rendered workspace + wiring) |
| `tests/k1-flow/knowledge-boundaries.ts`, `tests/k4-flow/review-card-render.ts` | pins follow: the describe line carries no ratification; the K4 "already ratified" render passes Governance's reading |

Why the move: `tests/k2-flow/authority-and-validation.ts` forbids the Knowledge write path
(`knowledge/actions.ts`) from importing `@/features/heby-answer`. The reader now sits with the projection
it reads, one implementation, and that firewall is untouched.

Not changed: which records any surface can see, tenant scoping, lifecycle, ratify/reject/retract writers,
the ratify control's and withdrawal's preconditions (both still follow the claim, as the writers do),
`/search`, `/brief`, Heby grounding and evidence. No schema, migration, write, model call or permission.

## Truth semantics

| Governance's answer | Before | After |
|---|---|---|
| holds the claimed decision for this version | ratified | ratified — confirmed by Governance |
| claim present, decision not held | ratified | NOT confirmed |
| no claim | no ratification recorded | none recorded |
| read failed | (claim shown as ratified) | verification unavailable — neither confirmed nor denied |

## Verification (V2)

V2: a shared Governance read seam moved owner (consumers: Heby grounding, `/search`, `/brief`, `/source`,
`/knowledge`, the Knowledge workspace) with no change to its logic, and display changes on those
surfaces; no write, schema, grant, provider or tenant-boundary change.

| Item | Result |
|---|---|
| Baseline at `9a8b2cb3`, focused set (114 files: every suite naming the changed files, the shared reader or its module, K1–K4, KT-1, KT-3, R6B/R6D, SCI-2B, Knowledge search/evidence standing/brief, grounded conversation, Governance firewalls, continuity) | 114 PASS |
| Candidate (patch in a disposable detached worktree), same set + 2 new | 116 PASS — after the reader moved (first run: k2 import firewall FAIL, fixed by the move, not the test) and 2 pins changed in this commit |
| Bite-proofs: claim read as confirmation; failed read shown as not confirmed; `/source` without the Governance line; review card approving on the claim; record list showing the claim | the new tests FAIL each time |
| `tsc --noEmit -p .`, `eslint` on changed files, `npm run build` | exit 0 each |

## Three questions

1. **What did we learn?** When a reader is "shared" but lives in one consumer's module, the next consumer
   meets that consumer's firewalls; move the reader to the authority it reads rather than the import
   rule, and re-export so the old callers do not move.
2. **How does this improve Turkish Rug House?** A manager reading a policy in the Knowledge workspace or
   through `/source` can no longer mistake a record's own approval stamp for Governance's decision.
3. **How does this become part of Hebun AI?** Every surface now reads ratification from one Governance
   reader with one vocabulary, so the next surface inherits the rule instead of re-deriving it.

## Closure Contract (v1)

- Phase: KGSC-1
- Owner: Governance ratification projection (`governance-decision/knowledge-ratification-read.server.ts`) read by the Knowledge workspace and Heby read commands
- Reached state: VERIFIED
- Implementation commit: THIS COMMIT
- Verification level: V2 — shared Governance read seam moved owner unchanged; display changes on its consumers; no write, schema, grant, provider or tenant-boundary change
- Verification evidence: baseline at 9a8b2cb3, focused 114 files: 114 PASS; candidate (patch in disposable detached worktree) same set + tests/kgsc-1 (2): 116 PASS, after the reader moved to governance-decision (the k2 import firewall failed on the first candidate; it was honoured, not edited) and 2 pins moved with reasons (k1 describe line, k4 render passes Governance's reading); 0 REGRESSION, 0 PRE-EXISTING, 0 BLOCKED; 5 bite-proofs make the new tests FAIL; tsc --noEmit -p . exit 0; eslint on changed files exit 0; npm run build exit 0
- Test environment: worktree `.claude/worktrees/kgsc-1` (tsc, eslint, build, new tests); disposable detached worktree `.claude/worktrees/kgsc1-baseline-9a8b2cb3` at `9a8b2cb3` for the baseline and, with this change applied as a patch, for the candidate and the bite-proofs; `node --import tsx` per file; PostgreSQL 18 on 127.0.0.1:55433 via `HEBUN_TEST_ADMIN_DATABASE_URL`, harness-created databases; no `DATABASE_URL`, no model key, no network
- Deployment evidence: N/A — not deployed
- Production acceptance evidence: N/A — not released or deployed
- Deferred risks: KGSC1-BROWSER-UNVERIFIED-1 (DEFERRED); KGSC1-CLAIM-COUNTS-1 (DEFERRED); KGSC1-FORGED-CLAIM-BLOCKS-ACTIONS-1 (DEFERRED)
- Director approvals: KGSC-1 narrow implementation, local commit, no push, no deployment (Director, 2026-10-19)

## Deferred risks

- **KGSC1-BROWSER-UNVERIFIED-1 (DEFERRED)** — the workspace was rendered server-side in tests and the
  route wiring checked in source; no signed-in browser saw `/knowledge`. Closes with a signed-in read-only
  render of a confirmed and an unconfirmed record.
- **KGSC1-CLAIM-COUNTS-1 (DEFERRED)** — the coverage and ingested-sources counts are still counts of
  claims, now labelled so; a Governance-verified count needs an uncapped aggregate read. Closes with that
  read or a Director decision to drop the counts.
- **KGSC1-FORGED-CLAIM-BLOCKS-ACTIONS-1 (DEFERRED)** — a forged claim still hides the ratify control and
  blocks source withdrawal, because both writers refuse on the claim. Closes with a Director-authorized
  repair of such rows or a writer change.

KES1-CLAIM-LABEL-OTHER-PATHS-1 stays DEFERRED: `/knowledge` and `/source` are done here; work evidence and
the public-content label still show the claim.
