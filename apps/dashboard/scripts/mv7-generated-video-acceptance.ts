/*
 * scripts/mv7-generated-video-acceptance.ts — MV-7 real-provider acceptance. Two stages, two gates.
 *
 *   node --import tsx scripts/mv7-generated-video-acceptance.ts reobserve <request_id> --confirm-one-status-read
 *   node --import tsx scripts/mv7-generated-video-acceptance.ts admit <request_id> --confirm-one-output-fetch
 *
 * Only the MV-6 acceptance request id is accepted. Anything else is refused before the credential is
 * read. The transport is built with a ZERO spend budget and a guarded fetch that refuses any POST
 * before sending, so no stage can start a generation.
 *
 * `reobserve` sends ONE status GET and prints the provider answer and the output URL's SHAPE — never
 * the URL, its path or a query value. It fetches no output byte and writes nothing.
 *
 * `admit` refuses before any network call while no output host is approved (HIGGSFIELD_OUTPUT_HOSTS is
 * empty). With one approved: a disposable Postgres + local store, the acceptance fixture invocation,
 * the REAL MV-4 poll (one GET), the REAL admission (one GET + one output fetch), then provider-free
 * verification. Everything is destroyed at the end.
 */
import { loadHiggsfieldCredentialOrRefuse } from "./lib/higgsfield-credential-file";
import {
  MV7_ACCEPTANCE_REQUEST_ID,
  MV7_ADMIT_CONFIRMATION,
  MV7_REOBSERVE_CONFIRMATION,
  describeReobservation,
  guardedHiggsfieldFetch,
  runAdmissionAcceptance,
  runReobservation,
} from "./lib/mv7-generated-video-acceptance";
import { createLiveSpendBudget } from "../src/features/heby-model-live/live-spend-budget.server";
import {
  HIGGSFIELD_OUTPUT_HOSTS,
  createHiggsfieldVideoTransport,
  higgsfieldStatusUrl,
} from "../src/features/media-generation-live/higgsfield-video-transport.server";

const USAGE =
  `usage: mv7-generated-video-acceptance.ts reobserve ${MV7_ACCEPTANCE_REQUEST_ID} ${MV7_REOBSERVE_CONFIRMATION}\n` +
  `       mv7-generated-video-acceptance.ts admit ${MV7_ACCEPTANCE_REQUEST_ID} ${MV7_ADMIT_CONFIRMATION}`;

async function main(): Promise<void> {
  const [stage, requestId, confirmation, ...rest] = process.argv.slice(2);
  const valid =
    rest.length === 0 &&
    requestId === MV7_ACCEPTANCE_REQUEST_ID &&
    ((stage === "reobserve" && confirmation === MV7_REOBSERVE_CONFIRMATION) || (stage === "admit" && confirmation === MV7_ADMIT_CONFIRMATION));
  if (!valid) throw new Error(`REFUSED: ${USAGE}`);
  if (stage === "admit" && HIGGSFIELD_OUTPUT_HOSTS.length === 0) {
    throw new Error("REFUSED: no Higgsfield output host is approved (HIGGSFIELD_OUTPUT_HOSTS is empty) — admission is not executable");
  }

  const credential = loadHiggsfieldCredentialOrRefuse();
  console.log("PASS  credential file holds a credential-shaped HEBUN_HIGGSFIELD_API_KEY (value not shown)");
  const statusUrl = higgsfieldStatusUrl(requestId);
  /* reobserve: one GET. admit: the MV-4 poll + the admission's re-observation — two GETs, same URL. */
  const guard = guardedHiggsfieldFetch((url, init) => fetch(url, init), { maxGets: stage === "reobserve" ? 1 : 2, allowedUrls: [statusUrl] });
  const transport = createHiggsfieldVideoTransport({
    credential,
    profile: "hailuo-2.3-standard",
    spendBudget: createLiveSpendBudget(0),
    fetchImpl: guard.fetchImpl,
  });
  console.log(`profile: hailuo-2.3-standard (${transport.model}); spend budget 0; POST refused before sending`);

  if (stage === "reobserve") {
    const report = await runReobservation({ transport, requestId, counts: guard.counts });
    for (const line of describeReobservation(report)) console.log(line);
    return;
  }

  const { createMv7AcceptanceEnvironment } = await import("../tests/helpers/mv7-acceptance-environment");
  const env = await createMv7AcceptanceEnvironment();
  try {
    const r = await runAdmissionAcceptance({ env, transport, requestId });
    console.log(`poll: ${r.pollOutcome}; stop: ${r.stop}`);
    if (r.admission) {
      const a = r.admission;
      if (a.status === "admitted" || a.status === "existing") {
        const x = a.asset;
        console.log(`admission: ${a.status}; asset ${x.assetId}; ${x.byteSize} bytes; sha256 ${x.byteDigest}`);
        console.log(`video: ${x.container} ${x.videoCodec}/${x.audioCodec ?? "no-audio"} ${x.width}x${x.height} ${x.durationMs} ms @ ${x.frameRate}`);
      } else {
        console.log(`admission: ${JSON.stringify(a)}`);
      }
    }
    console.log(`invocation admission_outcome: ${r.invocationAdmissionOutcome ?? "n/a"}; media_assets ${r.mediaAssetsBefore} -> ${r.mediaAssetsAfter}`);
    console.log(`stored bytes = row: ${r.storedVerified ? "YES" : "NO"}; read model origin: ${r.readModelOrigin ?? "n/a"}; Range: ${r.rangeStatus ?? "n/a"} (${r.rangeBytes ?? 0} bytes)`);
    console.log(`requests: ${guard.counts.gets} GET, ${guard.counts.posts} POST attempted`);
  } finally {
    await env.dispose();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "mv7-generated-video-acceptance failed");
  process.exit(1);
});
