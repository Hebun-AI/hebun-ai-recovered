# V1-STAGE-4 — Profile & Team

Hebun AI v1.0, Stage 4 (Director-approved roadmap, 2026-11-09). A new page, `/account`, is reached
from the account menu ("Profile & team"):

- **Every member** sees their own profile and their membership.
- **The organization's Governance authority** also sees the team.
- **Changes** to membership, access and invitations stay on `/governance/authority`.

## What it shows and allows

- **Profile.**
  - Email, with its verification state. It is read only: it is the sign-in and ownership identity
    (AUTH-EMAIL-OWNERSHIP-1), and changing it would void the proof and every invitation bound to it.
  - Name, read only, because signup owns it.
  - **Display name, editable by the person themself.** It is trimmed and collapsed, at most 80
    characters, and refuses control, bidi and zero-width characters. Empty clears it. The save is
    optimistic on the profile version and audited. The display name becomes the person's label
    everywhere (`display_name → name → email`).
- **Organization.** Name and slug, the viewer's role, member since, and whether they hold Governance
  authority.
- **Team (Governance authority only).**
  - Members with their role names and membership dates.
  - Pending invitations with issued and expiry times.
  - Everyone else sees "visible to your organization's Governance authority". This is the same
    privacy design as the released people register, which must not become a directory.

## What it does not create

- No membership, role, permission or invitation authority.
- The team list is read through the released, Governance-gated readers: the people register, human
  labels and revocable invitations. Role names come from a tenant-scoped read of those exact
  memberships.
- **No migration.**
- **One new self-read, placed in Identity:** `readOwnNameFields` in
  `auth-runtime/human-label-read.server.ts`. It returns the session user's own `name` and
  `display_name`, only while they hold an eligible membership in the session tenant. Name columns
  keep exactly one projecting module, as the WORK-2 provider-bound-name guard requires.
- **The audit row records that the display name changed (or was cleared) and the version, never the
  name.** Names stay in Identity.

## What is proven

- `tests/v1-account-profile/profile-postgres.ts` P1–P5, on a disposable PG 18.6:
  - own profile, organization, role and authority are read through the session's own membership;
  - a forged context that mixes tenant, membership and user reads nothing;
  - display name: validation, stale version, one audit row per real change (none for an unchanged
    save), it becomes the label, it can be cleared, and no membership, role, invitation or other
    user row moves;
  - each session changes only its own user;
  - a cross-tenant role is refused by the schema;
  - the team, with roles, is visible to the Governance authority; a member, and an organization
    without established Governance, get `authority-only`.
- `firewall-and-render.ts`:
  - the profile module's only write is `update(users)`: display name, for the session user;
  - it never projects name columns;
  - it reaches no membership, onboarding or Governance writer;
  - the action file exports one write and takes no tenant or user from the client;
  - the display-name rules hold;
  - the form renders identically in three zones.
- Mutations Y1–Y10, run in an isolated worktree:
  - 8 of 8 bit on the final code: membership match, version, audit, length, unchanged, own-read
    user predicate, name in audit, updating another user.
  - Two earlier mutations survived, and both taught something:
    - **Y4:** a second authority gate duplicated the released people register's own gate. It was
      removed, so the released gate is the only one.
    - **Y5:** the role-join tenant predicate is redundant because the schema already enforces
      `(tenant_id, role_id)`. That is now proven by P4b.
- 206 of 208 possibly-affected suites passed on the first run. The two failures were privacy
  censuses, and both now pass:
  - HLR legibility consumers: profile added with its reason.
  - WORK-2 name projection: fixed by moving the self-read into Identity.
- Identity-dependent suites pass after the change: HLR legibility postgres, OSA owner eligibility,
  OSA-4, cmdb1, g1, g2, k2.
- Bite-proofs pass in isolation: HLR 9/9, WORK-2 6/6, OSA-3 8/8.
- The server-action census was updated in 7 suites and the dashboard route count moved 133 → 134.
- `tsc` 0, `eslint` 0, `next build` succeeds with `/account`.

## What is not proven

- No signed-in browser render; nothing deployed.
- A user's display name is global across their organizations: one person, one label. Per-organization
  names were not asked for and are not built.

## Closure Contract (v1)

- Phase: V1-STAGE-4
- Owner: apps/dashboard/src/features/account-profile (own profile and team reads, own display-name write), readOwnNameFields in src/features/auth-runtime/human-label-read.server.ts, src/features/governance-audit/account-profile-audit.server.ts, /account page and src/app/(dashboard)/account/actions.ts, account-menu link
- Reached state: VERIFIED
- Implementation commit: THIS COMMIT
- Verification level: V3 — tenant isolation, an Identity read and a write to the users table; full suite justified once on the release candidate, not per commit
- Verification evidence: profile-postgres P1–P5 PASS; firewall-and-render PASS; mutations 8/8 bit on final code (Y4 and Y5 survivals resolved: redundant gate removed, schema invariant proven); 206/208 affected suites first run, 2 privacy censuses resolved and PASS; identity-dependent suites and bite-proofs HLR 9/9, WORK-2 6/6, OSA-3 8/8 PASS; action census 7 suites and route count updated; tsc 0, eslint 0, next build success
- Test environment: isolated worktree in the session scratchpad on 0c046a29, macOS Darwin 25.2.0, Node 24.16.0, disposable PostgreSQL 18.6 at 127.0.0.1:55432 (system_identifier proven) stopped and deleted after use; synthetic identities only
- Deployment evidence: N/A — not deployed
- Production acceptance evidence: N/A — not deployed
- Deferred risks: V1S4-BROWSER-UNVERIFIED-1 (DEFERRED)
- Director approvals: V1.0 CONTINUOUS DEVELOPMENT — Stage 4 local implementation with local commits, 2026-11-09; push, PR, merge, deployment NOT approved

### Deferred risk detail

- **V1S4-BROWSER-UNVERIFIED-1 (DEFERRED).** `/account` is proven by Postgres and render tests and the
  build, not by a signed-in browser. Acceptance dependency: a signed-in render after release by a
  Governance authority and by a plain member, read only.

## Weekly three questions

1. **What did we learn?** A guard can be satisfied in letter while missing its point. Moving the name
   read into Identity satisfied WORK-2 honestly. Hiding it behind raw SQL would only have dodged the
   text match. Also: a second copy of a released gate cannot be tested, so remove it.
2. **How does this improve Turkish Rug House?** TRH's people can set how they appear to their
   colleagues and see their role, and its owner can see the team and pending invitations in one
   place. Membership and access stay under the same Governance control.
3. **How does this become part of Hebun AI?** Every tenant gets a profile and team page built
   entirely on the released identity and Governance readers. A later plans and billing page (Stage 6)
   can sit beside it.
