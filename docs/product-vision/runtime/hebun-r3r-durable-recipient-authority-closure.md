# R3R — Durable Recipient Authority

**Baseline at start:** HEAD `80f7e06` = real `origin/main`, 0 ahead / 0 behind, 27 repo migrations = 27 applied to `hebun_r1`, `work_artifacts` 0, `work_artifact_revisions` 0, `heby_action_requests` 0, `action_permits` 0, `plpgsql` only, 376 tests.

**At close:** 28 repo migrations, canonical still at **27** (the R3R migration is deliberately unapplied), 379 tests, `npm run verify` exit 0.

---

## 1. The one fact this phase adds

> **This tenant recorded one way to reach someone outside the organization.**

`recipientRef` had no referent. R3W gave `draftRef` one — an exact artifact revision — and `/send` still could not be honestly proposed, because the other half of the argument named nothing. Gate A measured the gap rather than assuming it: across 55 canonical tables there are **three** address columns and all three are email, there is not one phone or handle column anywhere, and the only party-shaped table name in the schema is `organizations`, whose own header calls it *"sub-structure under a company (tenant-owned)"*.

    RECIPIENT ≠ USER ≠ MEMBER ≠ TENANT ≠ ORGANIZATION ≠ KNOWLEDGE ≠ DECISION ≠ PERMIT ≠ EXECUTION

## 2. Authority ownership

One table, `external_recipients`, owned by one writer, `write-external-recipients.server.ts`. A structural test walks every file under `src/` and asserts that exactly one module inserts or updates the table.

## 3. `users` rejected — structurally, not stylistically

- `users` uses `rootColumns`: it has **no `tenant_id` column at all**.
- `users_email_uq` is `UNIQUE (email)`, **global**. One customer address could exist exactly once across the whole installation, so two tenants could never both hold the same customer. That alone is fatal.
- Six foreign keys target `users`; three make a row an authenticatable principal (`auth_identities`, `user_session_contexts`, `memberships`), and the schema states that a human actor resolves as `(actorType="human", actorId=users.id)`.

Recording a customer must never mint a login. The firewall test asserts R3R imports no user, membership, invitation, auth or enrollment module, and the PostgreSQL suite counts nine identity tables before and after a create and requires them **unchanged**.

## 4. `companies` / `organizations` rejected

`companies` **is** the tenant root — `plan`, `tenant_status`, `authentication_disabled_at`, `deleting_at`. Modelling Globex there makes Globex a tenant, with a billing plan and its own user population. `organizations` and `departments` are internal structure beneath a company; using either would declare an outside company part of this tenant's own hierarchy.

## 5. Identity / membership rejected

`invitations`, `membership_authorizations`, `identity_enrollment_requests` and `memberships` all model **joining Hebun**, and their columns say so: `token_hash`, `expires_at`, `intended_role_id`, `accepted_by_user_id`, `governance_decision_id`, `enrolled_auth_identity_id`, `authority_scope`. An external party has no role, no token, no enrollment and no authority.

One thing was taken from them: `invitations_pending_email_uq` is `UNIQUE (tenant_id, normalized_email) WHERE status = 'pending'`. That is the right **shape** for tenant-scoped address uniqueness — wrong semantics, right precedent.

## 6. CRM firewall

Excluded, and none of them has a consumer, a writer or an authority that could establish it: sales pipeline, opportunity stage, deal value, activity timeline, notes, lead scoring, campaigns, segmentation, marketing automation, lifetime value, forecasting, owner assignment, CRM dashboards, funnel analytics.

Two nearly survived and were cut on the same test — neither changes delivery, binding or authority:

- **`party_kind`** (person vs organization): `display_name` already tells a human which.
- **`organization_label`**: `display_name` already carries "Ayşe Yılmaz (Globex)".

A firewall test asserts none of these words names a value in R3R code or a column in the table.

## 7. One table, not two

Gate A expected to mirror `work_artifacts` / `work_artifact_revisions` and concluded the opposite. **The revision table exists because an artifact's content is edited repeatedly and its history matters. An address is never edited — it is replaced.** Immutable rows give the same "approved bytes cannot drift" guarantee with one less table, and grouping several addresses under one person is not a proven requirement: the only consumer takes exactly one recipient.

Jane with two emails is two rows both named "Jane Smith", and Hebun makes **no claim they are the same person** — which is the posture §11 requires anyway.

## 8. Immutable endpoint

`endpoint_kind`, `endpoint_value` and `endpoint_digest` are written once and never updated. "Changing Jane's email" is **retire + create**, never `UPDATE`.

