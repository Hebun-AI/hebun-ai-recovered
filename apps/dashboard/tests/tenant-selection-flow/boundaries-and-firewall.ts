/*
 * Tenant Selection — structural boundaries.
 *
 * These prove claims about what does NOT exist: no membership/role/credential/identity writer, no
 * second Governance resolver, no schema change, no weakening of `authorized`, no tenant switcher,
 * no client-supplied authority, and a picker whose wording promises nothing it cannot do.
 *
 * Runtime behaviour lives in `selection-postgres.ts`.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  PRE_TENANT_RECEIPT,
  SELECTION_RULE,
  POST_LOGIN_SWITCHING,
  TENANT_SELECTION_NON_EFFECTS,
} from "../../src/features/tenant-selection/contracts";
import { PRE_TENANT_SESSION_TTL_SECONDS, SESSION_ABSOLUTE_TTL_SECONDS } from "../../src/features/auth-runtime/session-service.server";

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
const CONTRACTS = "src/features/tenant-selection/contracts.ts";
const CARD = "src/components/auth/workspace-selection-card.tsx";
const PAGE = "src/app/login/select-workspace/page.tsx";
const LOGIN_ACTIONS = "src/app/login/actions.ts";

function main(): void {
  const session = read(SESSION);
  const sessionCode = codeOf(session);
  const repoCode = codeOf(read(REPO));
  const card = read(CARD);
  const page = read(PAGE);

  /* ── 1. NO SCHEMA CHANGE ─────────────────────────────────────────────────── */
  {
    /*
     * Stated against this phase's own boundary, not a global count. Filenames are timestamp-prefixed,
     * so a lexical comparison is chronological: the 23 migrations that existed when tenant selection
     * closed must all still be there, and none of them may be this phase's. A later authorized phase
     * adding its own migration must not falsify a claim that was never about it.
     */
    const migrations = readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) =>
      f.endsWith(".sql"),
    );
    const throughSelection = migrations.filter(
      (f) => f <= "20260812130555_i1_2_identity_enrollment.sql",
    );
    assert.equal(
      throughSelection.length, 23,
      "the 23 migrations that existed when tenant selection closed are intact",
    );
    assert.equal(
      migrations.filter((f) => /tenant.?select|workspace/i.test(f)).length, 0,
      "tenant selection adds no migration — no selection-named migration exists, then or since",
    );
    for (const file of [CONTRACTS, CARD, PAGE]) {
      assert.ok(!codeOf(read(file)).includes("pgTable("), `${file} must not define a table`);
    }
    /*
     * The pre-tenant row is legal because the CHECK has always permitted it. Asserted against the
     * schema so a future edit that tightens it fails here rather than in production.
     */
    const schema = read("src/db/schema/user-session-context.ts");
    assert.match(
      schema,
      /\(\$\{t\.activeTenantId\} is null\) = \(\$\{t\.activeMembershipId\} is null\)/,
      "both-NULL must stay a legal session shape",
    );
    assert.match(
      schema,
      /activeTenantId: uuid\("active_tenant_id"\)\.references/,
      "and the column must stay nullable",
    );
  }

  /* ── 2. `authorized` IS UNCHANGED ────────────────────────────────────────── */
  {
    /* Every check the resolver made before still runs, in the same order, for a tenant-bound row. */
    for (const invariant of [
      'if (row.identityStatus !== "active") return forbidden("identity");',
      'if (row.userLifecycleStatus !== "active") return forbidden("user");',
      "row.sessionMembershipVersion !== row.membershipCurrentVersion",
      'return forbidden("membership");',
      'return forbidden("tenant");',
    ]) {
      assert.ok(sessionCode.includes(invariant), `the resolver must still enforce: ${invariant}`);
    }
    /* An authorized result is still built only through the integrity gate. */
    assert.match(sessionCode, /createAuthorizedAuthenticationResult\(/);
    /* The one-membership path still goes through the function every existing test asserts. */
    assert.match(
      sessionCode,
      /const membership = await findPrimaryActiveMembership\(db, identity\.userId\);/,
      "single-membership sign-in must keep using findPrimaryActiveMembership",
    );
    /* A pre-tenant row can never become authorized: assembleAuthorized is not reachable from it. */
    const preTenantBlock = sessionCode.match(
      /if \(!row\.activeTenantId \|\| !row\.activeMembershipId\) \{[\s\S]*?\n  \}/,
    );
    assert.ok(preTenantBlock, "the pre-tenant branch exists");
    assert.ok(
      !/assembleAuthorized|authorized/.test(preTenantBlock![0]!.replace(/tenant-selection-required/g, "")),
      "the pre-tenant branch must never produce an authorized result",
    );
  }

  /* ── 3. A PRE-TENANT RECEIPT IS SHORT-LIVED AND INERT ────────────────────── */
  {
    assert.ok(
      PRE_TENANT_SESSION_TTL_SECONDS < SESSION_ABSOLUTE_TTL_SECONDS,
      "a half-finished sign-in must not live as long as a working session",
    );
    assert.ok(PRE_TENANT_SESSION_TTL_SECONDS <= 15 * 60, "and should be minutes, not hours");
    assert.match(PRE_TENANT_RECEIPT.grants, /nothing/);
    assert.match(PRE_TENANT_RECEIPT.reaches, /only the workspace picker/);
    /*
     * AND THE CARD COMPOSES THAT VOCABULARY — it does not print it bare.
     *
     * `grants` is the noun phrase "nothing — no tenant, no membership, …" and `diesWhen` is the
     * clause "a workspace is chosen, or it expires". Both are correct values, so the two assertions
     * directly above passed while the only call site rendered "This sign-in step nothing" and "It a
     * workspace is chosen, or it expires" to the first human ever to sign in to production. A
     * vocabulary test cannot catch a sentence defect; this pins the verbs at the seam where the
     * fragments become prose.
     */
    const receiptSentence = codeOf(read(CARD));
    assert.match(
      receiptSentence,
      /step grants \{PRE_TENANT_RECEIPT\.grants\}/,
      "the `grants` phrase must be introduced by its verb at the call site",
    );
    assert.match(
      receiptSentence,
      /It ends when \{PRE_TENANT_RECEIPT\.diesWhen\}/,
      "the `diesWhen` clause must be introduced by its verb at the call site",
    );
    /* `resolveTenantContext` still returns non-null only for `authorized`. */
    assert.match(
      codeOf(read(REQUEST)),
      /result\.status === "authorized" \? result\.tenantContext : null/,
      "no non-authorized status may yield a TenantContext",
    );
  }

  /* ── 4. SELECTION IS NOT AUTHORIZATION — REVALIDATION IS ─────────────────── */
  {
    assert.match(
      repoCode,
      /and\(eq\(memberships\.id, membershipId\), eq\(memberships\.userId, userId\)\)/,
      "the chosen membership is matched by id AND by the authenticated human",
    );
    /* Lifecycle is re-checked from the row just read, not from anything remembered. */
    for (const check of [
      'row.membershipStatus !== "active"',
      'row.membershipLifecycleStatus !== "active"',
      "row.membershipRevokedAt !== null",
      "row.roleId === null",
    ]) {
      assert.ok(repoCode.includes(check), `revalidation must re-check ${check}`);
    }
    /* The tenant's own posture is re-checked at issuance. */
    assert.match(sessionCode, /membership\.companyAuthenticationDisabled/);
    assert.match(sessionCode, /ACTIVE_TENANT_STATUSES\.has\(membership\.companyTenantStatus\)/);
    /* The version written is the one just read. */
    assert.match(
      sessionCode,
      /membershipVersion: membership\.membershipVersion,/,
      "the session carries the version read at issuance, never a remembered one",
    );
    assert.match(SELECTION_RULE.selectionIsNotAuthorization, /re-read by id AND by the authenticated user_id/);
  }

  /* ── 5. A FRESH SESSION, NEVER A MUTATED ONE ─────────────────────────────── */
  {
    /*
     * The only session writers remain: insert, activity touch, revoke.
     *
     * Compared as a SET of shapes rather than a list, because post-login switching added a second
     * revoke writer (`revokeSessionIfActive`, conditional on the row still being live). The invariant
     * being protected is what a writer may SET, not how many writers exist — a third distinct shape
     * would still fail here, which is the thing that matters.
     */
    const updates = [...repoCode.matchAll(/\.update\(userSessionContexts\)\s*\.set\(\{([^}]*)\}/g)].map(
      (m) => m[1]!.replace(/\s+/g, " ").trim(),
    );
    assert.deepEqual(
      [...new Set(updates)].sort(),
      ["lastActivityAt, inactivityExpiresAt", "revokedAt, revocationReason"].sort(),
      "no writer may change a session's tenant or membership after issuance",
    );
    assert.match(sessionCode, /const sessionContextId = await insertSessionContext\(db, \{/);
    assert.match(
      sessionCode,
      /await revokeSession\(db, current\.sessionContextId, now, "tenant-selected"\)/,
      "the pre-tenant receipt is revoked, not rewritten",
    );
    assert.match(sessionCode, /const nextReference = generateSessionReference\(\);/);
    assert.match(SELECTION_RULE.issuance, /FRESH tenant-bound session/);
  }

  /* ── 6. THE CLIENT SUPPLIES ONE MEMBERSHIP ID, AND NOTHING ELSE ──────────── */
  {
    const inputShapes = [sessionCode, codeOf(read(LOGIN_ACTIONS))]
      .join("\n")
      .match(/input:\s*\{[\s\S]*?\},/g)!
      .join("\n");
    for (const forged of [
      "tenantId", "userId", "actorId", "actorType", "roleId",
      "membershipVersion", "status", "authIdentityId", "sessionContextId",
    ]) {
      assert.ok(
        !new RegExp(`readonly ${forged}\\b|\\b${forged}:\\s*string`).test(
          inputShapes.replace(/membershipId/g, ""),
        ),
        `the client must not be able to supply ${forged}`,
      );
    }
    assert.match(codeOf(read(LOGIN_ACTIONS)), /membershipId: string/);
    for (const banned of SELECTION_RULE.clientMayNotSupply) {
      assert.ok(typeof banned === "string" && banned.length > 0);
    }
    assert.match(SELECTION_RULE.clientMaySupply, /one membership id, and nothing else/);
  }

  /* ── 7. NO WRITER FOR ANYTHING THIS PHASE DOES NOT OWN ───────────────────── */
  {
    const surface = [SESSION, CONTRACTS, CARD, PAGE, LOGIN_ACTIONS]
      .map((f) => codeOf(read(f)))
      .join("\n");
    for (const forbidden of [
      "insert(memberships)", "update(memberships)", "delete(memberships)",
      "insert(roles)", "update(roles)",
      "insert(authCredentials)", "insert(authIdentities)", "insert(users)",
      "insert(invitations)", "update(invitations)",
      "insert(decisionRecords)", "insert(governanceSessions)",
      "resolveGovernanceAuthority", "writeGovernanceDecisionWithin",
      "knowledgeNodes", "providerConnectivityControls", "executions",
      "permissions", "rolePermissions",
    ]) {
      assert.ok(
        !surface.includes(forbidden),
        `tenant selection must not reference ${forbidden}`,
      );
    }
    /* Nor any of the capabilities it does not have. */
    for (const forbidden of [
      "nodemailer", "smtp", "resend", "sendgrid", "sendMail",
      "oidc", "saml", "passkey", "webauthn", "totp",
      "resetPassword", "recoverAccount",
      "computer-use", "terminal", "childProcess", "execFileSync",
    ]) {
      assert.ok(
        !new RegExp(forbidden, "i").test(surface),
        `tenant selection must not reference ${forbidden}`,
      );
    }
  }

  /* ── 8. THE CANDIDATE READER IS A READ, AND IS THIN ──────────────────────── */
  {
    /* The two membership readers share the exact predicate and ordering. */
    const primary = repoCode.match(/export async function findPrimaryActiveMembership[\s\S]*?\n\}/)![0]!;
    const all = repoCode.match(/export async function findActiveMemberships[\s\S]*?\n\}/)![0]!;
    for (const predicate of [
      'eq(memberships.status, "active")',
      'eq(memberships.lifecycleStatus, "active")',
      "isNull(memberships.revokedAt)",
      "asc(memberships.createdAt), asc(memberships.id)",
    ]) {
      assert.ok(primary.includes(predicate), `findPrimaryActiveMembership uses ${predicate}`);
      assert.ok(all.includes(predicate), `findActiveMemberships uses the SAME ${predicate}`);
    }
    assert.ok(primary.includes(".limit(1)"), "the primary reader keeps its LIMIT 1");
    assert.ok(!all.includes(".limit("), "the list reader has no limit");

    /* The candidate shape carries nothing authority-bearing. */
    const candidate = repoCode.match(/export interface TenantCandidate \{[\s\S]*?\n\}/)![0]!;
    for (const forbidden of ["roleId", "membershipVersion", "authorityScope", "governance"]) {
      assert.ok(!candidate.includes(forbidden), `a candidate must not carry ${forbidden}`);
    }
    assert.match(SELECTION_RULE.candidatesAre, /derived server-side/);
  }

  /* ── 9. ROUTE BOUNDARY: the dashboard did not become public ──────────────── */
  {
    const middleware = read("src/middleware.ts");
    /*
     * The pin is on the CONTENT of the list, not on its length. `/privacy` and `/terms` were
     * added for the public legal notices — documents, not product surfaces — so the assertion
     * names the exact permitted set and, separately, the property that actually matters here: not
     * one entry is a dashboard route. Widening it to any surface under `(dashboard)` still fails.
     */
    const prefixes = middleware.match(/const PUBLIC_PREFIXES = \[([^\]]*)\];/)![1]!
      .split(",")
      .map((entry) => entry.trim().replace(/^"|"$/g, ""))
      .filter((entry) => entry.length > 0);
    assert.deepEqual(
      prefixes,
      ["/login", "/privacy", "/terms"],
      "the public prefix list is closed at the sign-in flow and the public legal notices",
    );
    for (const prefix of prefixes) {
      assert.ok(
        !existsSync(path.join(ROOT, `src/app/(dashboard)${prefix}`)),
        `${prefix} must not be a dashboard route — the dashboard did not become public`,
      );
    }
    assert.ok(
      PAGE.startsWith("src/app/login/"),
      "the picker must live beneath the existing public prefix",
    );
    /* And the page itself refuses without a receipt rather than relying on the edge. */
    assert.match(page, /readSelectableWorkspacesForRequest\(\)/);
    assert.match(page, /const tenant = await resolveTenantContext\(\);/);
    assert.match(page, /if \(tenant\) redirect\("\/foundation"\);/);
    assert.ok(
      !/searchParams|params\./.test(codeOf(page)),
      "the page takes no parameter, so nothing on it can be aimed at another account",
    );
  }

  /* ── 10. THE SIGN-IN PICKER IS STILL NOT A SWITCHER ──────────────────────── */
  {
    /*
     * Post-login switching now exists. It is a SEPARATE entry point, and this test asserts the thing
     * that had to stay true when it arrived: THIS one still refuses an already-authorized session.
     * `/login/select-workspace` lives beneath the one public route prefix, so a widened
     * `selectTenantForSession` would make a live session re-pointable from a public surface.
     */
    assert.equal(POST_LOGIN_SWITCHING.implemented, true);
    assert.match(POST_LOGIN_SWITCHING.implementedBy, /sibling entry point, not a widening/);
    assert.match(POST_LOGIN_SWITCHING.thisEntryPointStillRefuses, /tenant-bound receipt/);
    /* An already-authorized session is explicitly not a SELECTION context — unchanged. */
    assert.match(
      sessionCode,
      /current\.activeTenantId !== null \|\|\s*\n?\s*current\.activeMembershipId !== null/,
      "a tenant-bound receipt must be refused as a selection context",
    );
    /* And no surface reaches the SELECTION path except the picker page itself. */
    const surfaces = collect("src/app").filter((f) => /page\.tsx$/.test(f));
    const selectors = surfaces.filter(
      (f) => f !== PAGE && /selectWorkspaceAction|selectTenantForSession/.test(read(f)),
    );
    assert.deepEqual(selectors, [], "no other surface reaches the sign-in selection path");
    /* The picker's own surfaces must never CALL the switching path. */
    for (const file of [CARD, PAGE]) {
      assert.ok(
        !/switchTenantForSession|switchWorkspaceAction|tenant-switching/.test(codeOf(read(file))),
        `${file}: the sign-in picker must not reach the post-login switching path`,
      );
    }
    /*
     * `contracts.ts` NAMES the sibling — that is the record being kept honest, not a call. What it
     * must not do is depend on it, so the ban here is on the import, not on the word.
     */
    assert.ok(
      !/from "@\/features\/tenant-switching/.test(read(CONTRACTS)),
      "the selection contract may name the switching entry point, but must not import it",
    );
  }

  /* ── 11. THE PICKER PROMISES NOTHING IT CANNOT DO ────────────────────────── */
  {
    assert.match(card, /Choose workspace/, "repository-consistent wording");
    /*
     * Scanned over CODE, not prose. The card's header names Create/Join/Invite/Manage precisely to
     * say it offers none of them; treating that honest denial as a violation would push the file
     * toward hiding what it is not.
     */
    const cardCode = codeOf(card);
    for (const forbidden of [
      /create workspace/i, /new organization/i, /invite/i, /manage/i,
      /leave workspace/i, /settings/i, /switch/i, /add member/i,
    ]) {
      assert.ok(!forbidden.test(cardCode), `the picker must not offer — matched ${forbidden}`);
    }
    /* It renders only what the server derived. */
    assert.match(card, /workspaces\.map\(\(workspace\) => \(/);
    assert.ok(
      !/fetch\(|useEffect/.test(card),
      "the list is a prop from a server component, never fetched by the client",
    );
    /* Accessibility. */
    assert.match(card, /<fieldset/, "the choice is a real fieldset");
    assert.match(card, /<legend className="sr-only">/, "with a legend");
    assert.match(card, /type="radio"/, "real radios, not clickable divs");
    assert.match(card, /<label/, "each option has a real label");
    assert.match(card, /role="alert"/, "refusals are announced");
    assert.match(card, /role="status"/, "the pending transition is announced");
    assert.ok(
      !/className="[^"]*text-(green|red)-/.test(card),
      "state must be carried by words, not raw colour utilities",
    );
    /* Every refusal has wording. */
    /* Quoted or bare — a hyphenated key needs quotes, a plain one does not. */
    for (const key of ["no-selection-context", "membership-unavailable", "unavailable"]) {
      assert.ok(
        new RegExp(`("${key}"|\\b${key})\\s*:`).test(cardCode),
        `the picker must have wording for ${key}`,
      );
    }
    /* The zero-membership state is honest, not a fake error. */
    assert.match(card, /No workspace yet/);
    assert.match(card, /do not belong to a workspace yet/);
    /* Non-effects are rendered from frozen values. */
    assert.match(card, /TENANT_SELECTION_NON_EFFECTS\.map/);
    for (const claim of [
      "does not create a membership",
      "does not let you enter a workspace you do not belong to",
    ]) {
      assert.ok(TENANT_SELECTION_NON_EFFECTS.includes(claim), `the contract must state: ${claim}`);
    }
  }

  /* ── 12. SERVER-ONLY MODULES STAY SERVER-ONLY ────────────────────────────── */
  {
    const clientFiles = [...collect("src/components"), ...collect("src/app")].filter((file) =>
      /^\s*["']use client["']/m.test(read(file)),
    );
    assert.ok(clientFiles.length > 0);
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

  console.log("PASS tenant selection boundaries and firewall");
}

main();
