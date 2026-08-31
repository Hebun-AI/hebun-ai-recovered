/*
 * L4 — LIVE MAP CORE v1 — BITE-PROOFS.
 *
 * Every guarantee this milestone introduces is mutated in the SHIPPED SOURCE, and the suite
 * defending it must fail — for the INTENDED reason, not merely for some reason.
 *
 * Three conditions per mutation: the find-string is present (so the mutation APPLIES — one that
 * cannot be applied looks exactly like one that failed to bite), it reached disk, and the defending
 * suite failed naming the intended reason. Restoration runs in `finally` and is verified
 * byte-identically, so a failure never leaves mutated source behind.
 *
 * A child that exceeds its timeout is reported VOID rather than counted as bitten.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();

const TRUTH_SUITE = "tests/l4-live-map/projection-truth.ts";
const FIREWALL_SUITE = "tests/l4-live-map/firewall.ts";

const PROJECTION = "src/features/live-map/read-live-map.server.ts";
const CONTRACTS = "src/features/live-map/contracts.ts";
const CANVAS = "src/components/live-map/live-map-canvas.tsx";
const PAGE = "src/app/(dashboard)/live-map/page.tsx";

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
    /*
     * THE DEFECT A MAP IS BUILT TO COMMIT. An authority that could not be reached becomes a domain
     * with nothing in it, and the picture says the organization has no agents.
     */
    label: "V1 an unreadable agent authority becomes a known-empty domain",
    file: PROJECTION,
    suite: TRUTH_SUITE,
    find: `  if (state.status === "unavailable") {\n    return {\n      domainId: "agents",\n      label: "Agents",\n      state: {\n        status: "unavailable",`,
    replace: `  if (state.status === "unavailable") {\n    return {\n      domainId: "agents",\n      label: "Agents",\n      state: {\n        status: "known-empty",`,
    expect: "unavailable",
  },
  {
    /* THE SAME DEFECT ON THE ORGANIZATION: a failed read rendered as a nameless company. */
    label: "V2 an unavailable organization is given a node anyway",
    file: PROJECTION,
    suite: TRUTH_SUITE,
    /*
     * Written as the mutation a careless author would actually commit: keep the branch, but hand
     * the reader a placeholder organization instead of a refusal. Disabling the branch outright
     * throws instead, which proves the type system caught it — not that the suite would.
     */
    find: `      state: {
        status: "unavailable",
        reason: read.reason,`,
    replace: `      state: {
        status: "available",
        nodes: [{ nodeId: "organization:unknown", kind: "organization" as const, label: "Your organization", truth: "authoritative" as const, sourceAuthority: "Organization Authority", detail: [] }],
        reason: read.reason,`,
    expect: "no-tenant is unavailable",
  },
  {
    /* OMISSION IS A CLAIM. A map that drops departments reads as one that has none. */
    label: "V3 the structure domain is omitted instead of stated",
    file: PROJECTION,
    suite: TRUTH_SUITE,
    find: `    domains: [organization, agents, structure, people],`,
    replace: `    domains: [organization, agents, people],`,
    expect: "the map names every domain it represents",
  },
  {
    /* NO AUTHORITY IS NOT A MEASURED ZERO. */
    label: "V4 no-authority is downgraded to known-empty",
    file: PROJECTION,
    suite: TRUTH_SUITE,
    /*
     * RE-ANCHORED at OSA-1. The structure domain's state is now DERIVED by `structureState`, so the
     * defect is injected where that function decides it: an UNREAD structure downgraded from
     * `no-authority` to `known-empty` is exactly "could not look" rendered as "looked and found
     * none", which is the defect this proof has always been about.
     */
    find: `    return { status: "no-authority", detail: LIVE_MAP_STRUCTURE_ABSENT };`,
    replace: `    return { status: "known-empty", detail: LIVE_MAP_STRUCTURE_ABSENT };`,
    expect: "no-authority",
  },
  {
    /*
     * THE EDGE DRAWN TO SOMETHING THE READER CANNOT SEE. The agents are real; the organization is
     * not on the map, so the relationship has no far end and must not be asserted.
     */
    label: "V5 an edge is drawn when the organization is unavailable",
    file: PROJECTION,
    suite: TRUTH_SUITE,
    /*
     * "Keep the graph connected" — the edge is kept and its far end is synthesized. Deleting the
     * guard outright throws instead, because the guard also narrows the type; a crash proves the
     * compiler was watching, not that the suite was.
     */
    find: `  if (organization.state.status !== "available") return [];
  if (agents.state.status !== "available") return [];
  const organizationNode = organization.state.nodes[0];
  if (!organizationNode) return [];`,
    replace: `  if (agents.state.status !== "available") return [];
  const organizationNode =
    organization.state.status === "available"
      ? organization.state.nodes[0]
      : { nodeId: "organization:unknown" };
  if (!organizationNode) return [];`,
    expect: "an edge is never drawn to a node the reader cannot see",
  },
  {
    /* AN EDGE WITHOUT ITS BASIS IS A LINE BETWEEN TWO BOXES. */
    label: "V6 the edge stops naming the fact that proves it",
    file: PROJECTION,
    suite: TRUTH_SUITE,
    find: `      "agents.tenant_id — the durable column whose value is this organization's own identity. " +`,
    replace: `      "These are related. " +`,
    expect: "the edge names the durable column that proves it",
  },
  {
    /* A RETIRED IDENTITY DRAWN WITHOUT ITS STATE READS AS A WORKING AGENT. */
    label: "V7 retirement stops being visible on the node",
    file: PROJECTION,
    suite: TRUTH_SUITE,
    find: `      identity.inService\n        ? "In service."`,
    replace: `      identity.inService || true\n        ? "In service."`,
    expect: "a retired identity says so on the map",
  },
  {
    /* MEMBERSHIP IS NOT PLACEMENT. */
    label: "V8 people become their own domain with a measured zero",
    file: PROJECTION,
    suite: TRUTH_SUITE,
    find: `    state: { status: "no-authority", detail: LIVE_MAP_PEOPLE_ABSENT },`,
    replace: `    state: { status: "known-empty", detail: LIVE_MAP_PEOPLE_ABSENT },`,
    expect: "no-authority",
  },
  {
    /*
     * THE ADMISSION RULE ITSELF. Widening `LiveMapTruth` is the single edit that would let derived
     * or mock nodes onto the map, and it is the one a reviewer must refuse.
     */
    label: "V9 LiveMapTruth is widened to admit derived nodes",
    file: CONTRACTS,
    suite: FIREWALL_SUITE,
    find: `export type LiveMapTruth = "authoritative";`,
    replace: `export type LiveMapTruth = "authoritative" | "derived";`,
    expect: "LiveMapTruth admits exactly one value",
  },
  {
    /*
     * THE TRANSITIVE GATE. Importing the agent barrel for one read pulls two lifecycle writers into
     * the graph — the exact shape G2 found when Heby reached Governance "just for the DB handle".
     */
    label: "V10 the agent read is taken through the barrel that re-exports its writers",
    file: PROJECTION,
    suite: FIREWALL_SUITE,
    find: `import { readDurableAgentIdentityState } from "@/features/agent-identity/read-durable-agent-identity.server";`,
    replace: `import { readDurableAgentIdentityState } from "@/features/agent-identity";`,
    expect: "must not reach the agent identity writer",
  },
  {
    /* A PROJECTION THAT HOLDS A HANDLE IS ONE EDIT FROM BEING A WRITER. */
    label: "V11 Live Map acquires its own database handle",
    file: PROJECTION,
    suite: FIREWALL_SUITE,
    find: `export interface LiveMapDeps {`,
    replace: `import { getControlPlaneDb } from "@/db/client.server";\nvoid getControlPlaneDb;\nexport interface LiveMapDeps {`,
    expect: "must not contain getControlPlaneDb",
  },
  {
    /* AND ONE THAT WRITES IS NOT A PROJECTION AT ALL. */
    label: "V12 Live Map gains a durable writer",
    file: PROJECTION,
    suite: FIREWALL_SUITE,
    find: `/** Projection identities. Kind-prefixed so a node id can never be mistaken for a domain id. */`,
    replace:
      `import { getControlPlaneDb } from "@/db/client.server";\n` +
      `import { companies } from "@/db/schema/company";\n` +
      `export async function renameOrganization(id: string, name: string): Promise<void> {\n` +
      `  await getControlPlaneDb().update(companies).set({ name }).where(eq(companies.id, id));\n` +
      `}\n` +
      `/** Projection identities. Kind-prefixed so a node id can never be mistaken for a domain id. */`,
    expect: "performs no durable write",
  },
  {
    /* THE MAP MUST NOT NAME ITSELF AS THE OWNER OF A FACT IT DRAWS. */
    label: "V13 Live Map claims to be the source authority",
    file: PROJECTION,
    suite: TRUTH_SUITE,
    find: `    sourceAuthority: "Organization Authority",`,
    replace: `    sourceAuthority: "Live Map",`,
    expect: "Live Map is never named as the authority",
  },
  {
    /* NO FAKE REAL-TIME. */
    label: "V14 the surface claims to refresh on its own",
    file: CONTRACTS,
    suite: TRUTH_SUITE,
    find: `  "A server read taken when this page was requested. Live Map is not a stream and does not " +\n  "refresh on its own — reload to read again.";`,
    replace: `  "Real-time view of your organization, auto-refreshing continuously.";`,
    expect: "the surface says what this reading is",
  },
  {
    /* A CONTROL ON A MAP IMPLIES AN AUTHORITY THE MAP DOES NOT HAVE. */
    label: "V15 the canvas gains an action control",
    file: CANVAS,
    suite: FIREWALL_SUITE,
    find: `      {node.openRoute ? (`,
    replace: `      <button type="button">Rename</button>\n      {node.openRoute ? (`,
    expect: "Live Map Core offers navigation only",
  },
  {
    /* THE TENANT MUST COME FROM THE SESSION AND FROM NOWHERE ELSE. */
    label: "V16 the page takes its organization from the query string",
    file: PAGE,
    suite: FIREWALL_SUITE,
    find: `  const projection = await readLiveMapProjection(await resolveTenantContext());`,
    replace: `  const searchParams = {} as { tenant?: string };\n  void searchParams;\n  const projection = await readLiveMapProjection(await resolveTenantContext());`,
    expect: "no query parameter reaches the projection",
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
  console.log(`l4-live-map/bite-proofs: ${bitten} mutations bit`);
}

main();
