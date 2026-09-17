/*
 * MEDIA-2B — the human generation door.
 *
 * MEDIA-1 proved the authority and MEDIA-2A proved the transport. What is new here is REACHABILITY:
 * for the first time a person can cause a paid provider call. So these assertions are about the
 * door itself — who may open it, how often, what it may not do, and what it must not leak.
 *
 * The transport's own failure vocabulary is NOT retested here; MEDIA-2A's 13 bite proofs own it.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  GENERIC_PRODUCTION_REACHABLE_KEYS,
  resolveGenericProductionReach,
} from "../../scripts/lib/provider-connectivity";
import { OPENAI_IMAGE_GENERATION_CONTROL_KEY } from "../../src/features/media-generation-live/openai-image-control";
import { resolveMediaGenerationTransport } from "../../src/features/media-assets/media-generation-transport.server";

const read = (f: string): string => readFileSync(f, "utf8");
const strip = (c: string): string =>
  c.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const ACTION = "src/app/(dashboard)/operations/actions.ts";
const SURFACE = "src/components/operations-preparation/generate-image-with-hebun.tsx";
const PAGE = "src/app/(dashboard)/operations/page.tsx";
const TRANSPORT_TIMEOUT_MS = 150_000;

/* A credential shape that is syntactically valid and belongs to nobody. */
const SYNTHETIC_KEY = "sk-".padEnd(48, "x");

