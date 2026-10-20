/*
 * OPERATIONAL-OBSERVABILITY-V1 — the scheduled-scan warning line.
 *
 * Proves, without a database or network:
 *   1. One line for an unsuccessful tick, none for a successful or empty one.
 *   2. The line carries only literal status categories and counts — never a reason word, an id,
 *      a payload or a secret, even when the outcomes carry them.
 *   3. The tables are total over each trigger's outcome vocabulary.
 *   4. Through the real routes: 401 writes nothing, and an unreadable register still answers 503
 *      with the unchanged body while writing exactly one line.
 */
import assert from "node:assert/strict";

import {
  CRON_SCAN_WARNING_EVENT,
  UNSUCCESSFUL_SCAN_OUTCOMES,
  countUnsuccessfulOutcomes,
  warnUnsuccessfulScan,
  type CronScanName,
} from "../../src/features/cron-scan-warning/warn-unsuccessful-scan";

const SECRET_LIKE = "sk_live_DO_NOT_LOG_0123456789";
const ID_LIKE = "11111111-2222-4333-8444-555555555555";

function capture(): { lines: string[]; log: (line: string) => void } {
  const lines: string[] = [];
  return { lines, log: (line) => lines.push(line) };
}

function oneLinePerUnsuccessfulTick(): void {
  /* Successful and empty ticks are silent. */
  for (const [scan, ok] of [
    ["observation", ["recorded", "not-due", "duplicate-suppressed"]],
    ["machine-delivery", ["delivered"]],
    ["standing-issuance", ["issued"]],
  ] as const) {
    const c = capture();
    const outcomes = ok.map((status) => ({ permitId: ID_LIKE, outcome: { status } }));
    assert.equal(warnUnsuccessfulScan(scan, { status: "scanned", considered: outcomes.length, outcomes }, c.log), false);
    assert.equal(warnUnsuccessfulScan(scan, { status: "scanned", considered: 0, outcomes: [] }, c.log), false);
    assert.deepEqual(c.lines, [], `${scan}: a successful or empty tick writes nothing`);
  }

  /* An unsuccessful tick writes exactly one line, however many outcomes failed. */
  const c = capture();
  const outcomes = [
    { permitId: ID_LIKE, outcome: { status: "refused", reason: SECRET_LIKE, authorityReason: ID_LIKE } },
    { permitId: ID_LIKE, outcome: { status: "refused", reason: "machine-execution-disarmed" } },
    { permitId: ID_LIKE, outcome: { status: "failed" } },
    { permitId: ID_LIKE, outcome: { status: "delivered", invocationId: ID_LIKE } },
  ];
  assert.equal(warnUnsuccessfulScan("machine-delivery", { status: "scanned", considered: 4, outcomes }, c.log), true);
  assert.equal(c.lines.length, 1, "one line per tick");
  assert.deepEqual(JSON.parse(c.lines[0]!), {
    event: CRON_SCAN_WARNING_EVENT,
    scan: "machine-delivery",
    status: "scanned",
    considered: 4,
    unsuccessful: { refused: 2, failed: 1 },
  });

  /* Unavailable writes one line with no counts. */
  const u = capture();
  assert.equal(warnUnsuccessfulScan("observation", { status: "unavailable" }, u.log), true);
  assert.deepEqual(JSON.parse(u.lines[0]!), { event: CRON_SCAN_WARNING_EVENT, scan: "observation", status: "unavailable" });
}

