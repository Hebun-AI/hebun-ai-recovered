/*
 * Onboarding entry — structural boundaries around the PUBLIC surface.
 *
 * The runtime this surface calls was already proved by I1.2 and I2. These assertions are about the
 * surface itself, and every one of them is a claim about what does NOT exist:
 *
 *   - the dashboard did not become public, and `PUBLIC_PREFIXES` was not widened for one page
 *   - no bearer secret can arrive in, or leave through, a URL
 *   - the continuation reference never reaches the browser's JavaScript
 *   - the surface owns no authority: no schema import, no write, no second validator
 *   - nothing is disclosed to an unproved bearer — not the tenant, not the address, not the role
 *   - no wording claims a delivery or a verification that Hebun does not perform
 *
 * Runtime behaviour for the read seam lives in `read-seam-postgres.ts`; the four consumption
 * authorities are proved by `tests/i2-flow/onboarding-postgres.ts`.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  CONTINUATION_CUSTODY,
  ENROLLMENT_CONTINUATION_COOKIE_NAME,
  ENROLLMENT_CONTINUATION_COOKIE_PATH,
  ENROLLMENT_CONTINUATION_TTL_SECONDS,
  continuationCookieOptions,
} from "../../src/features/identity-enrollment/continuation-cookie";
import { SESSION_COOKIE_NAME } from "../../src/features/auth-runtime/session-cookie";
import { INVITATION_LIFETIME_HOURS } from "../../src/features/human-onboarding/contracts";
import { ONBOARDING_ENTRY_WORDING } from "../../src/components/auth/onboarding-entry-wording";
import { PENDING_ENROLLMENT_WORDING } from "../../src/components/governance-authority/pending-enrollment-wording";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

/** Source with comments stripped: assertions are about CODE, not about what prose discusses. */
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

const PAGE = "src/app/login/join/page.tsx";
const ACTIONS = "src/app/login/onboarding-actions.ts";
const CARD = "src/components/auth/onboarding-entry-card.tsx";
const WORDING = "src/components/auth/onboarding-entry-wording.ts";
const COOKIE = "src/features/identity-enrollment/continuation-cookie.ts";
const READ_SEAM = "src/features/identity-enrollment/read-pending-enrollments.server.ts";
const APPROVAL_CARD = "src/components/governance-authority/pending-enrollment-card.tsx";

