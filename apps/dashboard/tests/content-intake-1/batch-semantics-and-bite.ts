/*
 * CONTENT-INTAKE-1 — batch semantics over counted fakes, and BITE-PROOFS against the real module.
 *
 * The scenarios run first against `admit-supplied-drive-batch.server.ts` as written (every one must
 * pass), then against mutants of that file — each mutant relaxes exactly one invariant, and the
 * scenarios must CATCH it. A mutant that survives is a scenario that does not protect what it claims.
 *
 *   bound            the server refuses more than the kind's maximum, before anything is read
 *   no-fallback      a binding that does not verify stops the batch before any admission runs
 *   partial          a batch-level refusal stops further reads; a file refusal does not stop others
 *   provenance       an admitted row naming another connection stops the batch
 *   time-budget      no file is started after the cutoff; the rest are `not-attempted`
 *   dedupe           a repeated id in one request is not admitted twice
 *
 * No database, no network.
 */
import assert from "node:assert/strict";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { CONTENT_INTAKE_BATCH_LIMITS, summarizeBatchOutcomes } from "../../src/features/content-intake/contracts";
import type * as BatchModule from "../../src/features/content-intake/admit-supplied-drive-batch.server";

const ROOT = process.cwd();
const MODULE = "src/features/content-intake/admit-supplied-drive-batch.server.ts";
const TENANT = { tenantId: "t-1", userId: "u-1", sessionContextId: "s-1" } as unknown as TenantContext;
const BOUND = "0b0b0b0b-0000-4000-8000-000000000001";
const OTHER = "0b0b0b0b-0000-4000-8000-000000000002";
const DRAFT = "0d0d0d0d-0000-4000-8000-000000000001";

type Admit = typeof BatchModule.admitSuppliedDriveBatch;
type Script = Record<string, { status: "admitted" | "existing"; integration?: string } | { status: "refused"; reason: string }>;

function fakes(script: Script, opts: { bindingOk?: boolean; clock?: number[] } = {}) {
  const admitted: string[] = [];
  const admit = async (_t: TenantContext, i: { driveFileId: string; pickerBinding: string; artifactId: string; revisionNo: number }) => {
    admitted.push(i.driveFileId);
    assert.equal(i.pickerBinding, "the-binding", "every file carries the ONE binding");
    assert.equal(i.artifactId, DRAFT, "every file carries the ONE draft");
    assert.equal(i.revisionNo, 2, "every file carries the ONE revision");
    const s = script[i.driveFileId] ?? { status: "admitted" as const };
    if (s.status === "refused") return { status: "refused" as const, reason: s.reason as never };
    return {
      status: s.status,
      asset: { assetId: `asset-${i.driveFileId}`, suppliedSourceIntegrationId: s.integration ?? BOUND } as never,
    };
  };
  const clock = opts.clock ? [...opts.clock] : null;
  return {
    admitted,
    deps: {
      admitImage: admit as never,
      admitVideo: admit as never,
      resolveBinding: async () =>
        opts.bindingOk === false
          ? ({ status: "refused", reason: "binding-signature-invalid" } as const)
          : ({ status: "bound", integrationId: BOUND, externalAccountId: "sub-1" } as const),
      nowMs: () => (clock && clock.length > 1 ? clock.shift()! : clock ? clock[0]! : 0),
    },
  };
}

const input = (ids: string[]) => ({ artifactId: DRAFT, revisionNo: 2, driveFileIds: ids, pickerBinding: "the-binding" });