async function main(): Promise<void> {
  /* ── 1. THE RESOLVER IS FAIL-CLOSED ON EVERY MISSING PRECONDITION ─────────── */
  {
    const on = async () => true;
    const off = async () => false;

    /* No configuration at all. */
    assert.deepEqual(await resolveMediaGenerationTransport({ env: {}, resolveDirectorEnabled: on }), {
      status: "unavailable",
      reason: "no-generation-provider",
    });

    /* Control ON and a credential, but the transport was never selected. */
    assert.deepEqual(
      await resolveMediaGenerationTransport({
        env: { HEBUN_OPENAI_IMAGE_API_KEY: SYNTHETIC_KEY },
        resolveDirectorEnabled: on,
      }),
      { status: "unavailable", reason: "no-generation-provider" },
      "a credential alone selects nothing",
    );

    /* Selected live and control ON, but no credential. */
    assert.deepEqual(
      await resolveMediaGenerationTransport({
        env: { HEBUN_MEDIA_GENERATION_TRANSPORT: "live" },
        resolveDirectorEnabled: on,
      }),
      { status: "unavailable", reason: "generation-misconfigured" },
      "live without a credential is misconfigured, never available",
    );

    /* Selected live WITH a credential, but the Director control is OFF. */
    assert.deepEqual(
      await resolveMediaGenerationTransport({
        env: { HEBUN_MEDIA_GENERATION_TRANSPORT: "live", HEBUN_OPENAI_IMAGE_API_KEY: SYNTHETIC_KEY },
        resolveDirectorEnabled: off,
      }),
      { status: "unavailable", reason: "generation-disabled" },
      "configuration plus credential is still not capability — the control decides",
    );

    /* A control read that THROWS must refuse, not pass. */
    assert.deepEqual(
      await resolveMediaGenerationTransport({
        env: { HEBUN_MEDIA_GENERATION_TRANSPORT: "live", HEBUN_OPENAI_IMAGE_API_KEY: SYNTHETIC_KEY },
        resolveDirectorEnabled: async () => {
          throw new Error("control unreadable");
        },
      }),
      { status: "unavailable", reason: "generation-disabled" },
      "an unreadable control is OFF, never ON",
    );

    /* All three true → and only then. */
    const available = await resolveMediaGenerationTransport({
      env: { HEBUN_MEDIA_GENERATION_TRANSPORT: "live", HEBUN_OPENAI_IMAGE_API_KEY: SYNTHETIC_KEY },
      resolveDirectorEnabled: on,
    });
    assert.equal(available.status, "available");
    assert.equal(available.status === "available" && available.transport.transport, "live");
    assert.equal(available.status === "available" && available.transport.provider, "openai");
    assert.deepEqual(
      available.status === "available" ? [...available.transport.allowedDownloadHosts] : null,
      [],
      "no download host is allowed, so provider bytes can only arrive inline",
    );

    /* The control asked about is the image one, not some other provider's. */
    let asked: string | null = null;
    await resolveMediaGenerationTransport({
      env: { HEBUN_MEDIA_GENERATION_TRANSPORT: "live", HEBUN_OPENAI_IMAGE_API_KEY: SYNTHETIC_KEY },
      resolveDirectorEnabled: async (key) => {
        asked = key;
        return true;
      },
    });
    assert.equal(asked, OPENAI_IMAGE_GENERATION_CONTROL_KEY);
  }

  /* ── 2. THE PRODUCTION DECISION IS ENUMERATED, AND STILL NOT AN ARMING ────── */
  {
    assert.ok(GENERIC_PRODUCTION_REACHABLE_KEYS.includes(OPENAI_IMAGE_GENERATION_CONTROL_KEY));
    assert.equal(resolveGenericProductionReach(OPENAI_IMAGE_GENERATION_CONTROL_KEY).status, "reachable");
    /* Reachable means a ceremony MAY decide. It does not create a row, and absence still reads OFF. */
    assert.deepEqual(resolveGenericProductionReach("openai-image-generation-v2"), {
      status: "refused",
      dedicatedCommand: null,
    });
  }

  /* ── 3. THE DOOR TAKES THE TENANT FROM THE SESSION, NEVER FROM THE CALLER ── */
  {
    const action = strip(read(ACTION));
    assert.match(action, /const tenant = await resolveTenantContext\(\);\s*\n\s*const result = await requestMediaGeneration\(tenant, input\);/);
    /* The input type is the authority's own, so the door cannot widen it. */
    assert.match(action, /input: RequestMediaGenerationInput/);
    assert.ok(
      !/tenantId|userId|actorId|actorType/.test(action),
      "no action in this file names a tenant, a user or an actor as input",
    );
  }

  /* ── 4. ONE HUMAN CLICK IS ONE PAID CALL, AND A RESUBMIT IS NONE ──────────── */
  {
    const surface = strip(read(SURFACE));
    assert.equal(
      (surface.match(/requestMediaGenerationAction\(/g) ?? []).length,
      1,
      "one call site",
    );
    assert.match(surface, /useMemo\(\(\) => crypto\.randomUUID\(\), \[\]\)/, "one key per mounted form");
    assert.ok(!/setTimeout|setInterval|useEffect/.test(surface), "nothing dispatches without a click");
    assert.ok(!/retry|Retry/.test(surface), "there is no retry control");
    assert.ok(!/for\s*\(|\.map\(async|Promise\.all/.test(surface), "no batch, no fan-out");
    assert.match(surface, /disabled=\{!ready \|\| pending\}/, "a pending call cannot be submitted again");
  }

  /* ── 5. THE ROUTE OUTLASTS THE TRANSPORT, SO A TIMEOUT IS RECORDED ────────── */
  {
    const page = read(PAGE);
    const declared = /export const maxDuration = (\d+);/.exec(page)?.[1];
    assert.ok(declared, "the route states its own duration rather than inheriting a platform default");
    const seconds = Number(declared);
    assert.ok(
      seconds * 1000 > TRANSPORT_TIMEOUT_MS,
      "the function must outlive the transport, or a timed-out call is killed before it can be recorded",
    );
    assert.ok(seconds <= 300, "and stay within the lower of the two platform ceilings");
  }

  /* ── 6. NOTHING ON THE DOOR CAN LEAK A SECRET ─────────────────────────────── */
  {
    for (const f of [ACTION, SURFACE, PAGE]) {
      const c = strip(read(f));
      assert.ok(!/process\.env/.test(c), `${f}: reads no environment`);
      assert.ok(!/HEBUN_OPENAI|API_KEY|apiKey|Bearer|authorization/i.test(c), `${f}: names no credential`);
      assert.ok(!/console\./.test(c), `${f}: logs nothing`);
    }
    /* The result the surface renders carries byte facts and ids — never provider material. */
    const surface = strip(read(SURFACE));
    assert.ok(!/providerJobId|x-request-id/.test(surface), "no provider request identity is shown to the user");
  }

  console.log("media2b-human-door/door-and-firewall: all assertions passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
