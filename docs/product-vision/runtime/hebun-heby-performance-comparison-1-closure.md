# HEBY-PERFORMANCE-COMPARISON-1 · closure record · PRODUCTION-ACCEPTED

`/performance` in `/heby` now names the organization it read, groups publications by provider, and
prints two elapsed times per measured publication: publication → latest stored reading, and that
reading's age at the moment of the read. For Instagram it also prints the change between the two
newest stored media observations, taken verbatim from IG-AN3's released derivation
(`PublicationMeasurement.evolution`). Nothing in this phase subtracts a count. A fixed set of
limitation sentences says what the counts cannot claim.

It extends HEBY-OBSERVED-PERFORMANCE-READ-1 (HOPR-1) and keeps every property of that command: a
deterministic read, no SQL of its own, no write, no provider call, no transport, no model client, no
durable message, no model context. It adds no table, no migration, no environment variable, no
permission, and no change to Knowledge, Governance, EAI or any provider authority. It ranks, scores
and judges nothing; ordering is newest first inside each provider group, never by a count.

## 1 · What was released

| Commit | Content |
|---|---|
| `637a14fa` | `feat(heby): name organization and show recorded performance comparisons`. 5 files, +536 / −26: `heby-commands/performance-read.server.ts` (organization, `readAt`, `elapsed`, timing and evolution sentences, provider groups, `PERFORMANCE_LIMITATIONS`), `read-commands.server.ts` (passes `readOrganizationAuthority`, titles the result), HOPR-1's `render-and-firewall.ts` (fixtures carry the new `organization` / `readAt` fields; assertions kept), and 2 new test files under `tests/heby-performance-comparison-1/`. No schema file, no migration. |

On `main`: fast-forward `b57aad84 → 637a14fa`; `origin/main` read as `637a14fa` on 2026-10-16.

**Reused authoritative seams, none changed.**

| Seam | Used for |
|---|---|
| Organization authority (`readOrganizationAuthority`) | The organization name, for the session's tenant only. Handed in by `read-commands.server.ts`, which already consumes the seam, so the command adds no consumer. Unreadable → the title omits the name and the answer says the records are the active organization's. |
| IG-AN3 media measurement evolution (`PublicationMeasurement.evolution`, `INSTAGRAM_MEDIA_GAP_NOTES`) | Instagram previous → latest counts and signed change, or IG-AN3's own gap sentence. Printed, never recomputed. |
| HOPR-1 composition (`listWorkArtifacts`, `readWorkArtifactHistory`, `readPublicationMeasurements`) | Drafts, revisions, ledger and stored observations, unchanged, including the 50-revision bound and the absence semantics. |
| YouTube publication measurement (`describeYouTubePublicationMeasurement`) | Unchanged sentence; HPC-1 appends timing only when a measurement exists. |

**What the command refuses to say.** A negative or unparseable span is not printed as an elapsed time;
the line says why. Counts in one provider group read at different instants are said to be. There is
no freshness threshold, no label, no rate (Hebun holds no reach or impressions), no cross-platform
comparison, and no cause or success claim.

## 2 · Verification (V2)

V2: the change extends one read command in the shared Heby command registry and adds a read of the
Organization authority through its existing caller. It changes no write path, no grant, no schema and
no provider boundary. Re-run for this closure on 2026-10-16 in the phase worktree at `637a14fa`.

| Item | Measured |
|---|---|
| Static checks | `tsc --noEmit -p .` exit 0; `eslint` on `performance-read.server.ts`, `read-commands.server.ts`, `tests/heby-performance-comparison-1` and `tests/heby-observed-performance-read-1` exit 0 |
| Phase tests | `tests/heby-performance-comparison-1/render-truth.ts` PASS (organization title and unreadable-name path, provider grouping and order, elapsed spans including zero and negative, evolution printed verbatim including a doctored `change`, gap and no-evolution wording, 0 / "not reported" / superseded truth, no judgement words). `tests/heby-performance-comparison-1/comparison-postgres.ts` PASS on a disposable PostgreSQL 18 database (title per tenant, no cross-tenant name, evolution from two stored observations, elapsed from ledger and observation instants, zero writes). |
| Regression | `tests/heby-observed-performance-read-1/render-and-firewall.ts` PASS (incl. import firewall: no model, transport, provider, writer, EAI or grounding module) and `performance-postgres.ts` PASS |

