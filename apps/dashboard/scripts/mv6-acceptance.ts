/*
 * scripts/mv6-acceptance.ts — MV-6 real-provider acceptance harness, STAGE 1: cost evidence only.
 *
 *   npx tsx scripts/mv6-acceptance.ts preflight   check the credential file's SHAPE; no network
 *   npx tsx scripts/mv6-acceptance.ts estimate             the baseline set (pinned + 2 comparators)
 *   npx tsx scripts/mv6-acceptance.ts estimate seedance    the Seedance comparison set (4, measurement only)
 *
 * Each estimate run is one `POST /estimate/<model>` per candidate of ONE named set; no job.
 *
 * WHAT IT NEVER DOES. It submits no generation, reads no job status, cancels nothing, writes no row,
 * reads or writes no database, and arms no control. Generation is NOT here: the one-job, Director-
 * gated real-provider stage is `scripts/mv6-generate-acceptance.ts`, kept separate so this estimate
 * harness can never reach a generation endpoint.
 *
 * ENV. HEBUN_HIGGSFIELD_API_KEY — the ONE opaque key copied from open.higgsfield.ai, used verbatim —
 * read by name only from the file
 * named by MV6_HIGGSFIELD_ENV_FILE (default ./.env.higgsfield.local, gitignored by `.env.*`). Nothing
 * is read from the ambient environment, so a production value cannot be picked up by accident.
 * Absent or malformed → refused before any call. No value, header or provider message is printed.
 */
import { loadHiggsfieldCredentialOrRefuse } from "./lib/higgsfield-credential-file";
import { estimateCandidates, MV6_ESTIMATE_SETS, MV6_SYNTHETIC_PROMPT } from "./lib/higgsfield-estimate";

async function main(): Promise<void> {
  const command = process.argv[2] ?? "";
  const setName = process.argv[3] ?? "baseline";
  if ((command !== "preflight" && command !== "estimate") || process.argv.length > 4) {
    throw new Error("usage: mv6-acceptance.ts preflight | estimate [baseline|seedance]  (no generation stage here — see mv6-generate-acceptance.ts)");
  }
  const candidates = Object.prototype.hasOwnProperty.call(MV6_ESTIMATE_SETS, setName) ? MV6_ESTIMATE_SETS[setName]! : null;
  if (command === "estimate" && !candidates) {
    throw new Error("usage: mv6-acceptance.ts preflight | estimate [baseline|seedance]  (unknown estimate set; no generation stage here — see mv6-generate-acceptance.ts)");
  }
  const credential = loadHiggsfieldCredentialOrRefuse();
  console.log("PASS  credential file holds a credential-shaped HEBUN_HIGGSFIELD_API_KEY (value not shown)");
  if (command === "preflight") return;

  console.log(`prompt (synthetic): ${MV6_SYNTHETIC_PROMPT}`);
  console.log(`set: ${setName}; candidates: ${candidates!.length}, one estimate call each, never repeated, no generation`);
  const results = await estimateCandidates(credential, (input, init) => fetch(input, init), candidates!);
  for (const r of results) {
    const tag = r.pinned ? "PINNED   " : "candidate";
    if (r.status === "estimated") console.log(`${tag}  ${r.label}  credits=${r.credits}  usd=${r.usd}`);
    else if (r.status === "refused") console.log(`${tag}  ${r.label}  REFUSED http ${r.httpStatus}`);
    else console.log(`${tag}  ${r.label}  ${r.status.toUpperCase()}`);
  }
  const estimated = results.filter((r): r is Extract<typeof r, { status: "estimated" }> => r.status === "estimated");
  if (estimated.length > 0) {
    const cheapest = [...estimated].sort((a, b) => Number(a.usd) - Number(b.usd))[0]!;
    console.log(`cheapest estimated: ${cheapest.label}${cheapest.pinned ? " (the pinned model)" : " — NOT the pinned model; the pin is a Director decision"}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "mv6-acceptance failed");
  process.exit(1);
});