/** Every scenario, as a list of named checks. Returns the names that FAILED. */
async function scenarios(admitBatch: Admit): Promise<string[]> {
  const failed: string[] = [];
  const check = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      failed.push(`${name}: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
    }
  };

  await check("bound", async () => {
    for (const kind of ["image", "video"] as const) {
      const max = CONTENT_INTAKE_BATCH_LIMITS[kind].maxFiles;
      const f = fakes({});
      const over = await admitBatch(kind, TENANT, input(Array.from({ length: max + 1 }, (_, i) => `f${i}`)), f.deps);
      assert.deepEqual(over, { status: "refused", reason: "batch-too-large", detail: `max-${max}` });
      assert.equal(f.admitted.length, 0, "nothing admitted over the bound");
      const at = await admitBatch(kind, TENANT, input(Array.from({ length: max }, (_, i) => `f${i}`)), f.deps);
      assert.equal(at.status === "processed" && at.summary.admitted, max, "exactly the bound is accepted");
    }
    assert.equal(CONTENT_INTAKE_BATCH_LIMITS.image.maxFiles, 10);
    assert.equal(CONTENT_INTAKE_BATCH_LIMITS.video.maxFiles, 3);
  });

  await check("shape", async () => {
    const f = fakes({});
    assert.deepEqual(await admitBatch("image", TENANT, input([]), f.deps), { status: "refused", reason: "batch-empty" });
    assert.deepEqual(await admitBatch("image", null, input(["a"]), f.deps), { status: "refused", reason: "unauthenticated" });
    assert.deepEqual(await admitBatch("image", TENANT, { ...input(["a"]), driveFileIds: "a" as never }, f.deps), { status: "refused", reason: "invalid-input" });
    assert.deepEqual(await admitBatch("image", TENANT, input([7 as never]), f.deps), { status: "refused", reason: "invalid-input" });
    assert.equal(f.admitted.length, 0);
  });

  await check("no-fallback", async () => {
    const f = fakes({}, { bindingOk: false });
    const r = await admitBatch("image", TENANT, input(["a", "b"]), f.deps);
    assert.deepEqual(r, { status: "refused", reason: "drive-connection-not-bound", detail: "binding-signature-invalid" });
    assert.equal(f.admitted.length, 0, "no file is admitted under a binding that does not verify");
  });

  await check("partial", async () => {
    /* A FILE refusal in the middle: before and after are still admitted, and nothing is called a success it was not. */
    const f = fakes({ b: { status: "refused", reason: "unsupported-image-signature" }, d: { status: "existing" } });
    const r = await admitBatch("image", TENANT, input(["a", "b", "c", "d"]), f.deps);
    assert.ok(r.status === "processed");
    assert.deepEqual(r.files.map((x) => x.status), ["admitted", "refused", "admitted", "existing"]);
    assert.deepEqual(r.summary, { requested: 4, admitted: 2, existing: 1, refused: 1, notAttempted: 0, duplicateSelections: 0 });
    assert.equal(r.stoppedBy, null);
    assert.deepEqual(r.summary, summarizeBatchOutcomes(r.files), "the summary is derived from the files");
    /* A BATCH refusal (the binding stopped verifying mid-batch): the admitted file stays admitted, the rest are not read. */
    const g = fakes({ b: { status: "refused", reason: "drive-connection-not-bound" } });
    const s = await admitBatch("image", TENANT, input(["a", "b", "c", "d"]), g.deps);
    assert.ok(s.status === "processed");
    assert.deepEqual(s.files.map((x) => x.status), ["admitted", "refused", "not-attempted", "not-attempted"]);
    assert.equal(s.stoppedBy, "batch-condition");
    assert.deepEqual(g.admitted, ["a", "b"], "nothing is read after a batch-level refusal");
    for (const reason of ["source-revision-unresolvable", "storage-unavailable", "persistence-unavailable", "drive-capability-not-available"]) {
      const h = fakes({ a: { status: "refused", reason } });
      const t = await admitBatch("video", TENANT, input(["a", "b"]), h.deps);
      assert.equal(t.status === "processed" && t.stoppedBy, "batch-condition", reason);
      assert.deepEqual(h.admitted, ["a"], reason);
    }
  });

  await check("provenance", async () => {
    const f = fakes({ a: { status: "admitted", integration: OTHER } });
    const r = await admitBatch("image", TENANT, input(["a", "b"]), f.deps);
    assert.ok(r.status === "processed");
    assert.equal(r.stoppedBy, "provenance-mismatch");
    assert.equal(r.files[0]!.status, "admitted", "the row exists, so it is reported as it is");
    assert.equal(r.files[1]!.status, "not-attempted");
    /* An EXISTING historical row may name nothing (admitted before provenance was recorded). */
    const g = fakes({ a: { status: "existing", integration: null as never } });
    const s = await admitBatch("image", TENANT, input(["a", "b"]), g.deps);
    assert.equal(s.status === "processed" && s.stoppedBy, null);
  });

  await check("time-budget", async () => {
    const cut = CONTENT_INTAKE_BATCH_LIMITS.image.startCutoffMs;
    /* start=0; file a starts at 10; file b would start at cut → not attempted; c likewise. */
    const f = fakes({}, { clock: [0, 10, cut, cut + 1] });
    const r = await admitBatch("image", TENANT, input(["a", "b", "c"]), f.deps);
    assert.ok(r.status === "processed");
    assert.deepEqual(r.files.map((x) => x.status), ["admitted", "not-attempted", "not-attempted"]);
    assert.equal(r.stoppedBy, "time-budget");
    assert.deepEqual(f.admitted, ["a"], "nothing was read for the files not attempted");
  });

  await check("dedupe", async () => {
    const f = fakes({});
    const r = await admitBatch("image", TENANT, input(["a", "a", "b", "a"]), f.deps);
    assert.ok(r.status === "processed");
    assert.deepEqual(r.files.map((x) => x.status), ["admitted", "duplicate-selection", "admitted", "duplicate-selection"]);
    assert.deepEqual(f.admitted, ["a", "b"], "a repeated id is read once");
  });

  await check("kind", async () => {
    const images: string[] = [];
    const videos: string[] = [];
    const base = fakes({});
    const deps = {
      ...base.deps,
      admitImage: (async (_t: TenantContext, i: { driveFileId: string }) => (images.push(i.driveFileId), { status: "admitted", asset: { assetId: "x", suppliedSourceIntegrationId: BOUND } })) as never,
      admitVideo: (async (_t: TenantContext, i: { driveFileId: string }) => (videos.push(i.driveFileId), { status: "admitted", asset: { assetId: "y", suppliedSourceIntegrationId: BOUND } })) as never,
    };
    await admitBatch("image", TENANT, input(["i1"]), deps);
    await admitBatch("video", TENANT, input(["v1"]), deps);
    assert.deepEqual([images, videos], [["i1"], ["v1"]], "the kind — never a MIME claim — picks the admission");
  });

  return failed;
}

/** Write a mutant beside the module (so its `@/` and `./` imports resolve), import it, then remove it. */
async function withMutant(name: string, from: string, to: string): Promise<Admit> {
  const src = readFileSync(path.join(ROOT, MODULE), "utf8");
  assert.ok(src.includes(from), `bite-proof ${name}: the mutation site must exist`);
  const file = path.join(ROOT, `src/features/content-intake/.bite-${name}.server.ts`);
  writeFileSync(file, src.replace(from, to));
  try {
    const mod = (await import(`${pathToFileURL(file).href}?${Date.now()}`)) as typeof BatchModule;
    return mod.admitSuppliedDriveBatch;
  } finally {
    rmSync(file, { force: true });
  }
}

const MUTANTS: ReadonlyArray<{ name: string; from: string; to: string; mustFail: string }> = [
  { name: "bound", from: "if (ids.length > limits.maxFiles)", to: "if (false)", mustFail: "bound" },
  { name: "fallback", from: 'if (bound.status !== "bound") {', to: "if (false) {", mustFail: "no-fallback" },
  { name: "partial", from: 'if (BATCH_CONDITIONS.has(result.reason)) stoppedBy = "batch-condition";', to: "", mustFail: "partial" },
  { name: "provenance", from: 'stoppedBy = "provenance-mismatch";', to: "", mustFail: "provenance" },
  { name: "time", from: "now() - startedAt >= limits.startCutoffMs", to: "false", mustFail: "time-budget" },
  { name: "dedupe", from: "if (seen.has(fileId)) {", to: "if (false) {", mustFail: "dedupe" },
];

async function main(): Promise<void> {
  const real = (await import("../../src/features/content-intake/admit-supplied-drive-batch.server")).admitSuppliedDriveBatch;
  const baseline = await scenarios(real);
  assert.deepEqual(baseline, [], `every scenario passes against the module as written:\n${baseline.join("\n")}`);

  for (const m of MUTANTS) {
    const mutant = await withMutant(m.name, m.from, m.to);
    const failed = await scenarios(mutant);
    assert.ok(
      failed.some((f) => f.startsWith(`${m.mustFail}:`)),
      `BITE-PROOF ${m.name}: the mutant survived — "${m.mustFail}" must catch it (failed: ${failed.join(" | ") || "none"})`,
    );
    console.log(`  bite-proof ${m.name}: caught by ${m.mustFail}`);
  }
  console.log("content-intake-1 batch semantics + bite-proofs: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
