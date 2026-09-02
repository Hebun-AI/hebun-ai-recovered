# LM-1 — Live Map draws this organization's parts and its people

**FAST PATH.** Read-only projection over three released authorities. **Zero schema, zero migration,
zero writer, zero new authority, zero provider, no Heby source.** Production ledger 43 → 43.

## Capability

**Enterprise job:** *"Show me my organization as it actually is — its parts, its people, and who
works where."*

Live Map's own contract named this as unblocked and then blocked on itself:

> *"DEPARTMENTAL PLACEMENT NOW OWNS THIS RELATIONSHIP, and the edge is still absent … the concept is
> owned and this projection has nowhere to draw it … drawing people is a later milestone's
> decision."*

And it carried a claim that **OSA-4 had made false**: *"Hebun holds a count of this organization's
human members but **no authority that lists them**."* There is one — the Organizational People
Register — so the map was making a stale statement about Hebun on the surface a Director trusts most.

## Authority reused (none created)

| Fact | Owner | Seam |
|---|---|---|
| departments | Organization Structure Authority | `readOrganizationAuthority` (already consulted) |
| people | Organizational People Register | `readPeopleRegister` |
| who works where | Departmental Placement | `readPlacementRegister` |
| what a person is called | Identity (Human Legibility Reach) | `resolveHumanLabels` |

## Truth semantics

```
UNAVAILABLE != EMPTY              NO EDGE     != PLACED NOWHERE
MEMBERSHIP  != EMPLOYMENT         AN ORG CHART != A MEMBER LIST
A MEMBER REGISTER != A PLACEMENT REGISTER
THE LABEL IS COMPOSED, NEVER MERGED
```

- **People states are four and they are four.** A refused or unreachable register is `unavailable`;
  a register that answered with nobody is `known-empty`. `no-authority` is gone — the authority
  exists, and saying otherwise was the stale claim this milestone repaired.
- **An edge is never drawn into empty space.** `works-in` is drawn only when both endpoints are on
  the map; an unreadable placement register draws no edges and changes no node. A person with no
  line is a person this organization has not placed — stated on the edge basis itself.
- **PII.** The product label (address floor) is composed here and only here, because `/live-map` is
  server-rendered for the organization's own authorized human and **Live Map is not a Heby grounding
  source** — a released firewall keeps the Heby tree away from this projection, so no label composed
  on the map can reach a model provider.
- **Retirement is not deletion:** a retired department is drawn, toned `retired`, and says so.

## Validation (FAST — full suite NOT required)

```
targeted     lm1-live-map-people/people-and-departments      PASS
regressions  l4-live-map (3) · e23-live-map-intelligence (5) · live-map-experience (5)
             hlr-human-legibility (3) · osa4-people-register (3) · osa3 firewall · cmdv3   ALL PASS
typecheck    clean            lint  0 errors
full suite   NOT RUN — no schema, no writer, no shared authority/security/tenant primitive,
             no Governance or execution semantics, no provider scope. The changed boundary is one
             read projection and its surface, and every released contract over it was run.
```

**Five released contracts encode the exact claim this capability changes, and each was repointed
rather than relaxed:** the L4 import-graph pin (widened to the placement READ seam; the writer sweep
still proves no writer), two `no-authority → unavailable` truth contracts, the HLR legibility
consumer census, and two bite-proof mutations whose target code LM-1 replaced — each re-aimed at the
same guarantee in the new code.

## Foreseeable defects found during implementation

1. **A released guard caught a real conflation risk.** `map-surface` asserts *"membership is never
   relabelled as placement"* — a property that matters MORE now that both are drawn. The distinction
   now travels on the human node itself and in both people sentences.
2. **`AbsentDomain` returns null for available domains**, so drawing departments and people would
   have rendered *nothing*. Added `PresentDomain`.
3. **`Relationship` printed only `edges[0]`** — with a second relation kind that would have shown a
   reader one basis while silently omitting another they can see drawn. Now one line per kind.
4. **A stale-prose scan failed on my own comments recording the repair** — the honest-prose trap.
   Re-aimed at the shipped constants.

## Intentional limitations

Departments and people are listed beside the map rather than hung off the spine: the spine carries
the one relationship the map has always proved, and a second geometry would assert a shape nobody
owns. No agent→department edge (Agent Identity owns `agents.department_id`; not this milestone). No
department→department nesting, no teams, no reporting lines — nothing owns them. No Heby exposure.
