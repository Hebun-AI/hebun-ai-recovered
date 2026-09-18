/*
 * MEDIA-3 — seeing an admitted asset, and deciding about it.
 *
 * What is new here is VISIBILITY and DERIVED STATE, so these assertions are about the four things
 * that could quietly go wrong: listing could grant access, approval could be copied onto the asset,
 * absence of a decision could be rendered as approval, and a decision could acquire an effect.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MEDIA_ASSET_REVIEW_ACCEPT_NON_EFFECTS,
  MEDIA_ASSET_REVIEW_DOMAIN,
  MEDIA_ASSET_REVIEW_SUBJECT_TYPE,
} from "../../src/features/media-asset-review/contracts";
import { listRevisionMediaAssets } from "../../src/features/media-assets/read-media-assets.server";
import { readMediaAssetReviewStates } from "../../src/features/media-asset-review/review-media-asset.server";
import { MEDIA_READ_ACCESS_TTL_SECONDS } from "../../src/features/media-assets/media-object-store";
import { VPS_READ_MAX_TTL_SECONDS } from "../../src/features/media-assets/vps-media-object-store.server";

const read = (f: string): string => readFileSync(f, "utf8");
const strip = (c: string): string =>
  c.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const READER = "src/features/media-assets/read-media-assets.server.ts";
const REVIEW = "src/features/media-asset-review/review-media-asset.server.ts";
const ACTIONS = "src/app/(dashboard)/operations/actions.ts";
const SURFACE = "src/components/operations-preparation/revision-media-assets.tsx";
const SCHEMA = "src/db/schema/media-asset.ts";

const TENANT = { tenantId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" } as never;

async function main(): Promise<void> {
  /* ── 1. LISTING IS A DATABASE READ. It grants nothing. ──────────────────── */
  {
    const listing = strip(read(READER));
    const fn = listing.slice(listing.indexOf("export async function listRevisionMediaAssets"));
    assert.ok(!/resolveMediaObjectStore|createReadAccess|\.verify\(/.test(fn), "listing resolves no store and mints no grant");
    assert.ok(!/storageKey/.test(fn), "listing does not even project the storage key");

    /* No database → unavailable, never an empty list. An empty list must mean "none exist". */
    const unavailable = await listRevisionMediaAssets(TENANT, { artifactId: "33333333-3333-4333-8333-333333333333", revisionNo: 1 }, { getDb: () => null });
    assert.deepEqual(unavailable, { status: "unavailable", reason: "persistence-unavailable" });

    /* No tenant refuses before anything is read. */
    assert.deepEqual(
      await listRevisionMediaAssets(null, { artifactId: "33333333-3333-4333-8333-333333333333", revisionNo: 1 }, { getDb: () => null }),
      { status: "unavailable", reason: "persistence-unavailable" },
    );
  }

  /* ── 2. ABSENCE OF A DECISION IS NOT AN APPROVAL ────────────────────────── */
  {
    /* Unreadable ledger → every asset reads `unavailable`, never "unreviewed" and never approved. */
    const states = await readMediaAssetReviewStates(TENANT, ["44444444-4444-4444-8444-444444444444"], { getDb: () => null });
    assert.equal(states.size, 1);
    assert.deepEqual(states.get("44444444-4444-4444-8444-444444444444"), { status: "unavailable" });

    /* The surface turns each ledger answer into a word, and `null` is never "Approved". */
    const surface = strip(read(SURFACE));
    assert.match(surface, /decision === "accepted"[\s\S]{0,80}Approved/, "only an accepted decision reads Approved");
    assert.match(surface, /decision === "declined"[\s\S]{0,80}Declined/, "only a declined decision reads Declined");
    assert.match(surface, /Awaiting review/, "no decision reads Awaiting review");
    assert.match(surface, /Review state unavailable/, "an unreadable ledger says so");
  }

  /* ── 3. APPROVAL IS NEVER COPIED ONTO THE ASSET, AND NEVER CHANGES IT ──── */
  {
    const schema = strip(read(SCHEMA));
    for (const word of ["approved", "approval", "reviewed", "review_state", "governance"]) {
      assert.ok(!new RegExp(word, "i").test(schema), `media-asset schema holds no ${word} column`);
    }
    /* The released promise, still made in the released words. */
    assert.ok(
      MEDIA_ASSET_REVIEW_ACCEPT_NON_EFFECTS.includes("does not change the asset, its bytes, or its lifecycle"),
      "accepting still changes no asset, byte or lifecycle",
    );
    const review = strip(read(REVIEW));
    assert.ok(!/\.(update|insert|delete)\(\s*mediaAssets\s*\)/.test(review), "the review authority writes no media_assets row");
    assert.equal(MEDIA_ASSET_REVIEW_SUBJECT_TYPE, "media_asset");
    assert.equal(MEDIA_ASSET_REVIEW_DOMAIN, "media-asset-review");
  }

  /* ── 4. THE UI DECIDES THROUGH THE RELEASED WRITERS, AND ONLY THOSE ─────── */
  {
    const actions = strip(read(ACTIONS));
    assert.match(actions, /await acceptMediaAsset\(tenant, payload\)/);
    assert.match(actions, /await declineMediaAsset\(tenant, payload\)/);
    /* Bound to the digest the reviewer was shown: a stale card cannot record a decision. */
    assert.match(actions, /byteDigest: input\.byteDigest/);
    const surface = strip(read(SURFACE));
    assert.match(surface, /byteDigest: asset\.byteDigest/, "the decision carries the digest this card rendered");
    assert.ok(!/decisionRecords|governanceSessions|writeGovernanceDecision/.test(surface), "the surface writes no Governance record");
    assert.ok(!/recordActionRequest|action-authorization|action-execution/.test(surface), "approval grants no act authority");
    assert.ok(!/retireMediaAsset/.test(surface), "the surface cannot retire an asset");
  }

  /* ── 5. PREVIEW IS LAZY, VERIFIED, AND SHORT-LIVED ──────────────────────── */
  {
    const surface = strip(read(SURFACE));
    /* One call site, and it is reached from a click — never from render or a timer. */
    assert.equal((surface.match(/readMediaAssetAction\(/g) ?? []).length, 1, "one preview call site");
    assert.ok(!/useEffect|setInterval|setTimeout/.test(surface), "no preview is fetched without a human opening it");
    assert.match(surface, /onClick=\{openPreview\}/, "preview is a click");

    /* The action re-uses the released verified read; it does not re-implement or widen it. */
    const actions = strip(read(ACTIONS));
    assert.match(actions, /return readMediaAsset\(tenant, input\.assetId\)/, "preview is the released verified read");
    assert.ok(!/ttlSeconds/.test(actions), "no action sets its own TTL");

    /* The released TTLs are unchanged: a grant lives a minute, and the store caps it at five. */
    assert.equal(MEDIA_READ_ACCESS_TTL_SECONDS, 60);
    assert.equal(VPS_READ_MAX_TTL_SECONDS, 300);

    /* No permanent or public URL anywhere on the surface. */
    assert.ok(!/https?:\/\//.test(surface), "the surface hardcodes no URL");
    assert.match(surface, /expires shortly/i, "the reader is told the link is temporary");
  }

  /* ── 6. AN INTEGRITY FAILURE IS A CUSTODY PROBLEM, NOT A MISSING IMAGE ─── */
  {
    const surface = read(SURFACE);
    const mismatch = /"integrity-mismatch":\s*"([^"]+)"/.exec(surface)?.[1] ?? "";
    const absent = /"object-absent":\s*"([^"]+)"/.exec(surface)?.[1] ?? "";
    assert.ok(mismatch.length > 0 && absent.length > 0, "both custody failures have their own sentence");
    for (const [label, text] of [["integrity-mismatch", mismatch], ["object-absent", absent]] as const) {
      assert.ok(!/no image|not found|doesn't exist|does not exist/i.test(text), `${label} is not worded as a missing image`);
      assert.ok(/storage|custody/i.test(text), `${label} names it as a storage or custody problem`);
    }
  }

  console.log("media3-asset-review/review-and-firewall: all assertions passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