The guarantee is enforced two ways. The writer has no update path for those columns; and a structural test parses every `.set({…})` in every file that references the table and asserts none of the three appears inside one. A mutable address column would silently re-point every approved-but-unspent permit — precisely the drift R3W was built to stop.

Because the bytes cannot move, **editing a recipient after a permit exists is not expressible**. That is why no second approval system was added inside recipient management.

## 9. SHA-256 endpoint digest

`endpoint_digest = SHA-256(normalized endpoint value)`, lowercase 64-hex, enforced by a database `CHECK`.

Deliberately a separate module from `digestArtifactContent`: that one hashes bytes **verbatim** and says so, while an endpoint digest covers the **normalized** form, because ` Jane@Example.COM ` and `jane@example.com` are the same mailbox and must not produce two approvals. Two different questions, two functions.

It is evidence of bytes. It is not verification, deliverability, ownership or trust.

## 10. Tenant uniqueness

```sql
UNIQUE (tenant_id, endpoint_value) WHERE status = 'active'
```

Proven in raw PostgreSQL on a disposable database, with no application layer involved:

| Case | Result |
|---|---|
| `jane@example.com` in tenant A, then tenant B | **allowed** — required, and what the global `users_email_uq` makes impossible |
| the same live address twice in tenant A | **refused by the database** |
| retire, then record the same address again | **allowed** — retired rows leave the predicate |
| malformed `endpoint_digest` | **refused by CHECK** |
| blank `display_name` | **refused by CHECK** |

One live address maps to one record, so an approval surface can never be ambiguous about which record the Director approved.

## 11. Normalization

`trim().toLowerCase()`, a 320-character bound, and the same shape gate the repository already uses (`^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$`). Reproduced from `normalizeTargetEmail` rather than imported, because that function lives in a server module carrying the database client and extracting it would edit membership authority — another closed phase's authoritative writer — for this phase's convenience.

Reproduction is only defensible if the two provably agree, so a test asserts **parity over a 21-value corpus** rather than a comment claiming it.

Deliberately not aggressive: no dot-stripping, no `+tag` removal, no punycode folding, no MX lookup. `jane+work@example.com` really can be a different mailbox, and folding them would silently merge two recipients — an identity claim this domain refuses to make.

## 12. Human-only creation

`createdByType` is a **hard-coded literal** `"human"` in the writer. Not a parameter, not an input field, and there is no second entry point that could pass `"agent"`.

R3W deliberately **does** have an agent authoring path (`createWorkArtifactFromHebyPreparation`), and the asymmetry is the point: an artifact is inert text the tenant already owns; an address is a claim about a real person who becomes the target of an irreversible act. If a model could mint `jane@exmaple.com` from prose, a human would approve a send to an address the model invented. A test pins that R3W has the agent path and R3R has none, so a future "consistency" refactor cannot quietly grant it.

## 13. Heby boundary

Heby may **resolve** recipients and may not create them. For *"Send this to Jane at jane@example.com"* with no recipient recorded, the action fails on the missing referent — the behaviour R3W's `record-ref` repair already established, where a supplied `record-ref` that resolves to nothing makes a consequential action FAIL rather than await review.

`send-external-communication` still declares `recipientRef` as a **`record-ref`**, never a string address, so a model structurally cannot name a destination.

## 14. No real-world identity claim

No entity resolution, no merge, no `merged_into`, no fuzzy matching, no person graph. Two rows with the same display name are two records. One address shared by several people is one record — Hebun records the address, not the people behind it.

## 15. Verification semantics

**No email verification system exists anywhere in this repository.** So there is no `verified` column, no `verified_at`, no badge, and no string claiming an address is confirmed or deliverable. The provenance line reads:

> "Recorded recipients — addresses your organization entered. Durable and tenant-scoped, never verified and never authoritative (`authoritative: false`)."

The firewall test asserts **claims, not vocabulary**: identifiers are checked with string literals removed, affirmative claims (`is verified`, `verified recipient`, `confirmed address`) are banned, and the honest denial "never verified" is *required* to be present. Banning the literal would have failed on exactly the sentence worth keeping — the brittleness `3e654f5` already warned about.

## 16. Lifecycle

`active | retired`. `invalid` was proposed at Gate A and dropped: **no writer could establish it.** There is no bounce handling, no delivery receipt and no verification, so `invalid` could only ever be a guess. Also absent: `verified`, `qualified`, `customer`, `lead`, `converted`, `engaged`.

## 17. Record-ref and source class

