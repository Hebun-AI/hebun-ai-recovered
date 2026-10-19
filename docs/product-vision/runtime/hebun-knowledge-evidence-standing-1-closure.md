# KNOWLEDGE-EVIDENCE-STANDING-1 — Governance-verified ratification in Heby's Knowledge evidence — Closure

Base `663fee0b` (`origin/main`, production `dpl_iJypG7zPaUgG7iFSaRuRpmPuP34Q`, KNOWLEDGE-SEARCH-V1).
Worktree `.claude/worktrees/knowledge-evidence-standing-1`, branch `feat/knowledge-evidence-standing-1`.
Local commit only; not pushed, not deployed.

Paths are relative to `apps/dashboard/src/`.

## The defect corrected

In the Knowledge, Intelligence and Governance workspaces Heby resolves Knowledge through
`resolveKnowledgeEvidenceDetailed`. Its model grounding (`ratified: yes`) and the KR4 card chip
("ratified") were derived from the record's own `ratification_decision_id`, a writable claim (SCI-2A).
A forged or stale claim was therefore told to the model and shown to the person as a ratification
Governance never made. `/heby` (HGC-1) and `/search` already asked Governance; this path did not.

## What changed

| Piece | Change |
|---|---|
| `features/heby-answer/knowledge-evidence.server.ts` | `resolveKnowledgeEvidenceDetailed` reads `readKnowledgeGovernanceStandings` for every served record; model grounding `ratified:` becomes `yes` / `no` / `not confirmed by Governance`; evidence items carry the reading; unreadable → Knowledge source unavailable. `/heby`'s ratified-only path attaches `ratified` to the items its check kept (policy unchanged) |
| `features/knowledge-retrieval/evidence.ts` | optional `ratificationStanding` on the evidence item (never persisted); `summarizeEvidenceStanding`; the two limitation sentences |
| `features/knowledge-retrieval/index.ts` | exports |
| `components/layout/heby/heby-evidence.tsx` | ratification chip from Governance's reading; a stored claim with no reading reads "Governance verification not established"; a claimed date is labelled as the record's; deterministic summary above matched and bounded-universe sets; the absence sentence on a no-match set |

