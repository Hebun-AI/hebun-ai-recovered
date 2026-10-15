# HEBY-CONVERSATION-CONTINUITY-1 · closure record · PRODUCTION-ACCEPTED

A person can now come back to their own Heby conversations. In `/heby` (the Command workspace) a
"Your conversations" list shows the conversations they started, newest activity first. They can open
one, switch between them, reload, and share a `?conversation=<id>` link that works only for them. A
foreign, unknown or malformed id renders one sentence: "That conversation is not available. It may
not exist, or it is not yours."

This phase adds no conversation authority. It extends the one HGC-1 left: the same
`conversations` / `messages` tables, the same `DurableConversationRepository`, and the same tenant AND
`created_by` predicate (Director decision A of HGC-1). It adds no table, no migration, no environment
variable, no provider reach, and no change to Knowledge, Governance or EAI. Conversation history is
not organizational Knowledge, and nothing here treats it as such.

## 1 · What was released

| Commit | Content |
|---|---|
| `94e9df0e` | `feat(heby): owner-scoped conversation list, switching and deep links`. 14 files, +882 / −26: 8 source (3 new), 2 new test files, 4 updated pins and test doubles. No migration, no schema file. |

On `main`: fast-forward `dba42fae → 94e9df0e`, pushed on 2026-10-15 at 17:17:00Z under the
Director's release approval.

| Part | Implementation | State |
|---|---|---|
| Owner list | `DurableConversationRepository.listOwnedConversations`: the same `requireTenant` / `requireActor` and tenant + `created_by` predicate as every other read; activity = newest message time; keyset cursor `<epoch µs>:<id>`; page 20, clamped 1–50; a malformed cursor is an empty page | IMPLEMENTED · VERIFIED · PRODUCTION-ACCEPTED |
| Server read and action | `heby-answer/list-conversations.server.ts` (`unauthorized` / `not-configured` / `unavailable` / `listed`) and `listHebyConversationsAction`; tenant and owner from the session, the client sends only a cursor | IMPLEMENTED · VERIFIED · PRODUCTION-ACCEPTED |
| Deep link | `/heby?conversation=<id>` is a lookup key. The page reads nothing; the conversation loads through the existing owner-checked `loadHebyConversationAction` | IMPLEMENTED · VERIFIED · PRODUCTION-ACCEPTED for the owner path |
| Switching | `use-heby-conversation.ts`: `selectConversation`, refused while a request or read is in flight; `createConversationSelectionGuard` so a late load or answer never overwrites a later selection; one pointer writer; the Full Workspace mirrors the selection into the URL with `replaceState` | IMPLEMENTED · VERIFIED · PRODUCTION-ACCEPTED |
| List UI | `heby-conversations.tsx`, the `HebyMyRequests` pattern: reading, empty, unreadable, "Show older", busy | IMPLEMENTED · VERIFIED · PRODUCTION-ACCEPTED |
| Message order | `listConversationMessages` orders by `created_at`, then question before answer, then `id` | IMPLEMENTED · VERIFIED · PRODUCTION-ACCEPTED |

**Why the order needed a tiebreak.** `persistExchange` writes a turn's question and answer in one
transaction, and `created_at DEFAULT now()` is the transaction's start. Measured on PostgreSQL 18: the
pair shares one `created_at` and one `xmin`. `created_at` alone therefore did not order a turn. Inside
one timestamp the question comes first, because the only production writer inserts exactly one
question and then one answer per transaction (`appendMessage` has no caller in `src`). `id` makes the
remainder deterministic. Production holds 77 such groups, every one exactly one question and one
answer.

## 2 · Verification (V2)

V2 was the Director's choice ("V2+ focused"). The full V3 suite was explicitly not approved. The
change adds a read on the conversation authority's own owner predicate and a client-side selection
rule. It changes no write path, no grant and no provider boundary.