function nothingButCategoriesAndCounts(): void {
  for (const scan of Object.keys(UNSUCCESSFUL_SCAN_OUTCOMES) as CronScanName[]) {
    const statuses = Object.keys(UNSUCCESSFUL_SCAN_OUTCOMES[scan]);
    const c = capture();
    const outcomes = statuses.map((status) => ({
      authorizationId: ID_LIKE,
      permitId: ID_LIKE,
      tenantId: ID_LIKE,
      outcome: { status, reason: SECRET_LIKE, failure: SECRET_LIKE, observationId: ID_LIKE },
    }));
    warnUnsuccessfulScan(scan, { status: "scanned", considered: outcomes.length, outcomes }, c.log);
    const line = c.lines.join("\n");
    assert.ok(!line.includes(SECRET_LIKE), `${scan}: no reason word or secret reaches the log`);
    assert.ok(!line.includes(ID_LIKE), `${scan}: no identifier reaches the log`);
    for (const key of ["tenantId", "permitId", "authorizationId", "reason", "failure", "payload"]) {
      assert.ok(!line.includes(`"${key}"`), `${scan}: the line has no "${key}" field`);
    }
    /* Keys come only from the table, so a forged status is never echoed either. */
    const forged = countUnsuccessfulOutcomes(scan, [{ outcome: { status: SECRET_LIKE } }]);
    assert.deepEqual(forged, {}, `${scan}: an unknown status is not a key`);
  }
}

function tablesAreTotal(): void {
  assert.deepEqual(Object.keys(UNSUCCESSFUL_SCAN_OUTCOMES.observation).sort(), [
    "due-unknown", "duplicate-suppressed", "not-authorized", "not-due", "observed-not-recorded",
    "provider-failed", "recorded", "refused", "unsupported-subject",
  ]);
  assert.deepEqual(Object.keys(UNSUCCESSFUL_SCAN_OUTCOMES["machine-delivery"]).sort(), ["delivered", "failed", "refused"]);
  assert.deepEqual(Object.keys(UNSUCCESSFUL_SCAN_OUTCOMES["standing-issuance"]).sort(), ["failed", "issued", "refused"]);
  /* The success side, named: these never warn. */
  for (const [scan, status] of [
    ["observation", "recorded"], ["observation", "not-due"], ["observation", "duplicate-suppressed"],
    ["machine-delivery", "delivered"], ["standing-issuance", "issued"],
  ] as const) {
    assert.equal((UNSUCCESSFUL_SCAN_OUTCOMES[scan] as Record<string, boolean>)[status], false, `${scan}/${status}`);
  }
}

/* 4. Through the real routes, with no database configured. */
async function routesKeepTheirContract(): Promise<void> {
  delete process.env.DATABASE_URL;
  const warned: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => void warned.push(args.map(String).join(" "));
  try {
    for (const [scan, env, path] of [
      ["observation", "HEBUN_OBSERVATION_TRIGGER_SECRET", "observation"],
      ["machine-delivery", "HEBUN_MACHINE_DELIVERY_TRIGGER_SECRET", "machine-delivery"],
      ["standing-issuance", "HEBUN_STANDING_ISSUANCE_TRIGGER_SECRET", "standing-issuance"],
    ] as const) {
      const { GET } = (await import(`../../src/app/api/${path}/scan/route`)) as {
        GET: (r: Request) => Promise<Response>;
      };
      const url = `https://hebun.test/api/${path}/scan`;
      process.env[env] = SECRET_LIKE;

      warned.length = 0;
      const refused = await GET(new Request(url, { headers: { authorization: "Bearer wrong" } }));
      assert.equal(refused.status, 401, `${scan}: unauthorized stays 401`);
      assert.equal(await refused.text(), "Unauthorized");
      assert.equal(warned.length, 0, `${scan}: an unauthorized request writes no scan line`);

      const unavailable = await GET(new Request(url, { headers: { authorization: `Bearer ${SECRET_LIKE}` } }));
      assert.equal(unavailable.status, 503, `${scan}: an unreadable register stays 503`);
      assert.deepEqual(await unavailable.json(), { status: "unavailable", reason: "persistence-unavailable" });
      assert.equal(warned.length, 1, `${scan}: exactly one line`);
      assert.deepEqual(JSON.parse(warned[0]!), { event: CRON_SCAN_WARNING_EVENT, scan, status: "unavailable" });
      assert.ok(!warned[0]!.includes(SECRET_LIKE), `${scan}: the bearer secret is not logged`);
      delete process.env[env];
    }
  } finally {
    console.warn = original;
  }
}

async function main(): Promise<void> {
  oneLinePerUnsuccessfulTick();
  nothingButCategoriesAndCounts();
  tablesAreTotal();
  await routesKeepTheirContract();
  console.log("operational-observability-v1/scan-warning: OK");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
