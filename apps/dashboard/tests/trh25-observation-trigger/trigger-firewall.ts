/*
 * TRH-25 — the structural rules the automatic trigger stands on. Source is read with comments
 * STRIPPED, so no rule here can be satisfied — or tripped — by prose.
 *
 * WHAT THIS FILE REFUSES TO LET HAPPEN:
 *
 *   1. A TRIGGER THAT CAN AIM. No scope may be expressible anywhere on the path from the request
 *      to the released composition.
 *   2. A SECOND AUTHORIZATION AUTHORITY. The scan may not decide anything the revalidator decides.
 *   3. AN INGRESS THAT IS MERELY PUBLIC. Authentication is explicit, constant-time and fail-closed.
 *   4. A PREFIX EXEMPTION. Exactly one path leaves the session check, not `/api`.
 *   5. A SCHEDULE SMUGGLED IN AS CODE. No timer, no cron expression, no scheduler state.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { classifyObserveOutcome } from "../../src/features/observation-trigger/contracts";

const ROOT = process.cwd();
const read = (f: string): string => readFileSync(path.join(ROOT, f), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const TRIGGER = "src/features/observation-trigger";
const SCAN = `${TRIGGER}/scan-due-observations.server.ts`;
const TRIGGER_CONTRACTS = `${TRIGGER}/contracts.ts`;
const ROUTE = "src/app/api/observation/scan/route.ts";
const MIDDLEWARE = "src/middleware.ts";
const REGISTER = "src/features/standing-observation-authority/read-standing-observations.server.ts";
const COMPOSITION =
  "src/features/provider-observation-history/observe-once-under-authorization.server.ts";

function walk(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return walk(rel);
    return /\.tsx?$/.test(entry.name) ? [rel] : [];
  });
}

function main(): void {
  const routeCode = codeOf(read(ROUTE));
  const scanCode = codeOf(read(SCAN));

  /* ═══════════════════════════════════════════════════════════════════════════
   * 1. THE REQUEST CARRIES NO SCOPE, AND CANNOT.
   * ═══════════════════════════════════════════════════════════════════════ */
  /*
   * PROVED BY WHAT THE HANDLER READS, not by what it happens not to use. `request.headers.get` is
   * the ONLY thing taken off the request; a body, a query parameter or a route parameter would each
   * be a syntax in which a caller could name something.
   */
  for (const inlet of [
    "request.json", "request.text", "request.formData", "request.body",
    "nextUrl", "searchParams", "URL(", "params",
  ]) {
    assert.ok(
      !routeCode.includes(inlet),
      `the route never reads \`${inlet}\` — a caller has no syntax for naming anything`,
    );
  }
  const reads = [...routeCode.matchAll(/request\.(\w+)/g)].map((m) => m[1]!);
  assert.deepEqual(
    [...new Set(reads)].sort(),
    ["headers"],
    "the request is read for exactly one thing: the authorization header",
  );

  /* AND THE SCAN IT STARTS IS CALLED WITH NOTHING. */
  assert.ok(
    /scanDueObservations\(\s*\)/.test(routeCode),
    "the route calls the scan with NO arguments — it cannot pass a scope it does not have",
  );

  /* ═══════════════════════════════════════════════════════════════════════════
   * 2. NOTHING ON THE PATH ACCEPTS A SCOPE.
   * ═══════════════════════════════════════════════════════════════════════ */
  for (const [file, code] of [[ROUTE, routeCode], [SCAN, scanCode]] as const) {
    for (const scope of [
      "tenantId:", "providerKey:", "capabilityKey:", "subjectRef:", "subjectKind:",
      "integrationId:", "credentialId:", "authorizationId:",
    ]) {
      const declaresParameter = new RegExp(
        `(interface|type)[^{]*\\{[^}]*readonly ${scope.replace(":", "")}\\??:`,
        "s",
      );
      assert.ok(
        !declaresParameter.test(code.slice(0, code.indexOf("export async function"))),
        `${file} declares no \`${scope}\` input — no caller can supply one`,
      );
    }
  }

  /*
   * THE ONLY VALUE CROSSING INTO THE RELEASED COMPOSITION IS AN ID. Proved on the call itself.
   */
  const invocation = scanCode.match(/observeOnceUnderAuthorization\(\s*([^,]+),/);
  assert.ok(invocation, "the scan invokes the released composition");
  assert.equal(
    invocation![1]!.trim(),
    "authorization.authorizationId",
    "and hands it an authorization id and nothing else — never a tenant, subject or connection",
  );

  /* ═══════════════════════════════════════════════════════════════════════════
   * 3. THE SCAN IS NOT A SECOND AUTHORITY.
   * ═══════════════════════════════════════════════════════════════════════ */
  for (const decision of [
    "isObservableCapability", "getCapabilityAvailability", "listConnections",
    "resolveObservationReadEnabled", "listCredentialMetadata", "withConnectionScopedSecret",
    "withDecryptedSecret", "mintObservationPrincipal", "authorizeStandingObservation",
    "withdrawStandingObservation", "recordAuthorizedProviderObservation",
  ]) {
    assert.ok(
      !scanCode.includes(decision),
      `the scan never calls ${decision} — every such decision belongs to the released revalidator`,
    );
  }
  /* AND IT WRITES NOTHING, ANYWHERE. */
  for (const write of [".insert(", ".update(", ".delete(", "db.transaction(", "onConflict"]) {
    assert.ok(!scanCode.includes(write), `the scan contains no \`${write}\``);
    assert.ok(!routeCode.includes(write), `the route contains no \`${write}\``);
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 4. AUTHENTICATION: EXPLICIT, CONSTANT-TIME, FAIL-CLOSED, NEVER LOGGED.
   * ═══════════════════════════════════════════════════════════════════════ */
  assert.ok(routeCode.includes("timingSafeEqual"), "the bearer is compared in constant time");
  assert.ok(
    /if\s*\(!expected\)\s*return false;/.test(routeCode),
    "an UNSET secret refuses every request — an unconfigured deployment is closed",
  );
  assert.ok(
    /status:\s*401/.test(routeCode),
    "an unauthenticated caller is refused",
  );
  /*
   * THE REFUSAL PRECEDES EVERY READ. Positional, because "the check exists in the file" is not the
   * property — a check that runs after the scan would authenticate nothing.
   */
  /*
   * ANCHORED ON THE CALL SITE, NOT THE NAME. `indexOf("isAuthorized")` finds the FUNCTION
   * DECLARATION, which sits above the handler and is therefore always earlier than the scan — the
   * assertion read correctly and proved nothing. A mutation that hoisted the scan above the guard
   * passed it. Both positions are now taken from the guard's own `if` and the FIRST call to the
   * scan, so hoisting the scan is exactly what this catches.
   */
  const guardCall = routeCode.indexOf("if (!isAuthorized(request.headers");
  const firstScanCall = routeCode.indexOf("await scanDueObservations(");
  assert.ok(guardCall >= 0, "the handler guards on the bearer");
  assert.ok(firstScanCall >= 0, "the handler starts the scan");
  assert.ok(
    guardCall < firstScanCall,
    "authentication happens BEFORE the scan is started",
  );
  assert.equal(
    (routeCode.match(/scanDueObservations\(/g) ?? []).length,
    1,
    "and the scan is started exactly once, so no copy of it can run above the guard",
  );
  for (const leak of ["console.log", "console.error", "console.warn"]) {
    assert.ok(!routeCode.includes(leak), `the route never ${leak}s — a secret must not reach a log`);
  }
  assert.ok(
    !/authorization[^)]*\)\s*\}/.test(routeCode.slice(routeCode.indexOf("Response.json"))),
    "and no response echoes the header",
  );

  /* ═══════════════════════════════════════════════════════════════════════════
   * 5. THE MIDDLEWARE CARVE-OUT IS ONE EXACT PATH.
   * ═══════════════════════════════════════════════════════════════════════ */
  const middlewareCode = codeOf(read(MIDDLEWARE));
  assert.ok(
    middlewareCode.includes('"/api/observation/scan"'),
    "the machine ingress is exempted from the SESSION check",
  );
  assert.ok(
    !/PUBLIC_PREFIXES\s*=\s*\[[^\]]*\/api/.test(middlewareCode),
    "and `/api` is NOT a public PREFIX — the OAuth handlers still require a session",
  );
  const exactList = middlewareCode.match(/MACHINE_INGRESS_PATHS\s*=\s*\[([^\]]*)\]/);
  assert.ok(exactList, "the machine ingress list exists");
  assert.deepEqual(
    exactList![1]!.split(",").map((s) => s.trim()).filter(Boolean),
    ['"/api/observation/scan"'],
    "exactly ONE machine path leaves the session check",
  );

  /* ═══════════════════════════════════════════════════════════════════════════
   * 6. THE REGISTER IS RUNTIME DISCOVERY, NOT A TENANT READ.
   * ═══════════════════════════════════════════════════════════════════════ */
  const registerCode = codeOf(read(REGISTER));
  assert.ok(
    /export async function listActiveStandingObservationsForRuntime\(\s*deps: StandingObservationReadDeps/.test(
      registerCode,
    ),
    "the runtime register takes NO tenant parameter — a caller that could name a tenant could choose one",
  );
  const registerBody = registerCode.slice(
    registerCode.indexOf("listActiveStandingObservationsForRuntime"),
  );
  for (const write of [".insert(", ".update(", ".delete("]) {
    assert.ok(!registerBody.includes(write), `the register contains no \`${write}\``);
  }
  for (const reach of ["withDecryptedSecret", "withConnectionScopedSecret", "fetch("]) {
    assert.ok(
      !registerBody.includes(reach),
      `the register never reaches ${reach} — it reads one table and nothing else`,
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 7. NO SCHEDULE EXISTS IN CODE, AND NO SCHEDULER STATE.
   * ═══════════════════════════════════════════════════════════════════════ */
  for (const [file, code] of [[ROUTE, routeCode], [SCAN, scanCode], [TRIGGER_CONTRACTS, codeOf(read(TRIGGER_CONTRACTS))]] as const) {
    for (const timing of [
      "setInterval", "setTimeout", "node-cron", "node:worker_threads", "BullMQ",
      "nextRun", "next_run", "lastRun", "last_run", "cronExpression", "schedule(",
    ]) {
      assert.ok(!code.includes(timing), `${file} contains no \`${timing}\``);
    }
  }
  /* NO RETRY: the scan calls the composition once per authorization and never loops over one. */
  assert.equal(
    (scanCode.match(/observeOnceUnderAuthorization\(/g) ?? []).length,
    1,
    "the composition is invoked from exactly one place, with no retry beside it",
  );

  /* ═══════════════════════════════════════════════════════════════════════════
   * 8. THE INGRESS CENSUS. ONE MACHINE ROUTE, AND THE OAUTH THREE UNCHANGED.
   * ═══════════════════════════════════════════════════════════════════════ */
  const routes = walk("src/app").filter((f) => /\/route\.tsx?$/.test(f));
  assert.deepEqual(
    routes.sort(),
    [
      "src/app/api/integrations/github/setup/route.ts",
      "src/app/api/integrations/github/start/route.ts",
      "src/app/api/integrations/google/callback/route.ts",
      "src/app/api/integrations/google/start/route.ts",
      "src/app/api/observation/scan/route.ts",
    ],
    "exactly one route was added, and it is the machine ingress",
  );

  /*
   * AND STILL NO TIMING CONFIGURATION. The trigger is the DOOR; the schedule is deployment
   * configuration that does not exist yet, so nothing calls this door on its own.
   */
  for (const config of ["vercel.json", "src/app/api/cron"]) {
    let exists = true;
    try {
      readFileSync(path.join(ROOT, config), "utf8");
    } catch {
      exists = false;
    }
    assert.equal(exists, false, `${config} does not exist — no schedule has been configured`);
  }

  /* THE PRODUCT SURFACE STILL CANNOT REACH THE OBSERVATION AUTHORITY. */
  const surface = walk("src/app")
    .concat(walk("src/components"))
    .filter((f) => f !== ROUTE);
  for (const f of surface) {
    const code = codeOf(read(f));
    assert.ok(
      !/observation-trigger|standing-observation-authority|observeOnceUnderAuthorization/.test(code),
      `${f} does not reach the observation authorities — only the machine ingress does`,
    );
  }

  /* AND THE COMPOSITION STILL TAKES ONE ARGUMENT. */
  assert.ok(
    /export async function observeOnceUnderAuthorization\(\s*authorizationId: string,/.test(
      codeOf(read(COMPOSITION)),
    ),
    "the released composition still takes an authorization id and nothing else",
  );

  /* ═══════════════════════════════════════════════════════════════════════════
   * 9. THE REPORT IS HONEST ABOUT WHAT THE DATABASE DID.
   *
   * Proved on the CLASSIFIER, which is pure, rather than on a race whose loser is refused at one of
   * two different layers depending on which transaction commits first. The property under test is
   * not "who won" — it is that NO write outcome except an actual insert may be called `recorded`.
   * ═══════════════════════════════════════════════════════════════════════ */
  const observed = (record: unknown) =>
    classifyObserveOutcome({
      status: "observed",
      invocationId: "i",
      authorizationId: "a",
      observation: {} as never,
      record: record as never,
    }).status;

  assert.equal(observed({ status: "recorded", observationId: "x" }), "recorded", "an insert is recorded");
  assert.equal(
    observed({ status: "already-recorded" }),
    "duplicate-suppressed",
    "the same instant already on record is a SUPPRESSED duplicate, never a second success",
  );
  for (const reason of ["cadence-window-already-observed", "invocation-already-recorded"]) {
    assert.equal(
      observed({ status: "refused", reason }),
      "duplicate-suppressed",
      `\`${reason}\` is a suppressed duplicate`,
    );
  }
  for (const reason of ["persistence-unavailable", "invalid-observation", "not-an-observation-principal"]) {
    assert.equal(
      observed({ status: "refused", reason }),
      "observed-not-recorded",
      `\`${reason}\` means Hebun FAILED TO REMEMBER a read it performed — never success`,
    );
  }

  console.log(
    "trh25-observation-trigger/trigger-firewall: one route, one exact carve-out, constant-time " +
      "bearer, no scope on the path, no schedule, no scheduler state",
  );
}

main();
