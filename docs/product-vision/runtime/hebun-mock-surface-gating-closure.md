# Mock Surface Gating — Closure

**Status:** RELEASED. Runtime-only; no schema, no migration, no canonical write.
**Released at:** `1821dbd` (`fix: gate mock organizational surfaces`)
**Canonical:** `hebun_r1` unchanged — 31/31/31, 57 tables, business rows byte-identical.
**Suite:** 408 passed, 0 failed (407 + this phase's suite). Lint 0 errors, typecheck clean, build clean.

Second gate of the Platform Operator Foundation. It prevents compiled-in organizational fiction from reaching a real tenant, and deletes no mocks.

---

## The problem, measured

Not "mock code exists" — mock code is the intended development experience. The problem is that a real tenant could see fiction presented as *their* organizational truth.

Every organizational input to the Director dashboard projection is compiled-in:

- `runtime-projection/builders/organization-projection-builder.ts` imports `hr/mock` (employees, reviews, tickets, interviews, access requests, offboardings), `agents/mock` (departments) and `approvals/mock`
- `agent-crud/agent-adapter` seeds from `agents/mock`; `workflow-crud/workflow-adapter` seeds from `workflows/mock`

Read live before the fix:

```
active-agents:      state=ready count=36
active-workflows:   state=ready count=14
```

`ready` renders as **"Available"**. That is a fictional headcount asserted about the tenant's organization.

**And it was Heby's grounding, not just a display.** `heby-runtime/overview-source.server.ts` reads the *same* adapter, so those counts entered Heby's Executive Overview context and would have been reasoned over and spoken as organizational fact.

## Census

19 mock modules, **104 import edges, 92 distinct importer files, zero dead**. Classified by mechanism rather than filename:

| Class | Finding |
|---|---|
| **UNSAFE** | The dashboard projection chain above — reachable by a real tenant, undisclosed, organizational-looking, and feeding Heby |
| **SAFE** | The remaining mock modules render on explicitly seeded feature routes in the pre-auth shell; they carry no tenant claim and do not enter Heby grounding |
| **DEAD** | None. Every mock module has a non-test importer |
| **LIVE** | `/knowledge` (R6) and `/governance` (R7.1) — **zero** mock reachability, no dependency on this adapter |

The live/unsafe separation was proved with a static import graph, not by name matching, precisely so R6/R7.1 could not be gated by vocabulary association.

## The signal

`getAuthEnvironment()` — the authority the dashboard layout **already** uses to decide whether a real tenant is reachable:

| Status | Meaning | Demo data |
|---|---|---|
| `disabled` | pre-auth shell: no auth, no database, no cookies. Nobody can sign in | **permitted** |
| `configured` | real sessions resolve; tenant identity comes from the session row | withheld |
| `invalid` | auth enabled but misconfigured; the layout redirects to `/login` | withheld |

Fail-closed: only an explicitly `disabled` environment permits, and an environment that cannot be resolved withholds rather than guesses.

**Rejected alternatives, with reasons recorded in the module:**

- `companies.provisioning_source` — NULL on both seeded tenants and meaningful as *"no ceremony created this row"*. Reading NULL as "not production" would be wrong for exactly the fixtures it must not misjudge, and G1 added the production value while no production tenant exists.
- A tenant id or slug allowlist — brittle, and a fiction about identity rather than about data provenance.
- `NODE_ENV` — describes how the bundle was built, never who is authenticated against it.

## The fix

One guard, one choke point:

```ts
if (!organizationalDemoDataPermitted()) return unavailableDashboard();
```

Because Heby's overview source reads the same function, the dashboard and Heby are corrected by the same line. No scattered `if (tenant === …)`, no `NODE_ENV` checks, no second owner.

**Withheld, not zeroed.** The existing vocabulary already distinguishes the two claims, so nothing needed inventing:

```
unavailable: "Unavailable"     empty: "No records"
```

Gated sections report `unavailable`. A fabricated `0` would be its own lie — Hebun does not know that this tenant has no agents.

Verified in both directions:

| | Dashboard | Heby grounding |
|---|---|---|
| auth disabled (demo) | snapshot built, `active-agents: ready 36` | counts present |
| auth enabled | no snapshot, all 8 sections `unavailable`, counts 0 | **nonzero counts: NONE** |

## Bite-proofs

| | Mutation | Result |
|---|---|---|
| A | Reconnect the mock source for real tenants | `"no dashboard snapshot may be built for a real tenant"` |
| B | Inject `active-agents: 36` into Heby grounding | `"active-agents leaked a record count into grounding"` |
| C | Replace the unavailable state with `empty` | `"platform-status must be unavailable, not empty"` |
| D | Classify the mock source as live for real tenants | `"no dashboard snapshot may be built for a real tenant"` |
| E | Over-gate — withhold even in the demo shell | `"the demo shell still builds its snapshot"` |

Every mutation restored and **verified byte-identically by sha256**.

**One process defect worth recording.** Bite-proof A's restore used `git checkout --`, which reverted the adapter to HEAD and silently discarded the uncommitted G2 edit. It was caught, reapplied, and re-verified by hash and a green suite; the remaining bite-proofs used file copies. *For uncommitted work, `git checkout` is not a restore — it is a delete.*

## What the suite pins

Real tenant receives no mock projection; the two specific fictional counts are gone; unavailable is never `empty`; Heby grounding carries zero record counts and is disclosed unavailable; the demo shell still renders its seeded data; the gate fails closed; R6 and R7.1 reach no mock and no gate; the gate reads no tenant id, slug, `provisioning_source`, role, permission or `NODE_ENV`; it imports exactly one symbol, whose implementation is env-only; no route added; migration boundary intact at 31.

The census itself is pinned — if the organization builder stops importing those mocks, the test fails, because this phase's premise would have changed with it.

**One assertion was written wrong and corrected rather than satisfied.** "The gate reaches no schema module" failed at 51: the gate imports `request-session.server`, which *also* exports session resolution and is transitively database-capable. Making that assertion pass would have meant refactoring the auth runtime to suit a test. What matters is which function is called, so the test now pins the single imported symbol and that symbol's env-only body.

## Released-test repairs

**None.** All 407 pre-existing tests passed unchanged. The gate alters behaviour only where auth is enabled, and the suite runs with auth disabled — the same pre-auth shell the tests were written against.

## Record integrity

One live claim repaired: `overview-source.server.ts` described the overview as *"a REAL, derived, non-authoritative read model"*. "REAL" meant genuinely computed rather than hand-faked, and never meant the underlying organization was real — but left unqualified it now misleads. The header records where the counts come from, and that they are withheld wherever a real tenant can be authenticated.

Historical records untouched.

## Canonical impact

**None, by construction.** Re-proved after: 31 files = 31 journal = 31 applied, 57 tables; `companies` digest `68cf5df68f2063c43e34605698845741` with both rows still `provisioning_source = NULL`; knowledge 1 node / 1 fact; `audit_log` 17; genesis 1; provider `director_enabled=false`, `version=30`; attempts/permits/requests 0/0/0. No disposable residue.

## Remaining limitations

- **Coarse gate, deliberately.** Section state is all-or-nothing at the snapshot level; per-section gating would mean redesigning the dashboard aggregation, which this phase was scoped out of. The four runtime-observability sections (`platform-status`, `runtime-status`, `monitoring-summary`, `diagnostics-summary`) are genuinely real yet are withheld with the rest. `unavailable` is a safe claim — "we are not showing you this" — where `ready` beside fiction would not be. Restoring them is a candidate for a later phase.
- **The mocks remain.** This phase gates; it deletes nothing. 19 modules and 92 importers still exist, and are still the intended pre-auth development experience.
- **Feature routes are ungated.** `/hr`, `/finance`, `/legal`, `/agents`, `/workflows`, `/director` and their siblings still render seeded data. They were out of scope here: they carry no Heby grounding and no organizational summary claim. They will need their own decision before a real tenant is admitted.
- **No demo mode exists as a product concept.** "Auth disabled" is a deployment fact, not a user-facing mode.

## Next gate

**G3 — Hosted Infrastructure.** Not started.
