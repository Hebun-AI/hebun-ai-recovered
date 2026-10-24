/*
 * AUTH-EMAIL-OWNERSHIP-1 — structural boundaries (no DB, no network).
 *
 *   1. One writer per table: only the challenge authority writes `auth_email_challenges`, only the
 *      Identity authority writes the proof columns.
 *   2. The token never reaches a URL a server sees, a log, or a client render.
 *   3. Authentication mail reuses the ONE released transport and nothing else of external send:
 *      no permit, no recipient authority, no arming, no tenant, no second network primitive.
 *   4. The browser chooses nothing: requesting takes no input, confirming takes only the token.
 *   5. Opening the page changes nothing; the act is button-gated and the fragment is stripped.
 *   6. Signup schedules the request before any redirect, and never awaits mail.
 *   7. Genesis acceptance checks the proof INSIDE its atomic UPDATE.
 *   8. Heby cannot reach any of it.
 *
 * Assertions run over comment-stripped source; anything about a secret is asserted with string
 * literals stripped too, because prose and the thing it forbids are made of the same words.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const stripStrings = (source: string): string =>
  source
    .replace(/`(?:[^`\\]|\\.)*`/g, "``")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");
const collect = (dir: string): string[] =>
  readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    return e.isDirectory() ? (e.name === "migrations" ? [] : collect(rel)) : /\.tsx?$/.test(e.name) ? [rel] : [];
  });

const FEATURE_DIR = "src/features/auth-email-ownership";
const AUTHORITY = "src/features/auth-email-ownership/email-verification.server.ts";
const MAIL = "src/features/auth-email-ownership/auth-mail.server.ts";
const IDENTITY = "src/features/auth-runtime/identity-repository.server.ts";
const ACTIONS = "src/app/verify-email/actions.ts";
const PAGE = "src/app/verify-email/page.tsx";
const CONFIRM_UI = "src/components/auth/verify-email-confirm.tsx";
const NOTICE_UI = "src/components/auth/email-ownership-notice.tsx";
const REGISTER = "src/app/register/actions.ts";
const GENESIS = "src/features/governance-genesis/genesis-acceptance.server.ts";
const MIDDLEWARE = "src/middleware.ts";

const SRC_FILES = collect("src");
const FEATURE_FILES = collect(FEATURE_DIR);
const FEATURE_CODE = FEATURE_FILES.map((f) => codeOf(read(f))).join("\n");

/* ── 1 · ONE WRITER PER TABLE ─────────────────────────────────────────────── */
function oneWriterPerTable(): void {
  const challengeWriters = SRC_FILES.filter((f) => {
    const code = codeOf(read(f));
    return /\.(insert|update|delete)\(\s*authEmailChallenges\b/.test(code) || /(insert into|update|delete from)\s+auth_email_challenges/i.test(code);
  });
  assert.deepEqual(challengeWriters, [AUTHORITY], "only the challenge authority writes auth_email_challenges");

  const proofWriters = SRC_FILES.filter((f) => {
    const code = codeOf(read(f));
    return /emailOwnership(VerifiedAt|ChallengeId)\s*:/.test(code) && /\.update\(\s*authIdentities\b/.test(code);
  });
  assert.deepEqual(proofWriters, [IDENTITY], "only the Identity authority writes the proof columns");

  const identity = codeOf(read(IDENTITY));
  const mark = identity.slice(identity.indexOf("export async function markEmailOwnershipVerified"));
  assert.ok(/isNull\(authIdentities\.emailOwnershipVerifiedAt\)/.test(mark), "a proof is write-once");
  assert.ok(!/verifiedAt:\s*input|status:\s*"/.test(mark.slice(0, mark.indexOf("\n}\n"))), "a proof never touches admission or status");
}

/* ── 2 · THE TOKEN NEVER REACHES A SERVER-VISIBLE URL, A LOG OR A RENDER ─── */
function tokenStaysOutOfUrlsAndLogs(): void {
  const mail = codeOf(read(MAIL));
  assert.ok(
    mail.includes("/verify-email#${EMAIL_VERIFICATION_FRAGMENT_KEY}=${reference}"),
    "the link carries the token in its fragment",
  );
  for (const f of SRC_FILES) {
    const code = codeOf(read(f));
    assert.ok(!/verify-email\?/.test(code), `${f}: no verify-email URL may carry a query string`);
  }
  for (const f of [...FEATURE_FILES, ACTIONS, PAGE, CONFIRM_UI, NOTICE_UI]) {
    const code = stripStrings(codeOf(read(f)));
    assert.ok(!/console\.|logger\.|captureException/.test(code), `${f}: nothing on this path logs`);
  }
  const ui = stripStrings(codeOf(read(CONFIRM_UI)));
  assert.ok(!/\{\s*token\.current\s*\}|\{\s*value\s*\}/.test(ui), "the confirmation UI never renders the token");
  assert.ok(!/localStorage|sessionStorage|document\.cookie/.test(ui), "and never stores it");

  /* The authority returns no reference: issue results are status + delivery only. */
  const authority = codeOf(read(AUTHORITY));
  assert.ok(
    /return \{ status: "issued", delivery \};/.test(authority),
    "an issue result carries the delivery outcome and nothing else",
  );
}

/* ── 3 · ONE TRANSPORT, NOTHING ELSE OF EXTERNAL SEND ─────────────────────── */
function reusesOnlyTheTransport(): void {
  const imports = [...FEATURE_CODE.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
  const external = imports.filter((m) => m.includes("action-execution") || m.includes("action-authorization"));
  assert.deepEqual(
    [...new Set(external)],
    ["@/features/action-execution-live/resend-email-transport.server"],
    "authentication mail reuses the released transport and no other part of the external-send stack",
  );
  for (const forbidden of [
    "external-recipient",
    "provider-connectivity-control",
    "tenant-external-send",
    "action-authorization",
    "governance-decision",
    "heby",
  ]) {
    assert.ok(!imports.some((m) => m.includes(forbidden)), `the feature must not reach ${forbidden}`);
  }
  const code = stripStrings(FEATURE_CODE);
  for (const primitive of ["fetch(", "globalThis.fetch", "node:http", "node:https", "node:net", "nodemailer", "axios", "undici"]) {
    assert.ok(!code.includes(primitive), `the feature opens no socket of its own (${primitive})`);
  }
  assert.ok(!FEATURE_CODE.includes("HEBUN_EXTERNAL_SEND"), "it never reads the external-send configuration");
  assert.ok(!/https:\/\/[a-z]/i.test(stripStrings(FEATURE_CODE)) && !/"https:\/\/[a-z0-9.-]+\//i.test(FEATURE_CODE),
    "and names no host: the link origin is configuration, the provider host is the transport's");
}

/* ── 4 · THE BROWSER CHOOSES NOTHING ──────────────────────────────────────── */
function browserChoosesNothing(): void {
  const actions = codeOf(read(ACTIONS));
  assert.ok(/export async function requestEmailVerificationAction\(\)/.test(actions), "requesting takes no input");
  assert.ok(
    /export async function confirmEmailOwnershipAction\(\s*formData: FormData,?\s*\)/.test(actions) &&
      /formData\.get\("token"\)/.test(actions) &&
      (actions.match(/formData\.get\(/g) ?? []).length === 1,
    "confirming takes exactly the token, as a form field — a positional string would be printed by the dev server-function log",
  );
  assert.ok(
    /authIdentityId: result\.tenantContext\.authIdentityId/.test(actions) &&
      /sessionContextId: result\.tenantContext\.sessionContextId/.test(actions),
    "who acts is the authorized session, never an argument",
  );
  assert.ok(!/searchParams|headers\(\)|cookies\(\)/.test(actions), "no other request input is read");
  for (const f of [ACTIONS, PAGE, CONFIRM_UI, NOTICE_UI, REGISTER]) {
    assert.ok(
      !/sessionDigest(Current|Previous)Key|DIGEST_SECRET|digestKeys/.test(codeOf(read(f))),
      `${f}: no request-facing file names a digest key; the authority resolves it`,
    );
  }
  assert.ok(
    /if \(result\.status === "authorized"\)/.test(actions),
    "only an AUTHORIZED session may request or confirm",
  );
}

/* ── 5 · OPENING THE PAGE CHANGES NOTHING ─────────────────────────────────── */
function openingChangesNothing(): void {
  const ui = codeOf(read(CONFIRM_UI));
  const effect = ui.slice(ui.indexOf("useEffect(() => {"), ui.indexOf("}, []);"));
  assert.ok(effect.length > 0, "the mount effect exists");
  assert.ok(!effect.includes("confirmEmailOwnershipAction"), "mounting never presents the token");
  assert.ok(
    effect.includes("window.history.replaceState(null, \"\", window.location.pathname)") &&
      !effect.includes("window.history.state"),
    "mounting strips the fragment from the current history entry — and from the router's canonical URL",
  );
  assert.ok(/onClick=\{confirm\}/.test(ui), "presenting the token is a button press");

  const page = codeOf(read(PAGE));
  assert.ok(page.includes('referrer: "no-referrer"'), "the page sends no Referer");
  assert.ok(/robots: \{ index: false, follow: false \}/.test(page), "and is never indexed");

  const middleware = codeOf(read(MIDDLEWARE));
  assert.ok(middleware.includes('const PUBLIC_EXACT_PATHS = ["/", "/verify-email"];'), "public by exact path");
  assert.ok(!/PUBLIC_PREFIXES = \[[^\]]*verify-email/.test(middleware), "never as a prefix");
}

/* ── 6 · SIGNUP SCHEDULES, NEVER AWAITS ───────────────────────────────────── */
function signupSchedulesBeforeRedirect(): void {
  const code = codeOf(read(REGISTER));
  const created = code.indexOf("if (outcome.status === \"refused\")");
  const scheduled = code.indexOf("after(async () => {");
  const nextRedirect = code.indexOf("redirect(", code.indexOf("}", code.indexOf("redirect(", created)) + 1);
  assert.ok(created > 0 && scheduled > created, "the request is scheduled after the account exists");
  assert.ok(scheduled < nextRedirect, "and before any later redirect() can throw past it");
  const body = code.slice(scheduled, code.indexOf("});", scheduled));
  assert.equal(code.split("issueEmailVerification(").length - 1, 1, "signup asks for a link exactly once");
  assert.ok(body.includes("issueEmailVerification("), "and only inside `after`, so the response never waits on mail");
  assert.ok(body.includes("try {") && body.includes("catch"), "a mail failure cannot surface into signup");
}

/* ── 7 · GENESIS CHECKS THE PROOF INSIDE THE ATOMIC UPDATE ────────────────── */
function genesisChecksInsideTheUpdate(): void {
  const code = codeOf(read(GENESIS));
  const update = code.slice(code.indexOf(".update(genesisNominations)"), code.indexOf(".returning(", code.indexOf(".update(genesisNominations)")));
  assert.ok(update.includes('eq(genesisNominations.status, "pending")'), "the update is predicated on pending");
  assert.ok(
    /emailOwnershipProvenPredicate\(\s*genesisNominations\.nominatedAuthIdentityId,\s*provingChallengeId,?\s*\)/.test(update),
    "and, in the SAME statement, on the nominee's proof — pinned to the proof the audit row will name",
  );
  assert.ok(/emailOwnershipChallengeId: provingChallengeId/.test(code), "the history names the proof");
}

/* ── 8 · HEBY CANNOT REACH IT ─────────────────────────────────────────────── */
function hebyCannotReachIt(): void {
  for (const f of SRC_FILES.filter((f) => f.includes("heby"))) {
    assert.ok(!codeOf(read(f)).includes("auth-email-ownership"), `${f} must not reach email ownership`);
  }
}

oneWriterPerTable();
tokenStaysOutOfUrlsAndLogs();
reusesOnlyTheTransport();
browserChoosesNothing();
openingChangesNothing();
signupSchedulesBeforeRedirect();
genesisChecksInsideTheUpdate();
hebyCannotReachIt();
console.log("auth-email-ownership-1 boundaries-and-firewall: PASS");
