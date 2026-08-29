/*
 * LMX-1 — BITE-PROOFS.
 *
 * A product milestone's guarantees are the easiest to lose, because every one of them can be
 * removed by an edit that makes the page look better. So each is mutated in the SHIPPED SOURCE and
 * the suite defending it must fail — for the INTENDED reason, not merely for some reason.
 *
 * Three conditions per mutation: the find-string is present (so the mutation APPLIES — one that
 * cannot be applied looks exactly like one that failed to bite), it reached disk, and the defending
 * suite failed naming the intended reason. Restoration runs in `finally` and is verified
 * byte-identically, so a failure never leaves mutated source behind.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();

const MAP_SUITE = "tests/live-map-experience/map-surface.ts";
const AWARENESS_SUITE = "tests/live-map-experience/awareness.ts";
const FIREWALL_SUITE = "tests/live-map-experience/firewall.ts";
const INVARIANT_SUITE = "tests/live-map-experience/rendering-invariant.ts";

const CANVAS = "src/components/live-map/live-map-canvas.tsx";
const BAND = "src/components/awareness/global-awareness.tsx";
const LM_AWARENESS = "src/features/live-map/awareness.ts";
const SEC_AWARENESS = "src/features/security-center/awareness.ts";
const COMMAND_PAGE = "src/app/(dashboard)/command/page.tsx";
const LIVE_MAP_PAGE = "src/app/(dashboard)/live-map/page.tsx";
const RESOLVER = "src/features/auth-runtime/request-session.server.ts";

const CHILD_TIMEOUT_MS = 5 * 60 * 1000;

const abs = (f: string): string => path.join(ROOT, f);
const readFile = (f: string): string => readFileSync(abs(f), "utf8");
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

interface SuiteRun {
  readonly ok: boolean;
  readonly output: string;
  readonly timedOut: boolean;
}

function runSuite(suite: string): SuiteRun {
  const result = spawnSync(process.execPath, ["--import", "tsx", suite], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: CHILD_TIMEOUT_MS,
  });
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    timedOut: result.signal === "SIGTERM" && result.status === null,
  };
}

interface Mutation {
  readonly label: string;
  readonly file: string;
  readonly suite: string;
  readonly find: string;
  readonly replace: string;
  readonly expect: string;
}

const MUTATIONS: readonly Mutation[] = [
  {
    /* M1 — THE ORGANIZATION LOSES THE CENTRE. The map's whole claim is where it puts the reader. */
    label: "M1 the organization is demoted out of the map's centre",
    file: CANVAS,
    suite: MAP_SUITE,
    find: `        <div className="lm-centre">`,
    replace: `        <div className="lm-aside">`,
    expect: "the organization node sits in the map's centre slot",
  },
  {
    /* M2 — A LINE DRAWN TO SOMETHING THE READER CANNOT SEE. */
    label: "M2 the spine is drawn with no organization on the map",
    file: CANVAS,
    suite: MAP_SUITE,
    find: `  const connected = Boolean(organizationNode) && agentNodes.length > 0;`,
    replace: `  const connected = agentNodes.length > 0;`,
    expect: "with no visible organization the spine is not drawn",
  },
  {
    /* M3 — THE PICTURE KEEPS THE LINE AND DROPS THE PROOF. */
    label: "M3 the drawn relationship stops naming the column that proves it",
    file: CANVAS,
    suite: MAP_SUITE,
    find: `      <span className="lm-basis-relation">{first.relation}</span> {first.basis}`,
    replace: `      <span className="lm-basis-relation">{first.relation}</span> These are related.`,
    expect: "the durable column that proves it is printed",
  },
  {
    /* M4 — SELECTION STOPS BEING EXCLUSIVE, so "the selected agent" no longer means anything. */
    label: "M4 the agents leave the exclusive selection group",
    file: CANVAS,
    suite: FIREWALL_SUITE,
    find: `    <details className="lm-agent" name="live-map-agent">`,
    replace: `    <details className="lm-agent">`,
    expect: "exactly one is ever selected",
  },
  {
    /* M5 — A CONTROL ON A MAP IMPLIES AN AUTHORITY THE MAP DOES NOT HAVE. */
    label: "M5 the map gains an action control",
    file: CANVAS,
    suite: FIREWALL_SUITE,
    find: `      <div className="lm-absences">`,
    replace: `      <button type="button">Reassign</button>\n      <div className="lm-absences">`,
    expect: `the map discloses, it does not act — "<button"`,
  },
  {
    /*
     * M6 — THE DEFECT A PICTURE COMMITS MOST EASILY. An unread observation rendered as three zeros
     * tells a Director that a working agent has proposed nothing.
     */
    label: "M6 an unread observation glances as zeros",
    file: CANVAS,
    suite: MAP_SUITE,
    find: `  if (intelligence.status === "unavailable") {
    return <p className="lm-glance lm-glance-unread">Outcome observation unread</p>;
  }`,
    replace: `  if (intelligence.status === "unavailable") {
    return (
      <p className="lm-glance">
        <span>0 filed</span>
        <span aria-hidden="true"> · </span>
        <span>0 approved</span>
        <span aria-hidden="true"> · </span>
        <span>0 never executed</span>
      </p>
    );
  }`,
    expect: "the glance line says it could not be read",
  },
  {
    /* M7 — A MEASURED ZERO AND AN UNREAD AUTHORITY COLLAPSE INTO ONE NUMBER. */
    label: "M7 a known-empty agent domain is summarised as a count of zero",
    file: LM_AWARENESS,
    suite: AWARENESS_SUITE,
    find: `      : agentDomain?.state.status === "known-empty"
        ? { status: "known-empty" }`,
    replace: `      : agentDomain?.state.status === "known-empty"
        ? { status: "counted", count: 0 }`,
    expect: "a measured zero keeps its own state",
  },
  {
    /* M8 — THE ONE SENTENCE A LEDGER CAN NEVER SUPPORT. */
    label: "M8 Security Live announces a security posture",
    file: BAND,
    suite: AWARENESS_SUITE,
    find: `        ? "No governed act has been recorded"`,
    replace: `        ? "All systems secure"`,
    expect: `must not present "all systems"`,
  },
  {
    /* M9 — THE BOUNDED PAGE IS REPORTED AS THE WHOLE RECORD. */
    label: "M9 the recorded-act total becomes the page length",
    file: SEC_AWARENESS,
    suite: AWARENESS_SUITE,
    find: `          totalRecordedActs: observation.totalRecordedActs,`,
    replace: `          totalRecordedActs: observation.acts.length,`,
    expect: "the INDEPENDENT total, not the page length",
  },
  {
    /* M10 — A DERIVED VIEW CLAIMS THE STANDING OF THE RECORD IT WAS COMPUTED FROM. */
    label: "M10 the security observation marks itself authoritative",
    file: SEC_AWARENESS,
    suite: AWARENESS_SUITE,
    find: `    authoritative: observation.authoritative,`,
    replace: `    authoritative: true as unknown as false,`,
    expect: "the observation is derived, and says so",
  },
  {
    /* M11 — THE SUMMARY ACQUIRES A READ, AND WITH IT THE ABILITY TO DISAGREE WITH THE MAP. */
    label: "M11 the awareness summary performs its own read",
    file: LM_AWARENESS,
    suite: FIREWALL_SUITE,
    find: `import type { LiveMapProjection } from "./contracts";`,
    replace:
      `import type { LiveMapProjection } from "./contracts";\n` +
      `import { readLiveMapProjection } from "./read-live-map.server";\n` +
      `void readLiveMapProjection;`,
    expect: "a second read waiting to disagree",
  },
  {
    /* M12 — A PRETTIER ROUTE THAT DOES NOT EXIST. */
    label: "M12 Security Live points at an invented route",
    file: BAND,
    suite: FIREWALL_SUITE,
    find: `      href="/director/governance/security"`,
    replace: `      href="/security"`,
    expect: "no route was invented for prettier IA",
  },
  {
    /*
     * M13 — THE RENDERING INVARIANT ITSELF. If the resolver stops reaching a request-bound API
     * while auth is configured, Next.js may prerender an authenticated route into reusable HTML.
     */
    label: "M13 the resolver stops reaching the request under configured auth",
    file: RESOLVER,
    suite: INVARIANT_SUITE,
    find: `  const env = getAuthEnvironment();
  if (env.status !== "configured") return null;
  const result = await resolveRequestAuthentication(env);`,
    replace: `  const env = getAuthEnvironment();
  if (env.status !== "configured") return null;
  if (env.provider === "local") return null;
  const result = await resolveRequestAuthentication(env);`,
    expect: "MUST reach a request-bound API",
  },
  {
    /* M14 — AND THE OTHER WAY IN: A ROUTE THAT OPTS ITSELF BACK INTO REUSABLE OUTPUT. */
    label: "M14 the map route declares itself force-static",
    file: LIVE_MAP_PAGE,
    suite: INVARIANT_SUITE,
    find: `export const metadata = { title: "Live Map — Hebun AI" };`,
    replace: `export const dynamic = "force-static";\nexport const metadata = { title: "Live Map — Hebun AI" };`,
    expect: "force-static would make this route reusable across tenants",
  },
  {
    /* M15 — THE PRODUCT LABEL BECOMES A RUNTIME CLAIM. */
    label: "M15 Security Live claims continuous monitoring",
    file: BAND,
    suite: AWARENESS_SUITE,
    find: `      footnote={awareness.limits}`,
    replace: `      footnote="Real-time security monitoring, updated continuously."`,
    expect: `no panel may claim "real-time"`,
  },
  {
    /* M16 — TWO RESOLUTIONS CAN DESCRIBE TWO INSTANTS, AND THE PANELS WOULD DISAGREE. */
    label: "M16 the landing route resolves the tenant twice",
    file: COMMAND_PAGE,
    suite: FIREWALL_SUITE,
    find: `  const tenant = await resolveTenantContext();`,
    replace: `  const tenant = await resolveTenantContext();\n  const again = await resolveTenantContext();\n  void again;`,
    expect: "resolves the tenant exactly once",
  },
];