- Format `external-recipient/<uuid>`. **No `@n` suffix** — the rows are immutable, so the id already names exact bytes.
- Anchored, lowercase-only parser that fails closed. Twelve hostile spellings are pinned as non-parsing, including a trailing space, an uppercase uuid, a trailing slash and a borrowed `work-artifact/` prefix. One spelling per recipient, or nothing — otherwise one row carries several independent approvals.
- New source class `external-recipients`, tenth in the vocabulary. Pure resolver reports honest `unavailable`; the server seam supplies the tenant-scoped read. Exactly the K1/R3W arrangement.
- **Only active recipients are proposable**; a retired one stays resolvable forever so a permit or audit entry naming it never becomes a dangling pointer.

## 18. Privacy boundary

What makes this different from a work artifact: an artifact is the tenant's own text; a recipient is **personal data about a third party who never consented to Hebun**.

- The address is **not** placed in `ResolvedSourceItem.content`, which is what travels into the model provider's context. Heby proposes a reference; it never needs the address. The human approving the send gets it from a server-side resolve at the approval surface. A test asserts the evidence item carries no address.
- R3R logs nothing — no `console.*` anywhere in the domain.
- No credential, token, provider id or external system key.

**Known limitation, stated rather than solved: retirement does not erase the stored address.** The row survives so history resolves. A real erasure/deletion policy is separate, unbuilt work.

## 19. Knowledge / Memory firewall

R3R imports no Knowledge or Memory module and writes none of `knowledge_nodes`, `knowledge_facts`, `knowledge_edges`, `enterprise_memory_records`, `memories`, `working_memories`, `learning_sessions`. A recorded address is **operational directory data, not organizational truth**. Every resolution pins `authoritative: false`.

## 20. Governance firewall

Recording an address is not approving a send. R3R writes no `decision_records`, no `governance_sessions`, no `action_permits`, and imports no Governance writer, no `recordActionRequest`, no `approveActionRequest` and no `consumeActionPermit`. Governance stays at the consequential-action boundary.

## 21. Action binding — R3A unchanged

`CanonicalPayload` is `Record<string, string | number | boolean>` with sorted keys and one SHA-256. The four values are ordinary scalars, so **R3A needed no change**:

```
{ recipientRef, recipientEndpointDigest, draftRef, draftRevisionDigest }
```

Proven: the binding is deterministic; key order does not change it; and each of the four halves moves it independently — a different recipient, a different address, a different draft revision and a swapped draft digest all produce different digests. The address case is the Day-1/Day-2 scenario, and it fails to match exactly as it must.

## 22. Retired-recipient semantics, and what R3B must do

- **E1 active** → proposal eligible, offered as evidence.
- **E1 retired** → still resolvable by reference; **not** offered as evidence; no new proposal can name it.
- **A permit already bound to a retired E1 must refuse at execution.** The digest still matches — the bytes never moved — so the digest alone cannot catch it. That status check is **R3B's**, at consumption time. `consumeActionPermit` is deliberately **not** wired in R3R.

## 23. UI owner

The Operations workspace, which already owns R3W for the same reason: both action tools that could name either referent — `heby.operations.prepare-plan` and `heby.operations.send-communication` — declare `ownerWorkspace: "operations"`. No new workspace, no new navigation, no CRM dashboard. Five thin server actions: create, retire, list active, list retired, resolve. Following R3W's precedent exactly, no UI component was added.

## 24. Migration

`20260816105458_r3r_durable_recipient_authority.sql` — additive only: 2 `CREATE TYPE`, 1 `CREATE TABLE`, 1 `ALTER TABLE … ADD CONSTRAINT` (tenant FK to `companies`), 2 `CREATE UNIQUE INDEX`, 1 `CREATE INDEX`. The only table named is `external_recipients`; the only other identifier is `companies`, as the FK target.

The recurring drizzle-kit ordering defect (KR5, R3A, R3W) **did not recur here**: nothing yet references `external_recipients(tenant_id, id)`, so no composite foreign key needs an index that does not exist yet. Verified by applying the full 28-migration chain on a disposable database.

No extension, no vector/search, no secrets, and no change to `users`, `memberships`, `companies`, `organizations`, Knowledge, Governance, R3A, R3W, `documents`, `workflows`, execution or Memory.

**NOT applied to canonical.** `hebun_r1` stands at 27 applied migrations with no `external_recipients` table and no `external_recipient_*` enums. That is a separate Director-gated ceremony.

## 25. Tests

