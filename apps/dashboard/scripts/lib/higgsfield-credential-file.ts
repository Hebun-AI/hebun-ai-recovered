/*
 * scripts/lib/higgsfield-credential-file.ts — read the ONE Higgsfield API key from a named file, for
 * MV-6 acceptance tooling only (estimate and generation stages share it, so they refuse identically).
 *
 * The key comes from MV6_HIGGSFIELD_ENV_FILE (default ./.env.higgsfield.local, gitignored), never from
 * the ambient environment. Nothing is printed: every refusal says "values not shown".
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { loadQuietEnv } from "./quiet-env";
import { isHiggsfieldCredentialShaped } from "../../src/features/media-generation-live/higgsfield-video-transport.server";

const NAME = "HEBUN_HIGGSFIELD_API_KEY";
/* The retired pair. Cleared from the process and never read, so it cannot stand in for the key. */
const RETIRED = ["HEBUN_HIGGSFIELD_API_KEY_ID", "HEBUN_HIGGSFIELD_API_KEY_SECRET"] as const;

/*
 * A bare uuid is the console's key RECORD id ("Copy ID" in the API-keys list), not the API key: MV-6
 * measured a uuid-only credential answering 401. Refused here, before any call. Acceptance-harness
 * rule only — the product's shape check does not assume a real key can never be a uuid.
 */
const RECORD_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function loadHiggsfieldCredentialOrRefuse(): { apiKey: string } {
  const file = process.env.MV6_HIGGSFIELD_ENV_FILE ?? path.resolve(process.cwd(), ".env.higgsfield.local");
  if (!existsSync(file)) throw new Error("REFUSED: MV6_HIGGSFIELD_ENV_FILE (or ./.env.higgsfield.local) does not exist");
  for (const name of [NAME, ...RETIRED]) delete process.env[name];
  loadQuietEnv([file], [NAME]);
  const credential = { apiKey: process.env[NAME] ?? "" };
  delete process.env[NAME];
  if (!isHiggsfieldCredentialShaped(credential)) {
    throw new Error("REFUSED: the credential file does not hold a credential-shaped HEBUN_HIGGSFIELD_API_KEY (values not shown)");
  }
  if (RECORD_ID_RE.test(credential.apiKey)) {
    throw new Error(
      "REFUSED: HEBUN_HIGGSFIELD_API_KEY is only a uuid — that is the key's record id (Copy ID), not the API key. " +
        "Use \"Copy API key\" from the key-creation screen (values not shown)",
    );
  }
  return credential;
}