function withMutation(mutation: Mutation, body: () => void): void {
  const original = readFile(mutation.file);
  const before = sha(original);
  assert.ok(
    original.includes(mutation.find),
    `${mutation.label}: the find-string is not present in ${mutation.file} — the mutation would prove nothing`,
  );
  const mutated = original.replace(mutation.find, mutation.replace);
  assert.notEqual(mutated, original, `${mutation.label}: the mutation changed nothing`);
  try {
    writeFileSync(abs(mutation.file), mutated, "utf8");
    assert.equal(sha(readFile(mutation.file)), sha(mutated), `${mutation.label}: the mutation did not reach disk`);
    body();
  } finally {
    writeFileSync(abs(mutation.file), original, "utf8");
  }
  assert.equal(sha(readFile(mutation.file)), before, `${mutation.file} was not restored byte-identically`);
}

function main(): void {
  let bitten = 0;
  for (const mutation of MUTATIONS) {
    withMutation(mutation, () => {
      const run = runSuite(mutation.suite);
      assert.equal(
        run.timedOut,
        false,
        `${mutation.label}: the defending suite TIMED OUT after ${CHILD_TIMEOUT_MS}ms. That is a ` +
          "VOID result, not a bite.",
      );
      assert.equal(
        run.ok,
        false,
        `${mutation.label}: the mutation SURVIVED — ${mutation.suite} still passed.\n` +
          `--- actual ---\n${run.output.slice(-2000)}`,
      );
      assert.ok(
        run.output.includes(mutation.expect),
        `${mutation.label}: the suite failed, but not for the intended reason. Expected output ` +
          `containing "${mutation.expect}".\n--- actual ---\n${run.output.slice(-2500)}`,
      );
    });
    bitten += 1;
    console.log(`BITE ${mutation.label}`);
  }
  assert.equal(bitten, MUTATIONS.length, "every mutation must have been proved to bite");
  console.log(`live-map-experience/bite-proofs: ${bitten} mutations bit`);
}

main();