| File | Proves |
|---|---|
| `tests/r3r-flow/recipients-postgres.ts` | durable tenant-scoped create; same address legal in two tenants; duplicate live address refused; tenant isolation on every read; foreign and fabricated refs reveal nothing; address bytes unchanged by retirement; double-retire refused; retired still resolvable, not proposable; re-record after retirement; source class shape; reconnect durability; unauthenticated and unpersisted refusals; **nine identity tables unchanged**; fifteen Knowledge / Memory / Governance / permit / execution tables at zero |
| `tests/r3r-flow/boundaries-and-firewall.ts` | auth/user firewall; Knowledge and Memory firewall; Governance, permit, execution, network and credential firewall; **no update path for address bytes anywhere in `src/`**; exactly one writer; human-only creation and the deliberate R3W asymmetry; no verification claim; closed vocabulary; source class registered and pure resolver honest; registry not loosened; privacy boundary |
| `tests/r3r-flow/ref-normalization-and-binding.ts` | one spelling per recipient (12 hostile forms refused); **normalization parity with `normalizeTargetEmail` over a 21-value corpus**; digest determinism and exactness; validation refuses shape not meaning; exact four-way action binding through R3A's unchanged payload |

Disposable PostgreSQL throughout. No live LLM, no network.

## 26. Record integrity — a stale claim repaired

R3W shipped `RECIPIENT_SUBSTRATE_GAP`, whose statement read *"no recipient authority exists in Hebun"*, and a test asserted that sentence. R3R makes it false.

Both were repaired rather than deleted: the constant now states what is actually still open, and the test asserts the old sentence is **gone** and the new one is present. A green test asserting "no recipient authority exists" would have been green *because* a stale claim survived — the failure this repository already learned once when the R3W canonical migration turned R3W's own regression red.

What remains open is precise: `send-external-communication` declares only `recipientRef` and `draftRef`, so **neither digest is a declared argument yet**. Until the registry carries `draftRevisionDigest` and `recipientEndpointDigest`, an approval binds two moving targets. Owner: **R3A.1**.

## 27. Verification

| Stage | Result |
|---|---|
| lint | PASS — 0 errors, 14 warnings |
| typecheck | PASS |
| tests | **379 passed, 0 failed, 379 total** (376 → 379) |
| build | PASS |
| `npm run verify` | **exit 0** |
| `git diff --check` | clean |
| leaked disposable databases | 0 |

## 28. Canonical firewall

Before and after are identical: **27 applied migrations**, `external_recipients` absent, `external_recipient_*` enums absent, `work_artifacts` 0, `work_artifact_revisions` 0, `heby_action_requests` 0, `action_permits` 0, `executions` 0, knowledge 1/1, `decision_records` 8, `governance_sessions` 8, `audit_log` 17, conversations 34 / messages 124, `users` 3, `memberships` 3, `plpgsql` only. No synthetic recipient exists in canonical.

## 29. Product truth

- **A recipient reference is real.** `/send` can now name a durable recipient and an exact address.
- **Nothing has been sent.** `substrateConnected` is still `false` for `send-external-communication`.
- **No address is verified.** Recorded ≠ verified ≠ deliverable.
- **Zero recipients exist.** The table is empty everywhere; no seed, no fixture in canonical.

## 30. Limitations

1. **Email only.** One endpoint kind, because it is the only address shape with evidence behind it. A second channel arrives with the consumer that needs it, through its own migration and its own validator.
2. **One address per record.** A person with two addresses is two records, and Hebun does not claim they are the same person.
3. **No erasure.** Retirement keeps the stored address. A deletion/retention policy is separate work.
4. **No import.** Manual human entry only; there is therefore no `source` column, because a column with one possible value records nothing.
5. **No provider linkage.** No external system id is authoritative; a future CRM sync adds its own mapping table.
6. **The action schema still declares no digest arguments.** R3A.1's to close.
7. **Canonical migration unapplied.** Separate Director-gated ceremony.

## 31. Dependency chain after R3R

```
R3A   Durable Action Authorization      ✅ released, applied to canonical
  ↓
R3W   Durable Work Artifacts            ✅ released, applied to canonical
  ↓   draftRef has a real, versioned, digest-bound referent
  ↓
R3R   Durable Recipient Authority       ✅ implemented (this phase) — NOT committed, NOT applied
  ↓   recipientRef has a real, immutable, digest-bound referent
  ↓
R3A.1 Heby Proposal Inlet               ⚠️ referents exist; still needs the two digest arguments
  ↓
R3B   First Executed Action             ❌ + secret store + send adapter + attempt/receipt
                                        ❌ + execution-time kill switch
                                        ❌ + retired-endpoint refusal at consumption
                                        ❌ `consumeActionPermit` still has ZERO production importers
```

## 32. Next gate

**Commit gate.** No commit, tag or push was made in this phase, and the migration was not applied to canonical.