| Item | Measured |
|---|---|
| Static checks | `tsc --noEmit` 0; scoped `eslint` 0; `git diff --check` clean |
| Build | `next build` (Turbopack) 0, 175 pages including `ƒ /heby` |
| Phase tests | `tests/heby-conversation-continuity-1/continuity-postgres.ts` (owner-only list, same-tenant and cross-tenant isolation, activity order, keyset pages including activity 400 µs apart, six malformed cursors and a foreign cursor, deep-link refusals identical, turn order, server-read states) and `selection-and-wiring.ts` (selection guard with out-of-order resolution, hook wiring, page and list boundaries, `"use server"` type-export guard): PASS |
| Bite-proofs | Reversing the question-first tiebreak fails the order assertion. Re-adding a bare `export type { X };` to `actions.ts` fails the module-load guard. |
| Related suites | 57 suites (r2d, kr5, h1, h1c, hw1, hw2, hw3, HGC-1 ×3, g6d, voice, s1 and 19 firewall suites that pin the changed files): 53 PASS. The 4 red files fail identically at `dba42fae` (same first error, same `actual`/`expected`): `g6d-flow/source-truth-consistency`, `kr5-flow/boundaries-and-firewall`, `wev1-work-evidence/evidence-firewall`, `int5b2-flow/pull-request-firewall`. Assertions after their first error are not compared. `int5b2-flow/bite-proofs` was not run (it rewrites source). |

