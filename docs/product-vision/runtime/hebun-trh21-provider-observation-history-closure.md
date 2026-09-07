# TRH-21 — Provider Observation History — PRODUCTION-ACCEPTED

Hebun now remembers what a provider reported, and when. One authorized human-triggered observation
became one immutable row saying which provider reported which typed facts about which subject, at
which instant, through which connection.

That is the whole sentence the new authority owns. It is a record of a **provider utterance**, never
of an organizational fact — and it is **memory of authorized observations, not authority to make
future ones**.

## What was built

A new, deliberately narrow `provider-observation-history` authority: a pure contract, one write
seam, one read seam, and one composition that consumes the released YouTube observation.

**Persistence lives outside `provider-youtube` and outside the Heby observation command root**, and
that placement is not taste. A released firewall walks every file in both and asserts each "touches
no table" — no `.insert(`, no `.update(`, no `.delete(`, no `@/db/schema`. Putting the write in
either place would have breached a guarantee two shipped releases installed, and the command's own
sentence to the reader — *"Nothing was stored"* — would have become false. Through that path,
nothing is. This is the same composition shape CGO-7 and TRH-20 used, for the same reason.

The read seam gained one thing: a successful authorized read now **names the connection the
capability authority chose**. It is surfaced, never chosen — no entry point accepts one — and it is
on the success branch only, because a refusal spent no connection and naming one would imply a read
that never happened.

## Every existing home was measured and refused

| Candidate | Why not |
|---|---|
| `heby_answer_source_evidence` | `message_id` NOT NULL with a composite FK that **CASCADES on delete** — history that vanishes when somebody clears a chat. Also needs a `record_ref` naming an internal record, and a source class CGO-7 deliberately refused to mint for a provider. |
| Knowledge | human-admitted, versioned, ratifiable. Provider counts would acquire the organization's own standing — forbidden in the provider-content bridge's own words. |
| `work_evidence_references` | means *a human declared this work concerns that referent*, with typed FKs and a human-only CHECK. An observation declares nothing. |
| `work_artifacts` | prepared prose under revision and review. A count is neither. |
| `audit_log` | answers *who did what under which authority*. A provider reporting a number is nobody doing anything. |
| `event_log`, `telemetry_events`, `enterprise_projection_snapshots`, `enterprise_memory_records`, `reasoning_traces`, `memories`, `working_memories`, `learning_sessions`, `executions` | **all measured dead**: zero rows, zero writers. Several are already FORBIDDEN imports in released firewalls. Reviving one because its name looked convenient is the mistake TRH-19 refused by name. |

So schema was genuinely required rather than convenient, and no dead table was revived.

## The rules the design has to keep

**Idempotency is about the INSTANT, never the values.** The unique index is
`(tenant, provider, subject, observed_at)`. A replay of the same observation collides and writes
nothing. A genuinely later read is a new row **even when every number is identical** — because "the
count did not change" is itself an observation, and deduplicating it away would erase the only
evidence anyone looked. The facts digest is stored as a *diagnostic* and is deliberately not in the
conflict target; a bite proof adds it and the suite objects.

**Zero survives as zero; null survives as null.** Through the mapper, through `jsonb`, and back out.
Nothing coalesces, defaults or substitutes — "absent is not zero" has to survive storage to be worth
saying.

**The subject is the provider's own id**, taken from the response and never from the handle a human
typed. A rename cannot break comparability, and an observation cannot be filed against a subject the
provider never confirmed.

**Tenant isolation is structural.** A composite foreign key to the connection authority makes a
cross-tenant observation unrepresentable even by hand-crafted INSERT — proved against a real
database, not asserted. `integrations` already carried the `(id, tenant_id)` unique index this
needs, so the connection authority did not change.

**Append-only.** One INSERT in the released authority and no update, delete or upsert path anywhere.
A later different number is a NEW observation, never a repair of an old one.

**The history cannot cause a read.** It imports no transport, no credential accessor and no
capability authority; it holds no timer, no loop and no retry; and it makes exactly one provider
call per invocation. No scheduler, no standing authorization, no machine principal, no autonomous
collection, and no collection authority for the agent.

## Deploy ordering, proven rather than assumed

