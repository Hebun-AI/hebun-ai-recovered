/*
 * MV-4 bite-proofs. Each mutation disables ONE lifecycle guard in a copy of the released writer; the
 * same scenarios that pass against the released module must FAIL against every copy. A mutation that
 * survives means the suite is not protecting that guard.
 */
import assert from "node:assert/strict";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { runScenarios } from "./scenarios";

globalThis.fetch = (() => {
  throw new Error("REAL NETWORK REACHED");
}) as typeof fetch;

const DIR = path.resolve(process.cwd(), "src/features/media-assets");
const SOURCE = readFileSync(path.join(DIR, "async-generation-lifecycle.server.ts"), "utf8");

const BITES: readonly { readonly name: string; readonly find: string; readonly replace: string }[] = [
  {
    name: "B1 the CAS forgets the expected state",
    find: "        eq(mediaGenerationInvocations.state, from),\n",
    replace: "",
  },
  {
    name: "B2 an ambiguous dispatch is recorded as a failure",
    find: `    to = "dispatch-unknown";\n    patch = { state: to, finalizedAt: at };`,
    replace: `    to = "provider-failed";\n    patch = { state: to, providerFailure: "timeout", finalizedAt: at };`,
  },
  {
    name: "B3 a terminal job is polled again",
    find: `if (row.state !== "provider-pending" || !row.providerJobId)`,
    replace: `if (!row.providerJobId)`,
  },
  {
    name: "B4 the row is loaded without its tenant",
    find: `.where(and(eq(mediaGenerationInvocations.tenantId, tenantId), eq(mediaGenerationInvocations.id, invocationId)))`,
    replace: `.where(eq(mediaGenerationInvocations.id, invocationId))`,
  },
  {
    name: "B5 a provider output reference is not validated",
    find: `PROVIDER_OUTPUT_REF_RE.test(observation.outputRef)`,
    replace: `observation.outputRef.length > 0`,
  },
  {
    name: "B6 an acceptance naming no job is treated as pending",
    find: `const jobId = outcome.status === "accepted" ? usableJobId(outcome.providerJobId) : null;`,
    replace: `const jobId = outcome.status === "accepted" ? (outcome.providerJobId || "phantom") : null;`,
  },
];

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("mv4-async-generation/bite-proofs: exited before completing");
    process.exitCode = 1;
  }
});

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_mv4_bites");
  await harness.createDatabase();
  const client = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const getDb = () => handle.db;
  try {
    harness.migrateDatabase();
    await client.connect();

    /* The unmutated copy passes: the harness itself is not what fails below. */
    const control = path.join(DIR, `.mv4-bite-control.server.ts`);
    writeFileSync(control, SOURCE);
    try {
      await runScenarios(await import(pathToFileURL(control).href), client, getDb, "control");
    } finally {
      rmSync(control, { force: true });
    }

    for (const [i, bite] of BITES.entries()) {
      assert.equal(SOURCE.split(bite.find).length, 2, `${bite.name}: the mutation site is unique`);
      const file = path.join(DIR, `.mv4-bite-${i}.server.ts`);
      writeFileSync(file, SOURCE.replace(bite.find, bite.replace));
      let survived = false;
      try {
        await runScenarios(await import(pathToFileURL(file).href), client, getDb, bite.name);
        survived = true;
      } catch (error) {
        console.log(`BITE ${bite.name}: ${(error as Error).message.split("\n")[0]!.slice(0, 110)}`);
      } finally {
        rmSync(file, { force: true });
      }
      assert.equal(survived, false, `${bite.name} SURVIVED — the suite does not guard it`);
    }
  } finally {
    await client.end().catch(() => undefined);
    await handle.dispose().catch(() => undefined);
    await harness.dropDatabase();
  }
  finished = true;
  console.log(`mv4-async-generation/bite-proofs: ok (${BITES.length} bites)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
