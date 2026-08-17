# R3B — External-send arming boundary (implementation closure record)

**Date:** 2026-08-17
**Predecessor:** `hebun-r3b-resend-adapter-mapping-closure.md` (released `0633f60`, tag
`hebun-resend-adapter-mapping-complete`).

**What this phase did:** built the authority boundary for enabling outbound external sending.
**What it did not do:** arm anything, configure anything, or send anything. The `external-send`
control row still does not exist.

---

## 1. The gap this closed

R3B shipped the external-send kill-switch **read** (`resolveExternalSendEnabled`, called twice per
attempt) with **no writer**. The switch could only ever be flipped by hand-written SQL — which
carries no authority check, no actor attribution, and no server-side refusal. A kill switch whose
only operator is `psql` is not an authority boundary.

## 2. Correction to the previous gate's report

The R3B configuration gate reported *"no legitimate production caller was found that could create or
enable an external-send control."* **That was half wrong, and the wrong half mattered.**

There is a production caller for the Claude control — `platform/actions.ts` →
`setClaudeConnectivityAction` — and an existing authoritative admin surface, Providers & Models,
with a card, a projection and an authority resolver. My earlier sweep used a broken grep pattern and
concluded the whole authority was orphaned. What was *actually* missing was only the external-send
half of an otherwise complete and well-designed R2E seam.

The consequence is a better phase: **extend the existing surface, do not build a second one.**

## 3. What was already generic, and what was not

| Layer | Already generic? | Action |
|---|---|---|
| `provider_connectivity_controls` schema | ✅ `provider_key` unique, one row per provider | reused, no change |
| `setDirectorEnabled(providerKey, …)` repository | ✅ takes any key | reused, no change |
| `resolveDirectorEnabled(providerKey)` | ✅ fail-closed three ways | reused, no change |
| `resolveProviderControlAuthority(tenant)` | ✅ not Claude-specific | reused, no change |
| `setClaudeDirectorEnabled` wrapper | ❌ Claude-pinned | **left alone**; a sibling was added |
| Server action | ❌ Claude-pinned | sibling added |
| Projection | ❌ Claude-specific (model/transport) | sibling added |
| UI card | ❌ Claude-specific copy | sibling added |

**Verdict on the Claude-pinned writer:** intentional, not legacy. R2E shipped exactly one provider
and pinned the key so no caller could mint a row for an arbitrary provider string. That property is
worth keeping, so the fix is a **second typed wrapper**, not a generalization that accepts a
caller-supplied key. Two named wrappers over one generic repository — the closed vocabulary stays
closed.

## 4. The arming state machine

| State | Meaning |
|---|---|
| `unconfigured` | any of credential / sender / subject missing — the adapter does not exist at runtime |
| `configured-disarmed` | all three present, Director permission off or row absent |
| `armed` | all three present **and** Director permission on |

**Persisted:** the Director permission — one row in the existing table. **Derived:** configuration
completeness, read from the environment per request. Configuration is deliberately *not* mirrored
into the database: a stored copy of what the environment says goes stale the moment a deployment
changes, and the stale copy is the one a surface would show.

`unconfigured` outranks the permission on purpose. A switch reading "on" over a deployment that
cannot send is not armed, and rendering "Armed" there would be exactly the collapse this phase
exists to prevent. The raw `directorEnabled` stays visible beside the composite, so an
enabled-but-unconfigured deployment is legible rather than hidden.

## 5. The A/B/C/D matrix — proved, not assumed

The runtime reads the kill switch as **gate 1** and configuration as **gate 4**, both *before* the
permit is spent ([execute-authorized-action.server.ts:274](apps/dashboard/src/features/action-execution/execute-authorized-action.server.ts:274), [:343](apps/dashboard/src/features/action-execution/execute-authorized-action.server.ts:343)), and the switch again at
[:471](apps/dashboard/src/features/action-execution/execute-authorized-action.server.ts:471) immediately before dispatch.

| | Config | Control | Network reachable | Arming state |
|---|---|---|---|---|
| A | absent | absent | **No** | `unconfigured` |
| B | present | absent | **No** | `configured-disarmed` |
| C | present | disabled | **No** | `configured-disarmed` |
| D | absent | enabled | **No** | `unconfigured` |
| E | present | enabled | adapter constructible — and still sends nothing by itself | `armed` |

Every case asserted against a throwing `FetchLike` stub. No socket is opened by any test.

## 6. What was built

| File | Role |
|---|---|
| `action-execution/execution-control.server.ts` | `setExternalSendDirectorEnabled` — the typed writer, provider key frozen inside |
| `action-execution/execution-arming-projection.server.ts` | *(new)* the secret-free view + `isExternalSendConfigured` |
| `platform/actions.ts` | `setExternalSendConnectivityAction` — authority-gated, boolean-only |
| `platform-providers/external-send-arming-card.tsx` | *(new)* the Director control |
| `director/provider-matrix/page.tsx` | renders it beside the Claude card |
| `operations-substrate/model.ts` | says where the switch now lives |

