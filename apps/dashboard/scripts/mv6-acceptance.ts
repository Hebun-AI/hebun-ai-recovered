/*
 * scripts/mv6-acceptance.ts — MV-6 real-provider acceptance harness, STAGE 1: cost evidence only.
 *
 *   npx tsx scripts/mv6-acceptance.ts preflight   check the credential file's SHAPE; no network
 *   npx tsx scripts/mv6-acceptance.ts estimate    one `POST /estimate/<model>` per candidate; no job
 *
 * WHAT IT NEVER DOES. It submits no generation, reads no job status, cancels nothing, writes no row,
 * reads or writes no database, and arms no control. There is no generation subcommand in this build:
 * a billable Higgsfield job is a separate Director authorization, and the stage that performs one
 * (through the released MV-4 lifecycle, at most one job, synthetic prompt) is written only after it.
 *
 * ENV. HEBUN_HIGGSFIELD_API_KEY_ID and HEBUN_HIGGSFIELD_API_KEY_SECRET, read by name only from the file
 * named by MV6_HIGGSFIELD_ENV_FILE (default ./.env.higgsfield.local, gitignored by `.env.*`). Nothing
 * is read from the ambient environment, so a production value cannot be picked up by accident.
 * Absent or malformed → refused before any call. No value, header or provider message is printed.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { loadQuietEnv } from "./lib/quiet-env";
import { estimateCandidates, MV6_ESTIMATE_CANDIDATES, MV6_SYNTHETIC_PROMPT } from "./lib/higgsfield-estimate";
import { isHiggsfieldCredentialShaped } from "../src/features/media-generation-live/higgsfield-video-transport.server";

const NAMES = ["HEBUN_HIGGSFIELD_API_KEY_ID", "HEBUN_HIGGSFIELD_API_KEY_SECRET"] as const;

function loadCredentialOrRefuse(): { keyId: string; keySecret: string } {
  const file = process.env.MV6_HIGGSFIELD_ENV_FILE ?? path.resolve(process.cwd(), ".env.higgsfield.local");
  if (!existsSync(file)) throw new Error("REFUSED: MV6_HIGGSFIELD_ENV_FILE (or ./.env.higgsfield.local) does not exist");
  for (const name of NAMES) delete process.env[name];
  loadQuietEnv([file], NAMES);
  const credential = { keyId: process.env[NAMES[0]] ?? "", keySecret: process.env[NAMES[1]] ?? "" };
  for (const name of NAMES) delete process.env[name];
  if (!isHiggsfieldCredentialShaped(credential)) {
    throw new Error("REFUSED: the credential file does not hold a credential-shaped key id and secret (values not shown)");
  }
  return credential;
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "";
  if (command !== "preflight" && command !== "estimate") {
    throw new Error("usage: mv6-acceptance.ts preflight|estimate  (no generation stage exists in this build)");
  }
  const credential = loadCredentialOrRefuse();
  console.log("PASS  credential file holds a credential-shaped key id and secret (values not shown)");
  if (command === "preflight") return;

  console.log(`prompt (synthetic): ${MV6_SYNTHETIC_PROMPT}`);
  console.log(`candidates: ${MV6_ESTIMATE_CANDIDATES.length}, one estimate call each, never repeated, no generation`);
  const results = await estimateCandidates(credential, (input, init) => fetch(input, init));
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