## 3 · Production release and acceptance

| Gate | Time (UTC) | Measured |
|---|---|---|
| Release | 2026-10-16 | `origin/main` = `637a14fa65aa57c9b7dd91bb127ac4c26b853ae9`, parent `b57aad84` (HOPR-1 closure) |
| Deploy | 11:11:01Z → Ready 11:12:48Z | `dpl_k6Y2YiYgCNMKAGeUjmyDKLRKRdCX`, target production, `githubCommitSha` `637a14fa…`, ref `main`, source `git` (no manual deployment). Aliases `www.hebuntech.com`, `hebuntech.com`, `hebun-ai-recovered.vercel.app`. Status READY, promoted. |
| Smoke | 11:38:49Z | `/` 200, `/login` 200, signed-out `/heby` 307 → `/login` |
| Read-only production verification (implementation session) | 2026-10-16 | Reported to the Director in the implementation session's production acceptance report, read-only: the five accepted publication records; the Instagram observation evolution; the YouTube measurement values; the publication-to-observation durations; the tenant-scoped organization identity; no detected attributable writes, model calls or provider calls. **Provenance:** that session's report as relayed by the Director on 2026-10-16. This closure session did not repeat these checks and does not hold their raw output. |
| Director acceptance | 2026-10-16 | The Director, signed in, ran `/performance` and reviewed the complete output titled **"Publication performance · Turkish Rug House"**. All five publication measurements, the Instagram evolution values, the elapsed durations and the limitation statements matched the accepted evidence. PRODUCTION-ACCEPTED confirmed in chat. |

**Evidence provenance, kept apart.**

| Evidence | Source | Repeated in this closure session |
|---|---|---|
| Director visual acceptance of the complete production output | Director, in chat, 2026-10-16 | Not applicable — a Director act |
| Read-only production database verification (five publications, IG evolution, YouTube values, durations, organization identity, no attributable writes / model / provider calls) | Implementation session's production acceptance report | **No** |
| `origin/main` = `637a14fa`; deployment `dpl_k6Y2…` READY production at `637a14fa`; HTTP smoke | This closure session, 2026-10-16 | **Yes** (measured here) |
| tsc, eslint, HPC-1 and HOPR-1 phase tests | This closure session, phase worktree | **Yes** (re-run here, all PASS) |

**HOPR-1-ORG-LEGIBILITY-1 is resolved here.** The production title now names the active organization
read through the Organization authority, which is exactly that risk's acceptance dependency; the
implementation session's read-only verification reported the tenant-scoped identity, and the Director
saw the title. Per §16.1 ("Resolve"), this record lists it `CLOSED` and the §22 pointer moves here.
The HOPR-1 closure record is not edited.

## 4 · Not verified

- **Unavailable to this closure session:** a production screenshot, and the raw output (queries,
  row counts, timestamps) of the implementation session's read-only database verification. Those
  checks are recorded above as reported, with their provenance; they were not repeated here, and this
  session opened no production data.
- **Edge wording in production.** The unreadable-organization line, a suppressed (negative or future)
  elapsed time, the "read at N different instants" notice, IG-AN3 gap notes and the no-evolution
  sentence are proven by local tests; they were not separately confirmed in production
  (HPC-1-PROD-EDGE-PATHS-1).
- **Exact write, model-call and provider-call counts** for the acceptance window are not reproduced
  in this record. The implementation session reported none detected as attributable; locally, the
  import firewall and the postgres zero-write check prove the same property.

## Closure Contract (v1)