**Stricter than the Claude action in one place:** enabling is refused when configuration is
incomplete (`configuration-incomplete`, nothing written). **Disarming is always permitted**, even
under a degraded configuration — a kill switch that could not be turned off would be the wrong
failure direction.

## 7. Authority verdict

| Question | Answer |
|---|---|
| Who owns the control? | `heby-provider-ops` — one table, one repository, unchanged |
| Global or tenant-scoped? | **Global.** Matches a system-owned credential. Recorded as R5 debt: pausing one tenant pauses all |
| What does `enabled=true` authorize? | Only that the runtime *may* dispatch. Not a permit, not an execution |
| What does `enabled=false` prevent? | Every attempt, refused at gate 1 before the permit is spent |
| Row absent? | Disabled. Fail-closed three ways: no repo, no row, or any error |
| Can configuration bypass it? | **No** — proved by cases B and D |
| Can the runtime arm itself? | **No** — asserted: no call site in `action-execution` outside the writer's own declaration |
| Can an agent or Governance arm? | **No** — asserted across `heby-actions`, `heby-answer`, `governance-decision` |
| Can a tenant user arm? | Only an `owner`/`director` band, resolved server-side from the durable role |
| Arbitrary provider keys? | **No** — the action takes one boolean; the key is frozen in the writer |

## 8. Firewalls held

| Firewall | Result |
|---|---|
| Schema / migration | **NO SCHEMA CHANGE, NO MIGRATION** — 29 files = 29 journal = 29 applied; 0 files changed under `src/db` |
| Canonical data | `action_execution_attempts` 0, permits 0, recipients 0, artifacts 0, requests 0, `executions` 0, `audit_log` 17 — all unchanged |
| **Arming** | `external-send` row **still absent**; only `claude`, disabled, `updated_at` 2026-08-10 untouched |
| Configuration | none — `.env.local` byte-identical (`7f254e16…3304c`, mtime Aug 10) |
| Secrets | no secret-shaped addition in the diff; the card names no credential variable and touches no storage; the view carries presence vocabulary only |
| Control-plane payload | the table declares exactly `providerKey` + `directorEnabled`; no sender, subject, body or address can be persisted through it |
| Claude control | untouched in both directions — proved durably that arming external-send leaves it off, and that disabling Claude does not disarm external-send |
| Dependencies | none added |
| Network | zero real calls |

## 9. Resend verification state

`hebuntech.com` is **Pending / Checking DNS** at Resend. Hebun models this honestly and does not
track it: `senderDomainVerification` is the constant `"not-established-by-hebun"`, and the card
renders "Not established by Hebun" with the explicit statement that Resend owns the fact. No
Verified badge is fabricated, and no verification state is inferred from a configured address —
mirroring R2E's `connectivity: "not-recorded"` precedent.

## 10. Tests

**387 passed, 0 failed** (385 baseline + 2 new files). Lint 0 errors / 14 pre-existing warnings,
typecheck clean, build clean, `git diff --check` clean, zero disposable residue.

- `tests/r3b-flow/arming-authority.ts` — the A/B/C/D/E matrix, configuration-is-not-arming, who may
  arm (runtime / agent / Governance / tenant), no arbitrary keys, Claude unchanged, the secret
  firewall, arming-creates-nothing, and the state vocabulary staying apart.
- `tests/r3b-flow/arming-durability.ts` — against real Postgres: fail-closed while absent, the
  arming write with actor attribution and version advance, **Claude independence in both
  directions**, durability across a reconnect, exactly two rows in one table, and zero operational
  substrate created.

**No inherited test was changed.** Nothing this phase built falsified an existing guard.

## 11. Limitations (deliberate, recorded)

1. **Still disarmed.** The `external-send` row does not exist. This phase built the ability to
   create it, not the row.
2. **Still unconfigured.** No credential, sender or subject. Arming would be refused today.
3. **Domain verification is pending at Resend** and Hebun will never assert it.
4. **The control is global.** One switch, all tenants — R5 debt.
5. **No audit event for arming.** The change records `updated_by` + `version` on the row, which is
   attribution but not an `audit_log` entry. Consistent with R2E's Claude control; worth revisiting
   when execution history matters.
6. **Armed ≠ sendable.** Every send still needs an approved single-spend permit and a human Execute.

## 12. Next gate

**R3B RESEND CREDENTIAL + SENDER CONFIGURATION** (blocked on Resend domain verification), then
**arming through this new control**, then the separately authorized **first real external-send
execution ceremony**. The three stay separate.