**Local browser acceptance: 10 of 10 PASS.** It ran on a disposable PostgreSQL 18 database migrated
with the authored migrations, with `next dev` from the phase worktree under a clean environment
(model connectivity off, no provider, no primary `.env` file). Login used the local auth provider with
real scrypt credentials seeded through the repository's identity seed. User A (two conversations), User
B (a second member of A's tenant) and User C (another tenant). The conversations were written through
`persistExchange`.

1. A's list renders, newest activity first.
2. Both conversations open.
3. ALPHA → BETA → ALPHA keeps each transcript whole and in order.
4. Reload restores the selection.
5. An owner deep link opens.
6. B gets "not available" on A's link. A's stale pointer in a shared browser is cleared, not shown. B's list is empty.
7. C gets "not available" and lists only C's own conversation.
8. An unknown uuid, a malformed injection string and C's id each give the same sentence, and A's own pointer survives.
9. New conversation clears the view, the URL and the pointer, and the next question opens a new conversation.
10. With a 6 s delay injected on the request: a load overtaken by New conversation, and an answer overtaken by New conversation, do not reach the view. A control run with no interruption does show the late load. The answer is still recorded and listed.

**A defect found only in the browser.** The first browser run returned 500 on every `/heby` server
action, `askHebyAction` included. The cause was `export type { ListConversationsResult };` without a
`from` in the `"use server"` module. Next emitted it as a runtime export (`ReferenceError ... is not
defined`). `tsc`, `next build` and the focused tests all passed with it. The fix is the re-export with
its `from`, the pattern `request-lifecycle-actions.ts` already used. A guard over all six Heby
`"use server"` modules is in `selection-and-wiring.ts`.

**Next serializes server actions on the client.** A slow load cannot be overtaken by a later list
selection through the UI. The race exists only against client-only selections (New conversation), which
is what was measured. The guard also covers the rest.

## 3 · Production release and acceptance

Production reads used a read-only script outside the repository that imports only `pg`. The Neon pooler
refuses a startup `options` parameter (`08P01`). The script therefore runs `SET
default_transaction_read_only = on` (plus statement 30 s, lock 5 s and idle-in-transaction 120 s
timeouts), verifies the setting, opens `BEGIN TRANSACTION READ ONLY`, verifies that, and ends with
`ROLLBACK`. It prints counts and schema metadata only. Plan identifiers are redacted. It prints no
content, subject or credential.

| Gate | Time (UTC) | Measured |
|---|---|---|
| Readiness | 2026-10-15 | Production `dpl_Bav7RX2m…` at `dba42fae`. Neon PG 18.6, ledger 78 (equal to the repository; HCC-1 adds none). Every column the read needs is present. 70 conversations, 154 messages, 2 owners, at most 47 conversations per owner. 0 ownerless, 0 soft-deleted, 0 owners who are not users, 0 owners who are not tenant members, 0 cross-tenant messages, 0 cross-user messages, 0 empty conversations. 77 clean question/answer groups and 0 irregular ones. Indexes: only the two primary keys and `messages_id_tenant_uidx`. List query for the 47-conversation owner: 0.57 ms. |
| Release | 17:17:00Z | Fast-forward push `dba42fae..94e9df0e` to `main` as `hebuntech`, which holds push on `Hebun-AI/hebun-ai-recovered`; `main` is unprotected. No force. |
| Deploy | 17:17:05Z → Ready | `dpl_4XC5voVR9hhMwEf6HqPj2Wz5yHB4`, target production. `--meta githubCommitSha=94e9df0e…` returns only this deployment; `dba42fae` returns only `dpl_Bav7RX2m…`; a control SHA returns the unfiltered list. Aliases `www.hebuntech.com`, `hebuntech.com` and `hebun-ai-recovered.vercel.app`; `inspect www.hebuntech.com` and `inspect hebuntech.com` both resolve to it. |
| Smoke | after deploy | `/` 200, `hebuntech.com` 308 → www, `/login` 200. Signed-out `/heby` and `/heby?conversation=…` both 307 → `/login`. Runtime log: no 5xx, no error-level line, no `ReferenceError`. |
| Director acceptance | 17:24–17:26Z (signed-in log window) | The Director, signed in on `www.hebuntech.com`, reported: the history is visible, previous conversations open, switching works, reload restores the selection, and New conversation works. |
| After-probe | after acceptance | Deployment still Ready and both aliases unchanged. Conversations 70 → 70, messages 154 → 154 (no question was asked), 0 ownerless, 0 owner/tenant/membership inconsistencies, 0 cross-tenant and 0 cross-user messages, 77 clean groups. Ledger 78. Runtime log from 17:17Z: 10 `POST /heby` (the action module loaded in production, which is the defect class above), 0 5xx, 0 4xx, 0 `ReferenceError`. The 2 error-level lines are the pre-existing `pg` SSL-mode deprecation warning that HGC-1 also recorded. |

The HGC-1 guarantees were re-measured after acceptance: ownership columns, owner membership and
message authorship are as HGC-1 left them. No conversation became reachable by anyone but its owner.

## 4 · Not verified

- **No screenshot of production.** The acceptance is the Director's report. The screenshots taken in
  this phase are of the local browser acceptance.
- **Negative paths in production.** A second member, another tenant, a foreign or malformed deep link,
  pagination past 20 and the late-response guard were measured locally only. Production has one owner
  per tenant (HGC-1-SECOND-MEMBER-PROD-1 applies unchanged). The largest owner holds 47 conversations;
  the Director did not report using "Show older".
- **Assertions behind the first error** of the 4 pre-existing red suites.

## Closure Contract (v1)

- Phase: HEBY-CONVERSATION-CONTINUITY-1
- Owner: apps/dashboard/src/features/heby-conversation/durable-conversation-repository.server.ts (conversation authority, `listOwnedConversations`) with heby-answer/list-conversations.server.ts (authenticated read), app/(dashboard)/heby/actions.ts and page.tsx, and components/layout/heby (use-heby-conversation.ts, heby-conversations.tsx, heby-conversation-selection.ts); HGC-1 ownership, Knowledge, Governance and EAI unchanged
- Reached state: PRODUCTION-ACCEPTED
- Implementation commit: 94e9df0eecccf54267c7d18f4fd20d1eb1ab29c4 — released on `main` (fast-forward from dba42fae)
- Verification level: V2 — a new read on the existing conversation authority's owner predicate plus a client selection rule; no write path, grant or provider boundary changed; the Director chose V2+ focused and did not approve the full V3 suite
- Verification evidence: tsc 0, eslint 0, git diff --check clean, next build (Turbopack) 0; tests/heby-conversation-continuity-1 (2 files) PASS with two bite-proofs; 57 related suites, 53 PASS, 4 red identically at dba42fae; local browser acceptance 10/10 PASS (section 2)
- Test environment: worktree `.claude/worktrees/heby-conversation-continuity-1` at 94e9df0e (node_modules as an APFS clone, because Turbopack refuses a symlinked node_modules); macOS (Darwin 25.2.0); tsx; PostgreSQL 18.0 at localhost:5432 as superuser `postgres` via HEBUN_TEST_ADMIN_DATABASE_URL; browser acceptance on `next dev` at localhost:3100 against a disposable database, local auth, model connectivity off; no provider
- Deployment evidence: dpl_4XC5voVR9hhMwEf6HqPj2Wz5yHB4 READY production at 94e9df0e (githubCommitSha via --meta filter with control SHAs), aliases www.hebuntech.com, hebuntech.com and hebun-ai-recovered.vercel.app, created 2026-10-15T17:17:05Z
- Production acceptance evidence: section 3 — read-only readiness (ledger 78, 70 conversations, 154 messages, 0 ownerless or inconsistent rows, 77 clean turn groups, list query 0.57 ms); Director-reported signed-in acceptance on www.hebuntech.com (list, open, switch, reload, new conversation); after-probe with counts unchanged (70/154), 0 inconsistencies, 10 production `POST /heby` with 0 5xx and 0 ReferenceError
- Deferred risks: HCC-1-LIST-INDEX-1 (DEFERRED); HCC-1-SAME-INSTANT-TURNS-1 (DEFERRED); HCC-1-SOFT-NAV-DEEP-LINK-1 (DEFERRED); HCC-1-PROD-NEGATIVE-PATHS-1 (DEFERRED)
- Director approvals: conditional implementation approval at V2+ focused, full V3 not approved, no schema (2026-10-15); local browser acceptance on an isolated database (2026-10-15); one implementation commit 94e9df0e (2026-10-15); read-only production readiness (2026-10-15); production release, with the push performed by Claude Code under that approval (2026-10-15); signed-in production acceptance reported by the Director, and closure documentation (2026-10-15); documentation commit NOT yet approved

### Deferred risk detail

- **HCC-1-LIST-INDEX-1 (DEFERRED).** Neither `conversations(tenant_id, created_by)` nor
  `messages(conversation_id)` is indexed. Every list page scans the tenant's messages and aggregates the
  owner's conversations. It takes 0.57 ms at 154 messages, and about 2 ms at 20,000 locally. An index
  is a schema decision when a tenant's volume makes the scan material.
- **HCC-1-SAME-INSTANT-TURNS-1 (DEFERRED).** Two turns written into one conversation by transactions
  that start in the same microsecond (two tabs at once) share a `created_at`. The order stays
  deterministic, but the two question/answer pairs can interleave. Production has 0 such groups.
  Removing the case needs a sequence column, which is a schema decision.
- **HCC-1-SOFT-NAV-DEEP-LINK-1 (DEFERRED).** Suppose `/heby?conversation=X` was loaded and New
  conversation cleared it. A client-side navigation back to the same `?conversation=X` does not reload
  it, because the server prop is unchanged and the effect does not re-run. A full load, reload, or list
  selection is unaffected. The app has no such link today. Separately, a restore from the pointer does
  not write `?conversation=` into the URL; this is cosmetic.
- **HCC-1-PROD-NEGATIVE-PATHS-1 (DEFERRED).** The refusal paths (another member, another tenant,
  foreign or malformed deep link), pagination past one page and the late-response guard are proven
  locally and in the browser on a disposable database, not in production. They need a second production
  account, or an owner with more than 20 conversations.

**Rollback.** Re-promoting `dpl_Bav7RX2m…` (`dba42fae`) is safe and security-equivalent: no migration,
no data written by this phase, and the ownership rule is unchanged. Only the list, the switch and the
deep link disappear. Unless `main` is also reverted, the next push redeploys HCC-1.

**Weekly three.** *Learned:* a green type check and build do not prove a `"use server"` module loads.
Only a signed-in request in a real browser exercised it, and it failed on one line. *Turkish Rug House:*
the people working on TRH can come back to an earlier Heby thread instead of starting over, and only
they can. *Hebun AI:* Heby becomes a workspace with memory of its own conversations, on the same
authority, without a second store.