- Phase: HEBY-PERFORMANCE-COMPARISON-1
- Owner: apps/dashboard/src/features/heby-commands/performance-read.server.ts (the `/performance` composition and rendering) with read-commands.server.ts (organization read and title); Organization authority, IG-AN3 evolution, Work Artifacts, Action Authorization's ledger, Provider Observation History, Knowledge, Governance and EAI unchanged
- Reached state: PRODUCTION-ACCEPTED
- Implementation commit: 637a14fa65aa57c9b7dd91bb127ac4c26b853ae9 — released on `main` (fast-forward from b57aad84)
- Verification level: V2 — one read command extended in the shared Heby command registry, reading the Organization authority through its existing caller; no write path, grant, schema or provider boundary changed
- Verification evidence: tsc --noEmit 0; eslint on the changed source and both phase test directories 0; tests/heby-performance-comparison-1/render-truth.ts PASS; tests/heby-performance-comparison-1/comparison-postgres.ts PASS; tests/heby-observed-performance-read-1/render-and-firewall.ts PASS; tests/heby-observed-performance-read-1/performance-postgres.ts PASS
- Test environment: worktree `.claude/worktrees/heby-performance-comparison-1` at 637a14fa; macOS (Darwin 25.2.0); Node 24.16.0 with tsx; PostgreSQL 18 at localhost:5432 as `postgres` via HEBUN_TEST_ADMIN_DATABASE_URL (disposable databases); no provider, no model
- Deployment evidence: dpl_k6Y2YiYgCNMKAGeUjmyDKLRKRdCX READY production at 637a14fa (githubCommitSha), created 2026-10-16T11:11:01Z by the git integration, aliases www.hebuntech.com and hebuntech.com
- Production acceptance evidence: section 3 — (a) read-only production database verification reported by the implementation session: five accepted publication records, Instagram observation evolution, YouTube measurement values, publication-to-observation durations, tenant-scoped organization identity, no detected attributable writes, model calls or provider calls (not repeated in the closure session); (b) Director signed-in visual acceptance of the complete output titled "Publication performance · Turkish Rug House", all values matching the accepted evidence; (c) measured in the closure session: deployment record and smoke `/` 200, `/login` 200, signed-out `/heby` 307
- Deferred risks: HOPR-1-ORG-LEGIBILITY-1 (CLOSED); HPC-1-PROD-EDGE-PATHS-1 (DEFERRED)
- Director approvals: release and production deployment of 637a14fa — given in the implementation session, not re-read here; the release and deployment themselves are measured above; production acceptance confirmed in chat 2026-10-16; preparation of this closure documentation 2026-10-16; one local documentation commit approved 2026-10-16; push of the documentation commit NOT yet approved

### Deferred risk detail

- **HOPR-1-ORG-LEGIBILITY-1 (CLOSED).** Registered by HEBY-OBSERVED-PERFORMANCE-READ-1: the answer did
  not name the organization it read. Resolved by this phase: the title names the organization from the
  Organization authority for the session's tenant, confirmed by the Director in production on
  2026-10-16.
- **HPC-1-PROD-EDGE-PATHS-1 (DEFERRED).** The unreadable-organization line, suppressed elapsed times,
  the different-instants notice, IG-AN3 gap notes and the no-evolution sentence are proven by local
  tests only. Acceptance dependency: a production read in which one of these conditions occurs.

**Still open from HOPR-1, unchanged:** HOPR-1-NOT-REPORTED-PATH-1 and HOPR-1-REVISION-BOUND-1 (both
DEFERRED; Turkish Rug House held 16 content revisions at HOPR-1 acceptance, not re-measured here).

**Existing limitations, not new risks.** YouTube has no released change derivation, so no YouTube
change is printed; YouTube counts come from measurements a person records, and the newest is from
2026-10-01 — the printed reading age makes that visible without a freshness policy. Hebun holds no
reach or impressions, so no rate is shown.

**Rollback.** Re-promoting `dpl_Ed1mtNRggLJk6uassJ976MPJm4Pu` (`b57aad84`, the HOPR-1 deployment) is
safe: no migration and no data written by this phase. `/performance` returns to the HOPR-1 output
(no organization name, no timing, no evolution). Unless `main` is also reverted, the next push
redeploys `637a14fa`.

**Weekly three.** *Learned:* legibility can be added without a judgement seam — name the scope, print
the spans between recorded instants, and reuse a released derivation instead of subtracting counts.
*Turkish Rug House:* the TRH team sees in one command which organization they are reading, how long
each post and video has been up when its counts were read, how old each reading is, and how each
Instagram post's likes and comments moved between the last two observations. *Hebun AI:* Heby's
performance view stays a read of Hebun's own records — no provider call, no model, no ranking — which
keeps any later measurement reasoning on verifiable ground.
