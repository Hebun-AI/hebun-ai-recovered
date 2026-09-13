/**
 * WHERE A TENANT-RESOLVED HUMAN LANDS.
 *
 * ── WHY THIS CONSTANT EXISTS ─────────────────────────────────────────────────
 *
 * Six seams in the sign-in lifecycle each answer the same question — sign-in success, signup
 * success, workspace selection, and the three "you are already past this step" guards on
 * `/login`, `/register` and `/login/select-workspace`. Every one of them held its own copy of the
 * answer, so the destination was not owned anywhere: it was AGREED UPON, six times, by hand.
 *
 * This is not a second authority over routing. It is the FIRST one for a decision that had none.
 * `WORKSPACES` in `config/workspace-nav` owns the navigation information architecture and the Heby
 * workspace registry owns each workspace's profile; neither is consulted by the auth lifecycle, and
 * neither should be — an authentication seam that imported Heby's workspace profile to learn where
 * to send a human would couple sign-in to a subsystem that has nothing to do with it.
 *
 * ── WHAT IT DOES NOT DECIDE ──────────────────────────────────────────────────
 *
 * It names a DEFAULT, not a destiny. `/foundation` — the technical workspace this used to point at —
 * remains reachable, unchanged, and is not redirected anywhere. A human who asks for it gets it.
 * The only thing that changed is which surface a human is handed when they asked for nothing in
 * particular.
 *
 * It also decides nothing about WHETHER a human may land. Authentication and tenant resolution are
 * answered before this constant is ever read, by the seams that own them; a caller that has not
 * resolved a tenant must still refuse rather than redirect here.
 */
export const AUTHENTICATED_LANDING_ROUTE = "/command";
