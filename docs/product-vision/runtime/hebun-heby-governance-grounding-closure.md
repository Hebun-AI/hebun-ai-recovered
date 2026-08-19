# Heby Governance Grounding — Closure (G6C)

**Status:** RELEASED. **Zero schema, zero migration, zero production row.**
**Suite:** 416 passed, 0 failed. Lint 0 errors (14 pre-existing warnings, untouched), typecheck clean, build clean, `git diff --check` clean, secret scan clean.
**Production:** Governance state **NOT MUTATED** — every watched count byte-identical to the G6B post-state.
**Provider:** DISARMED. **Model synthesis:** UNAVAILABLE.

**Classification: B — GROUNDING CONNECTED / MODEL SYNTHESIS UNAVAILABLE.**

G6A established the government. G6B proved it governs. G6C lets Heby *read* it — and proves it can never *exercise* it.

---

## What shipped

Two things, and only two.

1. **A boundary extraction inside Governance.** Authority *resolution* moved out of the writer-bearing modules into read-only ones. `bootstrap-authority.server.ts` shrank by 104 lines and `decision-authority.server.ts` by 268; `authority-read.server.ts` (358) and `persistence.server.ts` (77) now own the reads and the shared persistence helpers. `role-baseline-read.server.ts` (62) does the same for I1.1. **No behaviour moved with them** — `resolveGovernanceAuthority` is still defined exactly once in the entire repository, relocated and never copied, which three released firewalls re-assert at its new home.

2. **A read-only Governance grounding boundary.** `governance-grounding/heby-governance-source.server.ts` (239) projects the roster, the genesis decision and the role baseline into the shape Heby's deterministic evidence layer already consumes. Heby's answer path substitutes it for the pure resolver's `governance` source class, exactly as K1, R3W and R3R already do for Knowledge, prepared work and recorded recipients. This is the fourth instance of that seam, not a new one.

43 files modified, 6 new. No migration. No `.sql`. No drizzle snapshot.

## Governance remains the authority owner

The projection lives on **Governance's** side of the boundary, not Heby's. The first draft lived under `heby-governance/` and five released firewalls — G2, G3, I1.1, K4, stranded-enrollment — rejected it, correctly: those modules **mix reads and writes**, so a Heby file importing `bootstrap-authority.server.ts` for `readGovernanceAuthority` holds a reference into the module that also exports `establishGovernanceAuthority`.

The fix was to make the mixing stop, not to work around the firewalls. Governance may read its own owners freely; Heby consumes the projection. Heby's import surface is now a module containing **zero** writers instead of one containing the constitution's.

Heby owns no Governance fact, holds no Governance table, and defines no authority. It reads three owners and reinterprets none of them.

## No Governance writer is reachable from Heby

Proved structurally, not by filename.

`tests/g6c-flow/authority-reachability.ts` walks the **real import graph** from Heby's two server entry points and inspects every module it reaches for the definition of any of 14 mutating acts (`establishGovernanceAuthority`, `recordGovernanceDecision`, `writeGovernanceDecisionWithin`, `delegateGovernanceAuthority`, `revokeGovernanceAuthority`, `provisionMemberRole`, `authorizeMembership`, `issueInvitation`, `revokeInvitation`, `decideIdentityEnrollment`, `ratifyKnowledgeVersion`, `rejectKnowledgeVersion`, `consumeActionPermit`, `executeAuthorizedAction`).

Measured independently of the suite, against both the released tree and the pre-G6C commit:

| Entry point | before (`b4d94ce`) | after |
|---|---|---|
| `heby-answer/model-answer.server.ts` | graph 587, **writer-bearing 1** | graph 591, **writer-bearing 0** |
| `heby-commands/read-commands.server.ts` | graph 600, writer-bearing 0 | graph 600, **writer-bearing 0** |

The test cannot be satisfied by renaming a file, and it fails loudly if a banned symbol is renamed or deleted rather than silently emptying its own ban list.

## R3W's pre-existing mixed-module reachability was eliminated by the same extraction

That single `1` above is not new damage found and papered over — it is **R3W's**, released and undetected since then.

`work-artifacts/work-artifact-evidence.server.ts` imported `bootstrap-authority.server.ts` *for a database handle*. That module also exports `establishGovernanceAuthority`. Heby's answer path therefore had the act that creates a government in its module graph, and **every path-based firewall passed**, because the offending file's path says `work-artifacts`.

