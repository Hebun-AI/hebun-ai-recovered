/*
 * Post-Login Tenant Switching — structural boundaries.
 *
 * These prove claims about what does NOT exist: no membership/role/credential/identity writer, no
 * second Session authority, no schema change, no weakening of `authorized`, no audit semantics
 * invented for a Session authority that has never written any, no client-supplied authority, no
 * restarted sign-in clock, and two entry points that each refuse the other's input.
 *
 * Runtime behaviour lives in `switch-postgres.ts`.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  CONCURRENT_WORKSPACES,
  SWITCH_LIFETIME,
  SWITCH_RULE,
  TENANT_SWITCH_NON_EFFECTS,
} from "../../src/features/tenant-switching/contracts";
import { POST_LOGIN_SWITCHING } from "../../src/features/tenant-selection/contracts";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function collect(dir: string, ext = /\.tsx?$/): string[] {
  const abs = path.join(ROOT, dir);
  return readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return collect(rel, ext);
    return ext.test(e.name) ? [rel] : [];
  });
}

const SESSION = "src/features/auth-runtime/session-service.server.ts";
const REPO = "src/features/auth-runtime/identity-repository.server.ts";
const REQUEST = "src/features/auth-runtime/request-session.server.ts";
const CONTRACTS = "src/features/tenant-switching/contracts.ts";
const CARD = "src/components/auth/workspace-switch-card.tsx";
const SURFACE = "src/app/(dashboard)/foundation/page.tsx";
const ACTIONS = "src/app/login/actions.ts";
const PICKER_PAGE = "src/app/login/select-workspace/page.tsx";

function main(): void {
  const session = read(SESSION);
  const sessionCode = codeOf(session);
  const repoCode = codeOf(read(REPO));
  const card = read(CARD);
  const cardCode = codeOf(card);

  /* ── 1. NO SCHEMA CHANGE ─────────────────────────────────────────────────── */
  {
    /*
     * Stated against this phase's own boundary, not a global count. Filenames are timestamp-prefixed,
     * so a lexical comparison is chronological: the 23 migrations that existed when switching closed
     * must all still be there, and none of them may be this phase's. A later authorized phase adding
     * its own migration must not falsify a claim that was never about it.
     */
    const migrations = readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) =>
      f.endsWith(".sql"),
    );
    const throughSwitching = migrations.filter(
      (f) => f <= "20260812130555_i1_2_identity_enrollment.sql",
    );
    assert.equal(
      throughSwitching.length, 23,
      "the 23 migrations that existed when switching closed are intact",
    );
    assert.equal(
      migrations.filter((f) => /switch|workspace/i.test(f)).length, 0,
      "switching adds no migration — no switching-named migration exists, then or since",
    );
    for (const file of [CONTRACTS, CARD]) {
      assert.ok(!codeOf(read(file)).includes("pgTable("), `${file} must not define a table`);
    }
    /* The switch writes only columns that already existed, and both rows are tenant-bound. */
    const schema = read("src/db/schema/user-session-context.ts");
    assert.match(schema, /revocationReason: varchar\("revocation_reason", \{ length: 64 \}\)/);
    assert.ok(
      "tenant-switched".length <= 64,
      "the revocation reason must fit the column that already exists",
    );
  }

  /* ── 2. `authorized` IS UNCHANGED ────────────────────────────────────────── */
  {
    for (const invariant of [
      'if (row.identityStatus !== "active") return forbidden("identity");',
      'if (row.userLifecycleStatus !== "active") return forbidden("user");',
      "row.sessionMembershipVersion !== row.membershipCurrentVersion",
      'return forbidden("membership");',
      'return forbidden("tenant");',
    ]) {
      assert.ok(sessionCode.includes(invariant), `the resolver must still enforce: ${invariant}`);
    }
    assert.match(sessionCode, /createAuthorizedAuthenticationResult\(/);
    assert.match(
      codeOf(read(REQUEST)),
      /result\.status === "authorized" \? result\.tenantContext : null/,
      "no non-authorized status may yield a TenantContext",
    );
  }

  /* ── 3. THE TWO ENTRY POINTS REFUSE EACH OTHER'S INPUT ───────────────────── */
  {
    /* The sign-in picker still refuses a tenant-bound receipt. UNCHANGED. */
    assert.match(
      sessionCode,
      /current\.activeTenantId !== null \|\|\s*\n?\s*current\.activeMembershipId !== null/,
      "selectTenantForSession must keep refusing an already-authorized session",
    );
    /* And switching refuses anything that is not authorized — which includes a pre-tenant receipt. */
    const switchBody = sessionCode.match(
      /export async function switchTenantForSession[\s\S]*?\n\}/,
    );
    assert.ok(switchBody, "switchTenantForSession exists");
    assert.match(
      switchBody![0]!,
      /if \(current\.status !== "authorized"\) \{[\s\S]*?reason: "no-active-session"/,
      "the caller's session must resolve to authorized before anything else happens",
    );
    /* Judged by the resolver itself, never by a second copy of its predicates. */
    assert.match(
      switchBody![0]!,
      /const current = await resolveSessionFromReference\(/,
      "'authorized enough to switch' must be the same function as 'authorized enough to act'",
    );
    assert.match(SWITCH_RULE.authorityOfTheCaller, /same function every request uses/);
    /* The earlier phase's record was corrected rather than left claiming this does not exist. */
    assert.equal(POST_LOGIN_SWITCHING.implemented, true);
    assert.match(POST_LOGIN_SWITCHING.implementedBy, /switchTenantForSession/);
  }

  /* ── 4. SWITCHING IS NOT AUTHORIZATION — REVALIDATION IS ─────────────────── */
  {
    assert.match(
      repoCode,
      /and\(eq\(memberships\.id, membershipId\), eq\(memberships\.userId, userId\)\)/,
      "the chosen membership is matched by id AND by the authenticated human",
    );
    const switchBody = sessionCode.match(/export async function switchTenantForSession[\s\S]*?\n\}/)![0]!;
    assert.match(
      switchBody,
      /await findMembershipForUser\(db, session\.userId, membershipId\)/,
      "the human comes from the resolved session, never from input",
    );
    assert.match(switchBody, /membership\.companyAuthenticationDisabled/);
    assert.match(switchBody, /ACTIVE_TENANT_STATUSES\.has\(membership\.companyTenantStatus\)/);
    assert.match(
      switchBody,
      /membershipVersion: membership\.membershipVersion,/,
      "the session carries the version read at issuance, never a remembered one",
    );
    assert.match(SWITCH_RULE.switchIsNotAuthorization, /re-read by id AND by the authenticated user_id/);
  }

  /* ── 5. A FRESH SESSION, NEVER A MUTATED ONE, AND SPENT EXACTLY ONCE ─────── */
  {
    /* The only session writers remain: insert, activity touch, revoke. */
    const updates = [...repoCode.matchAll(/\.update\(userSessionContexts\)\s*\.set\(\{([^}]*)\}/g)].map(
      (m) => m[1]!.replace(/\s+/g, " ").trim(),
    );
    assert.deepEqual(
      [...new Set(updates)].sort(),
      ["lastActivityAt, inactivityExpiresAt", "revokedAt, revocationReason"].sort(),
      "no writer may change a session's tenant or membership after issuance",
    );
    /* The single-spend primitive is predicated on the row still being live. */
    const spender = repoCode.match(/export async function revokeSessionIfActive[\s\S]*?\n\}/)![0]!;
    assert.match(spender, /isNull\(userSessionContexts\.revokedAt\)/, "conditional on still-live");
    assert.match(spender, /\.returning\(\{ id: userSessionContexts\.id \}\)/, "and it reports the winner");
    /* Sign-out's unconditional revoke is untouched. */
    assert.match(
      repoCode,
      /export async function revokeSession\(\n\s*db: ControlPlaneDatabase,/,
      "logout keeps its unconditional, idempotent revoke",
    );

    const switchBody = sessionCode.match(/export async function switchTenantForSession[\s\S]*?\n\}/)![0]!;
    assert.match(switchBody, /await db\.transaction\(async \(tx\) => \{/, "one transaction");
    assert.match(
      switchBody,
      /const spent = await revokeSessionIfActive\(\s*\n?\s*tx,/,
      "the previous session is spent inside that transaction",
    );
    assert.match(switchBody, /if \(!spent\) throw new SwitchSuperseded\(\);/, "a lost race unwinds");
    /* The spend comes BEFORE the insert, so the lock is on the contended row. */
    assert.ok(
      switchBody.indexOf("revokeSessionIfActive") < switchBody.indexOf("insertSessionContext"),
      "the conditional spend must precede the insert",
    );
    assert.match(switchBody, /const nextReference = generateSessionReference\(\);/);
    assert.match(SWITCH_RULE.issuance, /FRESH tenant-bound session/);
  }

  /* ── 6. THE SIGN-IN CLOCK IS CARRIED OVER, NEVER RESTARTED ───────────────── */
  {
    const switchBody = sessionCode.match(/export async function switchTenantForSession[\s\S]*?\n\}/)![0]!;
    assert.match(
      switchBody,
      /const authenticatedAt = new Date\(session\.authenticatedAt\);/,
      "authenticatedAt comes from the session being replaced",
    );
    assert.match(
      switchBody,
      /const absoluteExpiresAt = new Date\(session\.absoluteExpiresAt\);/,
      "and so does the absolute expiry — a switch may not extend one authentication's life",
    );
    assert.ok(
      !/absoluteExpiresAt = new Date\(\s*\n?\s*now\.getTime\(\) \+ SESSION_ABSOLUTE_TTL_SECONDS/.test(
        switchBody,
      ),
      "the switch must never mint a fresh absolute window",
    );
    assert.match(
      switchBody,
      /slidInactivity\.getTime\(\) > absoluteExpiresAt\.getTime\(\) \? absoluteExpiresAt : slidInactivity/,
      "the inactivity window is bounded by the absolute expiry it may never pass",
    );
    assert.match(SWITCH_LIFETIME.absoluteExpiresAt, /carried over unchanged/);
    assert.match(SWITCH_LIFETIME.authenticatedAt, /nothing was re-authenticated/);
  }

  /* ── 7. THE CLIENT SUPPLIES ONE MEMBERSHIP ID, AND NOTHING ELSE ──────────── */
  {
    const switchBody = sessionCode.match(/export async function switchTenantForSession[\s\S]*?\n\}/)![0]!;
    const inputShape = switchBody.match(/input:\s*\{[\s\S]*?\},/)![0]!;
    for (const forged of [
      "tenantId", "userId", "actorId", "actorType", "roleId",
      "membershipVersion", "status", "authIdentityId", "sessionContextId",
    ]) {
      assert.ok(
        !new RegExp(`readonly ${forged}\\b`).test(inputShape.replace(/membershipId/g, "")),
        `the client must not be able to supply ${forged}`,
      );
    }
    assert.match(codeOf(read(ACTIONS)), /export async function switchWorkspaceAction\(input: \{\n\s*membershipId: string;\n\}\)/);
    assert.match(SWITCH_RULE.clientMaySupply, /one membership id, and nothing else/);
    for (const banned of SWITCH_RULE.clientMayNotSupply) {
      assert.ok(typeof banned === "string" && banned.length > 0);
    }
    /* The card sends the id and nothing else. */
    assert.match(cardCode, /switchWorkspaceAction\(\{ membershipId: selected \}\)/);
  }

  /* ── 8. NO WRITER FOR ANYTHING THIS PHASE DOES NOT OWN ───────────────────── */
  {
    const surface = [CONTRACTS, CARD, SURFACE, ACTIONS].map((f) => codeOf(read(f))).join("\n");
    const switchBody = sessionCode.match(/export async function switchTenantForSession[\s\S]*?\n\}/)![0]!;
    for (const forbidden of [
      "insert(memberships)", "update(memberships)", "delete(memberships)",
      "insert(roles)", "update(roles)",
      "insert(authCredentials)", "insert(authIdentities)", "insert(users)",
      "insert(invitations)", "update(invitations)",
      "insert(membershipAuthorizations)", "insert(identityEnrollmentRequests)",
      "insert(decisionRecords)", "insert(governanceSessions)",
      "resolveGovernanceAuthority", "writeGovernanceDecisionWithin",
      "knowledgeNodes", "providerConnectivityControls", "executions",
      "rolePermissions",
    ]) {
      assert.ok(
        !surface.includes(forbidden) && !switchBody.includes(forbidden),
        `tenant switching must not reference ${forbidden}`,
      );
    }
    for (const forbidden of [
      "nodemailer", "smtp", "resend", "sendgrid", "sendMail",
      "oidc", "saml", "passkey", "webauthn", "totp",
      "resetPassword", "recoverAccount",
      "childProcess", "execFileSync",
    ]) {
      assert.ok(
        !new RegExp(forbidden, "i").test(surface) && !new RegExp(forbidden, "i").test(switchBody),
        `tenant switching must not reference ${forbidden}`,
      );
    }
    for (const claim of [
      "does not create a membership",
      "does not let you enter a workspace you do not belong to",
      "does not extend how long your sign-in lasts",
    ]) {
      assert.ok(TENANT_SWITCH_NON_EFFECTS.includes(claim), `the contract must state: ${claim}`);
    }
  }

  /* ── 9. NO AUDIT SEMANTICS WERE INVENTED ─────────────────────────────────── */
  {
    /*
     * Session authority has never written an audit row — not for sign-in, not for selection, not for
     * sign-out. Inventing one here purely for symmetry would be a new durable artifact this phase has
     * no authority to define. The transition's record is session-native: the spent row keeps its
     * tenant and gains a reason, and the fresh row records what it was issued for.
     */
    const authRuntime = collect("src/features/auth-runtime").map((f) => codeOf(read(f))).join("\n");
    for (const sink of ["auditLog", "audit_log", "recordKnowledgeMutation", "recordMembershipCreated"]) {
      assert.ok(!authRuntime.includes(sink), `Session authority must not write ${sink}`);
    }
    assert.ok(
      !codeOf(read(CONTRACTS)).includes("auditLog"),
      "and its contracts must not promise an audit trail it does not write",
    );
    /* The reason is what makes the transition legible, so it must be spelled exactly once. */
    assert.match(sessionCode, /"tenant-switched"/);
  }

  /* ── 10. ROUTE BOUNDARY: the switcher lives INSIDE the protected dashboard ─ */
  {
    const middleware = read("src/middleware.ts");
    assert.match(
      middleware,
      /const PUBLIC_PREFIXES = \["\/login"\];/,
      "the public prefix list must be UNCHANGED",
    );
    assert.ok(
      SURFACE.startsWith("src/app/(dashboard)/"),
      "the switcher must live beneath the authoritative dashboard gate, not beneath /login",
    );
    /* The dashboard gate still refuses anything that is not authorized. */
    assert.match(
      read("src/app/(dashboard)/layout.tsx"),
      /if \(result\.status !== "authorized"\) \{\n\s*redirect\("\/login"\);/,
      "the gate that protects the switcher is unchanged",
    );
    /* No page beneath /login may reach the switching path. */
    const publicPages = collect("src/app/login").filter((f) => /\.tsx$/.test(f));
    for (const file of publicPages) {
      assert.ok(
        !/switchWorkspaceAction|switchTenantForSession/.test(read(file)),
        `${file}: a public page must not reach post-login switching`,
      );
    }
    assert.ok(
      !/switchWorkspaceAction|switchTenantForSession/.test(read(PICKER_PAGE)),
      "the sign-in picker must not reach post-login switching",
    );
    /* Exactly one surface offers it. */
    const surfaces = collect("src/app").filter((f) => /page\.tsx$/.test(f));
    const switchers = surfaces.filter((f) => /switchWorkspaceAction|WorkspaceSwitchCard/.test(read(f)));
    assert.deepEqual(
      switchers, [SURFACE],
      "exactly one surface offers workspace switching — no parallel workspace manager",
    );
  }

  /* ── 11. THE CARD PROMISES NOTHING IT CANNOT DO ──────────────────────────── */
  {
    assert.match(card, /Change workspace/, "the instruction's own wording, and the repository's");
    for (const forbidden of [
      /create workspace/i, /new organization/i, /invite/i, /grant/i,
      /join tenant/i, /add member/i, /leave workspace/i, /manage/i,
    ]) {
      assert.ok(!forbidden.test(cardCode), `the card must not offer — matched ${forbidden}`);
    }
    /* It renders only what the server derived, and fetches nothing itself. */
    assert.match(card, /workspaces\.map\(\(workspace\) => \{/);
    assert.ok(
      !/fetch\(|useEffect/.test(card),
      "the list is a prop from a server component, never fetched by the client",
    );
    /* It says where the human is, rather than hiding it. */
    assert.match(card, /Current workspace/);
    assert.match(card, /currentMembershipId/);
    /* Accessibility. */
    assert.match(card, /<fieldset/, "the choice is a real fieldset");
    assert.match(card, /<legend className="sr-only">/, "with a legend");
    assert.match(card, /type="radio"/, "real radios, not clickable divs");
    assert.match(card, /<label/, "each option has a real label");
    assert.match(card, /role="alert"/, "refusals are announced");
    assert.match(card, /role="status"/, "the pending transition is announced");
    assert.match(card, /aria-hidden/, "decorative icons are hidden from assistive technology");
    assert.ok(
      !/className="[^"]*text-(green|red)-/.test(card),
      "state must be carried by words, not raw colour utilities",
    );
    /* Every refusal has wording. */
    for (const key of [
      "no-active-session", "membership-unavailable", "already-active",
      "switch-superseded", "unavailable",
    ]) {
      assert.ok(
        new RegExp(`("${key}"|\\b${key})\\s*:`).test(cardCode),
        `the card must have wording for ${key}`,
      );
    }
    /* One workspace means the control says so instead of rendering a dead chooser. */
    assert.match(card, /workspaces\.length < 2/);
    assert.match(card, /nothing to change to/);
    /* Non-effects are rendered from frozen values. */
    assert.match(card, /TENANT_SWITCH_NON_EFFECTS\.map/);
    /* What is NOT built is stated, not implied. */
    assert.equal(CONCURRENT_WORKSPACES.implemented, false);
    assert.match(CONCURRENT_WORKSPACES.reachableToday, /one workspace at a time per browser/);
  }

  /* ── 12. SERVER-ONLY MODULES STAY SERVER-ONLY ────────────────────────────── */
  {
    const clientFiles = [...collect("src/components"), ...collect("src/app")].filter((file) =>
      /^\s*["']use client["']/m.test(read(file)),
    );
    assert.ok(clientFiles.includes(CARD), "the card is a client component");
    for (const file of clientFiles) {
      const src = read(file);
      for (const serverModule of [
        "auth-runtime/session-service.server",
        "auth-runtime/identity-repository.server",
        "auth-runtime/request-session.server",
      ]) {
        assert.ok(
          !src.includes(serverModule),
          `${file}: a client component must not import ${serverModule}`,
        );
      }
    }
    /* `contracts.ts` is importable by the client because it is pure. */
    const contracts = codeOf(read(CONTRACTS));
    for (const forbidden of ["drizzle-orm", "@/db/", "node:crypto", "process.env", "async function"]) {
      assert.ok(!contracts.includes(forbidden), `contracts.ts must stay pure — found ${forbidden}`);
    }
  }

  console.log("PASS post-login tenant switching boundaries and firewall");
}

main();
