/*
 * scripts/mv6-generate-acceptance.ts — MV-6 real-provider acceptance, STAGE 2: ONE billable job.
 *
 *   npx tsx scripts/mv6-generate-acceptance.ts generate hailuo --confirm-one-billable-higgsfield-job
 *
 * Anything else is refused before the credential is read. There is no other model, no count, no
 * retry and no loop over jobs.
 *
 * WHAT IT DOES. Builds a DISPOSABLE local Postgres from the canonical migrations and seeds synthetic
 * prerequisites (acceptance-only tooling, `tests/helpers/mv6-acceptance-environment.ts`, imported
 * dynamically and only here). Constructs the Higgsfield transport with the acceptance-only
 * `hailuo-2.3-standard` profile and a ONE-unit spend budget, so a second generation POST is
 * impossible even below the orchestrator. Then runs `runGenerationAcceptance`: register → exactly one
 * dispatch → bounded status polling → report. The database is dropped at the end.
 *
 * WHAT IT NEVER DOES. Touch the production database, a production credential or a control; retry a
 * POST; dispatch again after `dispatch-unknown`; download, store or admit output; print the API key,
 * the Authorization header or an output URL. The provider request id IS printed: it is the handle the
 * Director needs to find the job in the Higgsfield console, and it is not a credential.
 *
 * WHAT A PASS MEANS. "Higgsfield real-provider lifecycle VERIFIED in the disposable acceptance
 * environment." Not production CONNECTED, not PRODUCTION ACCEPTED, not a Media asset, not verified
 * bytes, not a playable video, and not MV-6 closed.
 */
import { randomUUID } from "node:crypto";
import { loadHiggsfieldCredentialOrRefuse } from "./lib/higgsfield-credential-file";
import { MV6_SYNTHETIC_PROMPT } from "./lib/higgsfield-estimate";
import { describeGenerationAcceptance, runGenerationAcceptance } from "./lib/mv6-generation-acceptance";
import { createLiveSpendBudget } from "../src/features/heby-model-live/live-spend-budget.server";
import { createHiggsfieldVideoTransport } from "../src/features/media-generation-live/higgsfield-video-transport.server";

export const MV6_GENERATE_CONFIRMATION = "--confirm-one-billable-higgsfield-job";
const USAGE = `usage: mv6-generate-acceptance.ts generate hailuo ${MV6_GENERATE_CONFIRMATION}  (exactly one billable job; nothing else is accepted)`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length !== 3 || args[0] !== "generate" || args[1] !== "hailuo" || args[2] !== MV6_GENERATE_CONFIRMATION) {
    throw new Error(`REFUSED: ${USAGE}`);
  }
  const credential = loadHiggsfieldCredentialOrRefuse();
  console.log("PASS  credential file holds a credential-shaped HEBUN_HIGGSFIELD_API_KEY (value not shown)");

  const { createMv6AcceptanceEnvironment } = await import("../tests/helpers/mv6-acceptance-environment");
  const env = await createMv6AcceptanceEnvironment();
  try {
    const transport = createHiggsfieldVideoTransport({ credential, profile: "hailuo-2.3-standard", spendBudget: createLiveSpendBudget(1) });
    console.log(`profile: hailuo-2.3-standard (${transport.model}); disposable database; one dispatch; synthetic prompt`);
    const e = await runGenerationAcceptance({
      tenant: env.tenant,
      artifactId: env.artifactId,
      revisionNo: env.revisionNo,
      promptText: MV6_SYNTHETIC_PROMPT,
      requestKey: randomUUID(),
      getDb: env.getDb,
      transport,
      countMediaAssets: env.countMediaAssets,
    });
    console.log(`stop: ${e.stop}${e.detail ? ` (${e.detail})` : ""}`);
    console.log(`dispatch calls: ${e.dispatchCalls}; final state: ${e.finalState ?? "none"}; provider failure: ${e.providerFailure ?? "none"}`);
    console.log(`provider request id: ${e.providerJobId ?? "none"}; output reference is the request id: ${e.outputRefIsJobId ?? "n/a"}`);
    console.log(`polls: ${e.polls} (unreadable ${e.unreadableObservations}); elapsed: ${Math.round(e.elapsedMs / 1000)} s; admission: ${e.admissionOutcome ?? "n/a"}`);
    console.log(`media_assets: ${e.mediaAssetsBefore} -> ${e.mediaAssetsAfter}`);
    console.log(describeGenerationAcceptance(e));
  } finally {
    await env.dispose();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "mv6-generate-acceptance failed");
  process.exit(1);
});