The path heuristic failed in both directions: too weak there, and too strong elsewhere — a file whose *comment* named a writer in order to promise it was not imported tripped two firewalls while importing nothing.

Splitting persistence out of `bootstrap-authority.server.ts` removed the reachability without touching R3W's behaviour: the handle now comes from `persistence.server.ts`, which defines no act at all. The path heuristics in g2/g3/k4 remain, narrowed to match **writer symbols against comment-stripped code**. Two independent mechanisms — one structural, one lexical — where there was previously one, and it was wrong.

One unrelated defect was repaired in passing: I1.2's ordering assertion used a module-wide `indexOf`, which measured the order of the *import block* rather than of execution and would flip if an import statement were split in two. It is now scoped to the function body.

## Governance grounding is authoritative end to end

Every other connected Heby source declares `authoritative: false`, because each reads a derived model or an unverified record. `decision_records` **is** the organizational record; a tenant's authority is not a summary of something else. The projection declares `authoritative: true` and the response builder now reports what the resolved sources actually are, per answer:

- all authoritative → *"Read from authoritative organizational records."*
- none authoritative → the previous derived/non-authoritative wording, unchanged.
- mixed → said explicitly, with provenance stated per source.

Before G6C the builder stated "derived and non-authoritative" **unconditionally**, which would have flattened AUTHORITATIVE into DERIVED the moment this source connected — the one distinction Heby must never collapse.

A read failure degrades to the pure resolution. It never fabricates an authority, and it never removes another source's evidence.

## G2 mock gating remains intact

Untouched and still passing. The mock gate withholds the mock organizational surfaces from an authenticated real tenant exactly as released. G6C connected an authoritative Governance read; it did not widen, weaken or route around the gate that withholds mock data.

## Production Governance state was not mutated

Read-only verification against the production Neon target (`neondb`, `system_identifier` 7675444875863894887), 57 base tables:

`roles` **2** · `decision_records` **2** · `governance_sessions` **2** · `audit_log` **3** · `memberships` **1** · `users` **1** · `companies` **1**

`permissions` 0 · `role_permissions` 0 · `invitations` 0 · `providers` 0 · `provider_connectivity_controls` 0 · `executions` 0 · `action_permits` 0 · `action_execution_attempts` 0 · `knowledge_nodes` 0 · `knowledge_facts` 0 · `knowledge_edges` 0

Every count is **identical to the G6B post-state**. G6C wrote nothing to production. No ceremony was run, no entitlement spent, no decision recorded.

## Provider remains disarmed

`providers` 0 and `provider_connectivity_controls` 0 in production. R5.1's firewall holds: no file in `src/` writes the provider control table, and `setDirectorEnabled` is deliberately excluded from the reachability ban list precisely because the *capability* was removed rather than the caller. Nothing in G6C created a write path.

## Model synthesis remains unavailable

Production carries six environment variables — `HEBUN_AUTH_ENABLED`, `HEBUN_AUTH_PROVIDER`, `HEBUN_AUTH_SESSION_DIGEST_SECRET`, `HEBUN_AUTH_SESSION_DIGEST_CURRENT_VERSION`, `DATABASE_URL`, `HEBUN_CONTROL_PLANE_ALLOW_REMOTE`. **No `HEBUN_MODEL_*`, no provider credential.** Heby's answers are deterministic (`modelUsed: false`) and every one of them carries the standing model limitation.

Grounding is connected. Synthesis is not. That is the classification, and it is a configuration fact, not a code gap.

## Inherited limitation, recorded and NOT redesigned

**A tenant member who is not a Governance authority can still read the authority roster and the genesis decision.**

Of the three read owners, only `readRoleBaselineState` gates itself on `resolveGovernanceAuthority`. `readAuthorityRoster` and `readGovernanceAuthority` are tenant-scoped but not authority-gated — that is the **released** G2/G3 read contract, and it predates this gate.

The grounding projection adds no gate of its own and removes none. Tightening it would be a change to Governance's own read contract affecting the `/governance/authority` surface as well, and it is not something to slip in under a Heby grounding phase. **Recorded as inherited, open, and deliberately untouched.**

## What still does not exist

No delegated authority. No second human, membership, invitation or authorization. No Knowledge, therefore no ratification and no ordinary `ratify`/`reject` decision. No permission, no role hierarchy. No provider, execution or Computer Use. No model synthesis in production. The `member` role exists and confers nothing.

Heby can now say what this organization's Governance record *is*. It still cannot change one word of it.