function main(): void {
  const page = read(PAGE);
  const actions = read(ACTIONS);
  const card = read(CARD);
  const cookie = read(COOKIE);
  const readSeam = read(READ_SEAM);
  const approvalCard = read(APPROVAL_CARD);

  /* ── 1. ROUTE BOUNDARY: the dashboard did not become public ─────────────── */
  {
    const middleware = read("src/middleware.ts");
    assert.match(
      middleware,
      /const PUBLIC_PREFIXES = \["\/login"\];/,
      "the public prefix list must be UNCHANGED — the entry surface lives under /login on purpose",
    );
    assert.ok(
      PAGE.startsWith("src/app/login/"),
      "the entry surface must live beneath the existing public prefix",
    );
    /*
     * NO PARAMETER, so nothing on this page can be aimed at somebody else's onboarding and no
     * capability can arrive in a URL where history and access logs would keep it.
     */
    assert.ok(
      !/searchParams|params\./.test(codeOf(page)),
      "the page takes no parameter",
    );
    assert.ok(
      !/redirect\([^)]*capability|capability[^)]*redirect\(/.test(codeOf(actions)),
      "no action may put a capability into a redirect",
    );
  }

  /* ── 2. NO PAGE REACHES THE ONBOARDING MUTATION PATH ────────────────────── */
  {
    /*
     * The same rule I2 enforces, and narrowed with it. Banning the string `human-onboarding` from
     * every page was a proxy: a server page legitimately imports READ seams, and the revocation
     * phase added one there. What must stay true is that no page reaches an act — pages compose,
     * components and actions call.
     */
    const surfaces = collect("src/app")
      .filter((f) => /page\.tsx$/.test(f))
      .filter((f) => {
        const src = read(f);
        return (
          src.includes("human-onboarding/issue-invitation.server") ||
          src.includes("human-onboarding/accept-invitation.server") ||
          src.includes("human-onboarding/revoke-invitation.server") ||
          /issueInvitationAction|revokeInvitationAction/.test(src)
        );
      });
    assert.deepEqual(surfaces, [], "no page reaches the onboarding mutation path");
  }

  /* ── 3. THE CONTINUATION REFERENCE NEVER REACHES THE BROWSER ────────────── */
  {
    /*
     * The single most important property of this surface. Act 1 mints the reference; the server puts
     * it in an httpOnly cookie; the ACTION RESULT must not carry it, or every protection the cookie
     * provides would be undone by handing the value to page script anyway.
     */
    assert.ok(
      !/continuationReference:\s*result\.continuationReference/.test(actions),
      "an action must never return the continuation reference to the client",
    );
    assert.match(
      actions,
      /status:\s*"started"\s*\}/,
      "Act 1 returns a status and nothing else",
    );
    assert.equal(CONTINUATION_CUSTODY.shownToTheHuman, false);
    /*
     * CODE, not prose. These modules NAME localStorage and sessionStorage in their headers in order
     * to say they are not used, and a scan that treated an honest denial as a violation would push
     * the phase toward hiding its own limits.
     */
    for (const forbidden of ["localStorage", "sessionStorage", "document.cookie"]) {
      for (const [label, source] of [
        [CARD, card],
        [ACTIONS, actions],
        [PAGE, page],
      ] as const) {
        assert.ok(
          !codeOf(source).includes(forbidden),
          `${label}: the receipt must not be held in ${forbidden}`,
        );
      }
    }
    assert.deepEqual(
      [...CONTINUATION_CUSTODY.neverIn].sort(),
      [
        "a URL or query parameter",
        "any server log",
        "localStorage",
        "sessionStorage",
        "the audit log",
        "the page's JavaScript",
      ],
      "the custody statement names every place the reference must not be",
    );
  }

  /* ── 4. THE RECEIPT COOKIE IS SHAPED LIKE A SECRET ──────────────────────── */
  {
    const options = continuationCookieOptions(ENROLLMENT_CONTINUATION_TTL_SECONDS, true);
    assert.equal(options.httpOnly, true, "page script must not be able to read it");
    assert.equal(options.sameSite, "lax");
    assert.equal(options.secure, true, "a production deployment must not send it in clear");
    assert.equal(
      options.path,
      ENROLLMENT_CONTINUATION_COOKIE_PATH,
      "scoped to the one route that uses it, so no other handler receives it",
    );
    assert.equal(options.path, "/login/join");
    assert.equal(options.maxAge, ENROLLMENT_CONTINUATION_TTL_SECONDS);
    /* Never negative, whatever it is handed. */
    assert.equal(continuationCookieOptions(-1, true).maxAge, 0);

    /*
     * IT IS NOT THE SESSION COOKIE. Two meanings must never share one name, or a bearer's receipt
     * would be read on a path that expects a session reference.
     */
    assert.notEqual(ENROLLMENT_CONTINUATION_COOKIE_NAME, SESSION_COOKIE_NAME);

    /* SHORTER THAN THE CAPABILITY IT CONTINUES — a receipt that outlives every ceremony is litter. */
    assert.ok(
      ENROLLMENT_CONTINUATION_TTL_SECONDS < INVITATION_LIFETIME_HOURS * 3600,
      "the receipt must expire before the invitation's own window closes",
    );

    /* Isomorphic: no next/headers here, for the same reason `session-cookie.ts` avoids it. */
    assert.ok(
      !codeOf(cookie).includes("next/headers"),
      "the cookie contract stays edge- and test-safe",
    );
    assert.ok(!codeOf(cookie).includes("drizzle-orm"), "the cookie contract owns no persistence");
  }

  /* ── 5. THE SURFACE OWNS NO AUTHORITY ───────────────────────────────────── */
  {
    /*
     * A request boundary resolves configuration and delegates. It must not become a second place
     * where onboarding rules live: no schema, no query builder, no write, no digest.
     */
    const actionCode = codeOf(actions);
    for (const forbidden of [
      "@/db/schema",
      "@/db/client.server",
      "drizzle-orm",
      "digestInvitationToken",
      "digestContinuationReference",
      "node:crypto",
      ".insert(",
    ]) {
      assert.ok(
        !actionCode.includes(forbidden),
        `the public boundary must not contain ${forbidden} — it delegates, it does not decide`,
      );
    }
    /*
     * Without a schema, a client and a query builder there is no durable write this file could
     * perform. The only mutation it makes is to a cookie, and that is asserted rather than assumed:
     * every `.delete(` and `.set(` here is the cookie store, never a table.
     */
    for (const mutation of actionCode.match(/\w+\.(delete|set|update)\(/g) ?? []) {
      assert.match(
        mutation,
        /^store\.(delete|set)\($/,
        `the only thing this boundary mutates is the cookie store — found ${mutation}`,
      );
    }
    /* It calls the authorities that already exist, and names them. */
    for (const authority of [
      "startIdentityEnrollment",
      "completeIdentityEnrollment",
      "acceptInvitation",
    ]) {
      assert.ok(actions.includes(authority), `the boundary must call ${authority}`);
    }
    /* The digest key is resolved from the environment, exactly as issuance does. */
    assert.match(actions, /getAuthEnvironment\(\)/);
    assert.match(actions, /env\.sessionDigestCurrentKey/);
    assert.ok(
      !actionCode.includes("process.env"),
      "configuration is read through the auth environment, never directly",
    );
  }

  /* ── 6. NOTHING IS LOGGED ────────────────────────────────────────────────── */
  {
    for (const [label, source] of [
      [ACTIONS, actions],
      [PAGE, page],
      [CARD, card],
      [READ_SEAM, readSeam],
    ] as const) {
      assert.ok(
        !/console\.(log|info|warn|error|debug)/.test(codeOf(source)),
        `${label}: a surface handling bearer secrets must not log`,
      );
    }
  }

  /* ── 7. CLIENT COMPONENTS CARRY NO AUTHORITY VOCABULARY ─────────────────── */
  {
    const clientFiles = [...collect("src/components"), ...collect("src/app")].filter((file) =>
      /^\s*["']use client["']/m.test(read(file)),
    );
    assert.ok(clientFiles.includes(CARD), "the entry card really is a client component");
    assert.ok(clientFiles.includes(APPROVAL_CARD), "the approval card really is a client component");
    for (const file of clientFiles) {
      const source = read(file);
      assert.ok(
        !/identity-enrollment/.test(source),
        `${file}: a client component must not import the enrollment authority`,
      );
      for (const serverModule of [
        "human-onboarding/issue-invitation.server",
        "human-onboarding/accept-invitation.server",
      ]) {
        assert.ok(
          !source.includes(serverModule),
          `${file}: a client component must not import ${serverModule}`,
        );
      }
    }
    /* Which is only possible because the wording is built on the server and passed in. */
    assert.match(card, /wording\.startRefusals/);
    assert.match(card, /wording\.completionRefusals/);
    assert.match(card, /wording\.acceptanceRefusals/);
    assert.match(approvalCard, /wording\.refusals/);
  }

  /* ── 8. NOTHING IS DISCLOSED TO AN UNPROVED BEARER ──────────────────────── */
  {
    /*
     * The reader of this surface may be a thief holding a capability meant for somebody else. The
     * page must never name the organization, the invited address or the intended role.
     */
    for (const forbidden of [
      /tenantName/,
      /normalizedEmail/,
      /intendedRole/,
      /roleName/,
      /organization\s*:/,
    ]) {
      assert.ok(
        !forbidden.test(codeOf(page)) && !forbidden.test(codeOf(card)),
        `the public surface must not render ${forbidden}`,
      );
    }
    /* The read seam behind the approver's card returns no address either. */
    assert.ok(
      !codeOf(readSeam).includes("normalizedEmail"),
      "the approver correlates timing, not identity",
    );
    assert.ok(
      !codeOf(readSeam).includes("continuationHash"),
      "the bearer's half of the ceremony has no reader",
    );
    assert.ok(
      !/\.insert\(|\.update\(|\.delete\(/.test(codeOf(readSeam)),
      "a read seam reads",
    );
    assert.match(readSeam, /resolveGovernanceAuthority/, "and it is authority-gated");
  }

  /* ── 9. NO DELIVERY CLAIM, NO VERIFICATION CLAIM ────────────────────────── */
  {
    for (const [label, source] of [
      [PAGE, page],
      [CARD, card],
      [WORDING, read(WORDING)],
      [APPROVAL_CARD, approvalCard],
    ] as const) {
      for (const forbidden of [
        /email(ed)? sent/i,
        /invitation sent/i,
        /we(&rsquo;| )?ve emailed/i,
        /check your (inbox|email)/i,
        /verified your email/i,
        /email verification/i,
        /confirm your email address/i,
      ]) {
        assert.ok(
          !forbidden.test(source),
          `${label}: must not claim a delivery or a verification — matched ${forbidden}`,
        );
      }
    }
    /* And it says the true thing instead. */
    assert.match(card, /Hebun did not send it and cannot resend it/);
    assert.match(
      PENDING_ENROLLMENT_WORDING.whatItDoesNotProve,
      /did not verify anyone's email address/,
    );
  }

  /* ── 10. THE REFUSAL VOCABULARY IS TOTAL, AND STAYS MERGED ──────────────── */
  {
    /*
     * `Record<Union, string>` already makes these total at compile time. What a test adds is the
     * ONE rule a type cannot express: the runtime deliberately collapses every authentication-shaped
     * failure into `not-acceptable`, and a helpful surface must not split it apart again.
     */
    const acceptance = ONBOARDING_ENTRY_WORDING.acceptanceRefusals;
    assert.ok(acceptance["not-acceptable"], "the merged refusal has a sentence");
    for (const leak of [/password/i, /email address/i, /account/i, /locked/i, /exist/i]) {
      assert.ok(
        !leak.test(acceptance["not-acceptable"]!),
        `the merged refusal must not hint at which case occurred — matched ${leak}`,
      );
    }
    for (const table of [
      ONBOARDING_ENTRY_WORDING.startRefusals,
      ONBOARDING_ENTRY_WORDING.completionRefusals,
      acceptance,
      PENDING_ENROLLMENT_WORDING.refusals,
    ]) {
      assert.ok(Object.keys(table).length > 0);
      for (const [reason, sentence] of Object.entries(table)) {
        assert.ok(sentence.trim().length > 0, `${reason} must have a real sentence`);
      }
    }
    /* The surface's own reason for the one case no authority owns. */
    assert.ok(
      ONBOARDING_ENTRY_WORDING.completionRefusals["no-continuation-receipt"],
      "a browser with no receipt gets an honest sentence rather than a generic failure",
    );
  }

  /* ── 11. MEMBERSHIP STILL HAS EXACTLY ONE PRODUCTION WRITER ─────────────── */
  {
    const writers = collect("src/features")
      .concat(collect("src/app"))
      .filter((file) => /\.insert\(memberships\)/.test(read(file)));
    assert.deepEqual(
      writers,
      ["src/features/human-onboarding/accept-invitation.server.ts"],
      "the entry surface calls the membership writer; it did not become one",
    );
  }

  console.log("PASS onboarding entry boundaries and firewall");
}

main();
