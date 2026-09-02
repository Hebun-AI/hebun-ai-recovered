# ORG-1 — "What is this department?"

**FAST PATH.** Read-only composition of four released authorities on an existing surface.
**Zero schema, zero migration, zero writer, zero new authority, no provider, no Heby class.**
Production ledger 43 → 43.

## Capability

**Enterprise job:** *"What is Engineering — who owns it, who is recorded as working in it, and which
work names it?"*

Every fact already existed and none of them were in one place: department ownership on
`/director/organization`, placements in a second panel, people in a third, and work on
`/director/work` with a department name per item. Nothing answered the question a Director actually
asks about a part of their organization.

## Authority reused (none created)

| Fact | Owner |
|---|---|
| which departments exist, and who is accountable for each | Organization Structure Authority |
| who is recorded as working in one | Departmental Placement |
| which work names one | Organizational Work Authority |
| what a human is called | Identity — Human Legibility Reach |

**The grouping is DERIVED; every fact inside it is authoritative to its owner.** The panel writes
nothing, offers no control, and each act is still performed by the panel that owns it.

## The inference it refuses

A department showing PEOPLE and WORK side by side invites exactly one wrong reading. WORK-1 and
WORK-2 both state the opposite, so the panel says it on the department itself:

```
PLACED HERE  != DOES THIS WORK
WORK NAMES A DEPARTMENT != ITS PEOPLE PERFORM IT
ACCOUNTABLE  != PLACED HERE
```

## Truth semantics

- **An empty slice is a zero only when its register answered IN FULL.** A per-department "nobody is
  placed here" or "no work names this" is inferred from an empty slice, which is honest only when
  the register was available and not truncated. Otherwise the panel says the answer is unknown for
  that department — `UNAVAILABLE != NONE`, `TRUNCATED != COMPLETE`.
- **Retired work does not count** toward what a department currently carries, by the released
  `inService` flag; a retired department is shown rather than hidden.
- **A departed owner is still named**, with the released "no longer an active member" sentence —
  ownership is historical truth.
- **No name is invented:** an unresolved identifier reads `name unavailable`, with the identifier
  beside it.
- **PII:** the address-floored product label, composed once at the page as the DEDUPED UNION of the
  three sets it already resolved. No register gains a label field, and nothing here reaches a model.

## Validation (FAST — full suite NOT required)

```
targeted     org1-department-composition/composition-truth        PASS
regressions  osa1 firewall · osa3 (4) · osa4 (3) · work1 firewall · work2 (2)
             hlr-human-legibility (3) · cmdv3 · app1                ALL PASS
typecheck    clean          lint  0 errors
full suite   NOT RUN — no schema, no writer, no shared authority/security/tenant primitive, no
             Governance or execution semantics, no provider scope. One presentation component and
             one page read; every released contract over that boundary was run.
```

**Two censuses moved, both legitimately joined:** the HLR legibility consumer census (a fifth
component receiving the shape, type-only, proved by the no-read loop) and the `StateBlock` consumer
census.

**One PRE-EXISTING failure, proven unrelated and left alone:**
`osa1-organization-structure/structure-postgres.ts` fails at clean `HEAD` with every change stashed,
and fails consistently on rerun (`actual: ''` against `/department/i`). It is not this capability's
and was not modified. Worth a look by whoever next touches that workstream.

## Intentional limitations

No per-department drill-through, no counts rolled up anywhere, no ordering or ranking of
departments, no agent→department composition (Agent Identity owns `agents.department_id`), no Heby
class — Heby already grounds on organization, placement and work separately, and a fourth class
carrying the same facts under a composed provenance would be a second telling of them.