Import-graph measurement: outside its own directory the authority has **exactly one consumer** — the
operator acceptance script, which never runs in the deployed app — and `src/app/**` and
`src/components/**` reference it **nowhere**. No deployed request path can query the new table, so
code-first was safe here.

This is the measurable opposite of TRH-19, where a released read seam on a rendered surface selected
the new column and therefore required migration-first. The ordering was derived from the dependency,
not from a habit.

## The migration

One additive migration, `20260907124912_trh21_provider_observation_history`: **1 CREATE TABLE, 2
foreign keys, 2 indexes. Zero DROP, zero backfill, zero organizational DDL.** The only `DELETE` and
`UPDATE` tokens in it are `ON DELETE no action ON UPDATE no action` — FK referential-action defaults.

Ledger **49 → 50**, applied through the sanctioned TTY ceremony by the Director. Verified afterwards
by the RELEASED verifier rather than by re-hashing: `status: converged`, `applied: 50`,
digest `76d35e01e43a609029bcd2cb86152282`, equal to the authored canonical digest.

## Production acceptance

One authorized human-triggered observation of Turkish Rug House's own public channel.

```
capability youtube.channel.public.read: available · writeCapable false
OBSERVED: yes — Turkish Rug House (@turkishrughouse), 0 recent uploads, 2 quota units
RECORDED: recorded
moved: provider_observations 0→1
```

The stored row, measured independently of the script: the authorized tenant; the tenant's own
connection; `youtube` / `youtube.channel.public.read`; subject `youtube-channel` addressed by the
provider's channel id; Hebun's read instant in UTC, distinct from the written-down time; actor
`human`; a closed 12-key fact set; `viewCount 0`, `subscriberCount 0`, `videoCount 0`,
`hiddenSubscriberCount false`. Secret scan CLEAN. The handle a human typed appears **nowhere**.

**Non-effects, measured before and after:** knowledge nodes, knowledge facts, external references,
work items, work artifacts, work evidence references, Governance decisions, permits, execution
attempts, action requests, origination invocations, answer-source evidence, connections, credentials
and the audit log **all held their counts**. The connection is still `connected` / `healthy`.
Exactly one row moved in the entire deployment.

## What the stored truth is, and is not

> The provider reported these facts about this subject at this observation time, through this
> connection.

It is **not** a trend, growth, decline, momentum, cadence or performance. **One sample is a baseline
observation and nothing more; two samples are two observations.** No derived comparison exists in
this release, and the read seam is asserted to compute none.

A fact worth stating plainly rather than burying: the channel reports it was **created on the day of
this acceptance**, with no public content. The baseline is true, and it is a baseline of zero.

## Verification

`tsc` clean · `eslint` 0 errors (15 pre-existing warnings) · `next build` green ·
**699 passed / 0 failed / 699** under Node v24.16.0 · TRH-21 bite proofs **6/6 bit**, every mutated
file restored byte-identically.

The ledger move cost ~50 pinned edits across 53 test files. Each was read and classified rather than
bulk-replaced, and four were not mechanical: two carried prose that had been **false since an
earlier phase** (a message saying "47 canonical migrations" beside an assertion of 49, and "ledger
unchanged at 47" beside 49); one pinned TRH-19 as "the last entry", which was only ever true until
the next migration; and one pinned CGO-5's claim that no observation table exists, which this phase
legitimately changes — repaired to the narrower claim CGO-5 actually owns, that no table is named
for YouTube, a channel or a video, plus a new assertion that the one observation table names no
provider at all.

Three digests were recomputed with each file's own mechanism, never hand-written, and the
pending-migration probe was moved to the table this release adds — a probe following what an
*earlier* migration added would be satisfied before migrating and prove nothing.

## Known bound, stated rather than hidden

Two genuinely distinct reads of one subject inside the same millisecond collapse to one row. No
caller can produce that today — a read costs three sequential provider calls — and the alternative,
an opaque sequence number, would make the key meaningless as a fact.

## What remains unavailable

Unattended observation of any kind. Cadence, momentum, upload rhythm, and anything requiring two
samples taken without a person present. None of it is blocked by a table: it is blocked by the
absence of a principal, which TRH-22's discovery established is a deliberate security property and
not an oversight.
