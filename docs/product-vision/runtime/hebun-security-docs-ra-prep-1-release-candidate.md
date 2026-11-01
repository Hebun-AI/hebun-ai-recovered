# Release candidate — Security Strategy + RA-PREP-1 · NOT RELEASED

Prepared 2026-10-29 ("CONTROLLED RELEASE CANDIDATE — Security Strategy + RA-PREP-1"). **Nothing was
pushed or deployed.** Pushing `main` starts a Vercel production deployment (no `ignoreCommand`;
`learnings.md`, 2026-09), so the push is the release and stays a Director gate.

## Candidate

| | |
|---|---|
| Base | remote `main` `03817c82` (read at preparation; re-read before any push) |
| Branch | `release/security-docs-ra-prep-1` |
| Integration | fast-forward of `docs/security-strategy` (`28a0f116`, `79de68b6`), then a `--no-ff` merge of `feat/ra-prep-1` (`a12f770f`, `ccb2c35f`, `0e418175`, `0ebda5e3`) as `4821ee89`; `docs/MASTER-ROADMAP.md` auto-merged with no conflict and no line of either side lost; this record is the commit after it |
| Push shape | fast-forward of `main` from `03817c82`; no force |
| Files | 31 vs `03817c82`: 2 Security Strategy docs; RA-PREP-1's 9 source, 18 test and 3 doc files (seam, research writer, research audit sibling, gateway purpose option, capability declaration, UI label, censuses, RA-PREP-1 tests, closure, roadmap, learnings) |

## Impact

| Area | Impact |
|---|---|
| Migration | None — 0 files under `src/db`; ledger stays 83 |
| Routes / actions / crons / config | None changed; `vercel.json` untouched |
| Runtime reach | The research seam has no importer: no route, server action, component, cron, dynamic import or id-based dispatch reaches it (re-checked on the candidate); unreachable in production |
| Authorization | Research writer = the one way to create `research-report`; every reviser refuses it under the artifact lock; mandate revision re-read in the filing transaction; Governance re-asked before filing; no Governance, mandate or tenant-authorization data changed |
| Provider | No new transport; research uses the existing gateway; nothing can call it; GATE-D-PROVIDER-RECONCILIATION-1 BLOCKED |
| Client bundle | The only research-related client text is the capability contract's `performedBy` / label strings (client-safe, already bundled); no server module, no secret-shaped string in `.next/static` |
| Docs | §13.4 Security added (planned, not a product line, no Security authority); RA-AUTH-1 / RA-EAI-1 / RA-PREP-1 states unchanged |

## Evidence — run on this candidate (`4821ee89`) on 2026-10-29

| Check | Result |
|---|---|
| `tsc --noEmit` | 0 |
| `eslint` on every changed `.ts`/`.tsx` | 0 errors, 1 pre-existing warning (sci1 import) |
| `git diff --check` `03817c82..HEAD` | clean |
| Continuity closure-contract | PASS |
| 16 firewall / census suites (ra-prep-1, ra-auth-1, ra-eai-1, b2, eai-1a, g1, g2, k2, sci1, ama1, ama2, ap4b, aor-1b, agent-runtime-0, r3w, agent-execution-1) | PASS |
| 10 Postgres suites incl. ra-prep-1 R1–R9 | PASS (session C-locale cluster, sysid 7702145825560023165) |
| Full suite, disposable detached copy, C-locale cluster | **1123/1124**, tree unchanged; ra-prep-1 bite-proofs PASS (11/11) inside it; k2 create-and-read and plan-step-idempotency-1 bite-proofs PASS this run |
| r3w-flow/ambient-database-safety | BLOCKED in the suite (no 55432); **PASS against a session-owned stand-in** `hebun_r1` on 55432 (83 migrations, sysid 7702154981041161945) — not the developer's real canonical |
| `next build` | exit 0 |

## Security notes

- **Mandate provenance** is recorded on the filing transaction and joins to one immutable revision and its
  Governance decision. **TOCTOU:** the filing transaction is READ COMMITTED and the mandate read takes no
  lock; a revision committed in the milliseconds between that read and COMMIT is not seen. The outcome is
  equivalent to the filing being ordered before that revision, and the row names the revision read. That
  is the guarantee — not "no filing after a withdrawal's wall-clock time".
- **Concurrent dispatch** (RA-PREP-1-CONCURRENT-DISPATCH-1) stays DEFERRED: no exposure without a surface;
  the persistent dispatch cap holds under the race.
- **Research data use** does not cover Security Cloud (strategy §7); a tenant's research grant is checked
  separately and none exists in production as last measured (RA-EAI-1 release; not re-measured here).

## Deployment risk and rollback

Risk: low — no migration, no reachable new path, behaviour change limited to (a) human and agent revise
refusing `research-report` (no such row exists) and (b) the gateway accepting a server-only `research`
purpose that only the unreachable seam sets. Rollback: Vercel instant rollback to the previous production
deployment, or a revert commit of the merge pushed through the same gate; no data to undo.

## Release gate (Director)

Open at freeze: **local disk 9.65 GiB, below the 10 GiB working minimum** (other processes consumed space
during preparation; not measured). The candidate itself is verified. Before a push: re-read remote `main`,
prove fast-forward, push without force, then verify the deployment record (READY, `githubCommitSha`,
aliases) and an anonymous runtime read — push success is not deployment success.

## Superseded base — integration 2026-11-01

The tables above describe `4821ee89` on `03817c82` and stand as that candidate's record. The base moved:
the candidate is now merge `265d6afd` on `5c6a1674`, branch `release/ra-prep-1-integration`. **Nothing was
pushed or deployed.** Evidence and what is still unrun: `hebun-ra-prep-1-closure.md`, *Integration onto
current main*. The push shape stays a fast-forward of `main`, now from `5c6a1674`. The disk gate is
BLOCKED at this writing, so the release gate above stays open.