`ratified` keeps its meaning (the record's claim) because it is persisted in `heby_answer_evidence`;
no column, migration, table, provider, permission, prompt text or EAI scope was added or changed. The
set of Knowledge records reaching the model is unchanged; only the `ratified:` value in its detail
line changes, and only on this path.

## Authority boundaries

- Governance: the standing is the existing shared read (one implementation with `/heby` and `/search`),
  tenant-scoped; any unanswerable or throwing read makes the whole Knowledge source unavailable — no
  record is served half-verified. Other sources keep their own availability.
- Knowledge: lifecycle and ratification stay separate chips; a ratified record can still read `draft`.
- Tenant: `TenantContext` only; Postgres-tested with two tenants, and every Governance read is
  asserted to be scoped to the asking tenant.
- `/heby` ratified-only policy, EAI policy, g2/k4 and KR4/KR5 firewalls unchanged (KR4's "evidence.ts
  must not reach governance" pin is honoured by naming the field `ratificationStanding`).

## Historical compatibility

Stored evidence has no column for the reading, so a reloaded answer carries none. The card then shows a
stored claim as "ratification claimed — Governance verification not established" (a no-claim record
stays "no ratification recorded"), and the summary counts it under "not established". Nothing stored is
re-promoted to Governance-confirmed, including answers that were verified when live
(`KES1-STANDING-UNPERSISTED-1`).

## Verification (V2)

V2: a shared grounding seam (model grounding and evidence card) and its fail-closed behaviour change;
no write, schema, grant, provider or EAI boundary moves.

| Item | Result |
|---|---|
| New `knowledge-evidence-standing-1/standing-postgres` (A–H) | PASS |
| Baseline at `663fee0b` / candidate, 99 suites importing the touched modules | 258 PASS + 1 BLOCKED / 259 PASS + 1 BLOCKED (same `r3w` environment block); 0 REGRESSION |
| `tsc --noEmit -p .`, `eslint` on changed files, `npm run build` | exit 0 each |

One pin moved: `kr4-flow/surfaces-and-firewall` §5 now removes the exact Director-required sentence
"Conflicts have not been evaluated." before scanning for judgement words, and asserts it is present;
every banned word is still banned everywhere else on the card.

## Three questions

1. **What did we learn?** A displayed approval must come from the approving authority at read time; a
   copy of its id on the approved row is a claim, and one path still trusted it.
2. **How does this improve Turkish Rug House?** When its people ask Heby about a policy in the
   Knowledge workspace, "ratified" now means Governance actually decided it, and the card says what was
   not evaluated.
3. **How does this become part of Hebun AI?** Every Knowledge path that shows ratification now reads
   Governance; the remaining claim-based labels are named below.

## Closure Contract (v1)

- Phase: KNOWLEDGE-EVIDENCE-STANDING-1
- Owner: Heby Knowledge evidence (`features/heby-answer/knowledge-evidence.server.ts`) and the KR4 evidence card (`components/layout/heby/heby-evidence.tsx`); standing read from Governance's existing ratification projection
- Reached state: VERIFIED
- Implementation commit: THIS COMMIT
- Verification level: V2 — shared grounding seam and evidence card; no write, schema, grant, provider or EAI boundary changes
- Verification evidence: baseline at 663fee0b, 259 files in 99 suites importing the touched modules (incl. KR3, KR4, KR5, HGC-1, KT-1, KT-2, k1, E2-8): 258 PASS / 1 FAIL; candidate (this change applied in a disposable detached worktree), same files + the new suite: 259 PASS / 1 FAIL; the one FAIL in both is r3w-flow/ambient-database-safety, BLOCKED (canonical hebun_r1 at 127.0.0.1:55432 unreachable, ECONNREFUSED; not a pass); 0 REGRESSION, 0 PRE-EXISTING, 1 BLOCKED; two mutation bite-proofs (grounding built without the Governance reading; the card promoting a stored claim to confirmed) each make standing-postgres FAIL; `tsc --noEmit -p .` exit 0; `eslint` on changed files exit 0; `npm run build` exit 0
- Test environment: worktree `.claude/worktrees/knowledge-evidence-standing-1` (tsc, eslint, build, focused tests); disposable detached worktree `.claude/worktrees/intel-discovery-008aa7f6` at `663fee0b` for baseline and, with this change applied as a patch, for the candidate; `node --import tsx` per file; PostgreSQL 18.6 on 127.0.0.1:55433 via `HEBUN_TEST_ADMIN_DATABASE_URL`, harness-created databases; no `DATABASE_URL`, no model key
- Deployment evidence: N/A — not deployed
- Production acceptance evidence: N/A — not released or deployed
- Deferred risks: KES1-BROWSER-UNVERIFIED-1 (DEFERRED); KES1-STANDING-UNPERSISTED-1 (DEFERRED); KES1-CLAIM-LABEL-OTHER-PATHS-1 (DEFERRED)
- Director approvals: discovery recommending this capability (Director, 2026-10-19); implementation of KNOWLEDGE-EVIDENCE-STANDING-1 with tests, V2 validation and one local commit, no push, no deployment (Director, 2026-10-19)

## Deferred risks

- **KES1-BROWSER-UNVERIFIED-1 (DEFERRED)** — the card was proven by server-side rendering
  (`renderToStaticMarkup`) against a real database, not in a signed-in browser. Closes with a signed-in
  render of a Knowledge-workspace answer's evidence card.
- **KES1-STANDING-UNPERSISTED-1 (DEFERRED)** — the Governance reading is not stored with an answer (no
  column), so every reloaded answer shows "verification not established". Closes with a Director
  decision on persisting it (a schema change) or accepting the limit.
- **KES1-CLAIM-LABEL-OTHER-PATHS-1 (DEFERRED)** — outside this phase's scope, three displays still label
  ratification from the record's claim: `/knowledge` and `/source` (`describeKnowledgeRecord`), work
  evidence (`organizational-work/read-work-evidence.server.ts`), and the public-content path's
  grounding label. Closes with a Director-selected phase applying the same read there.
