/*
 * MEDIA-4A — the images of a draft's EARLIER revisions stay reachable.
 *
 * What is new here is REACH, not truth. So these assertions are about the four things that could
 * quietly go wrong when a surface starts showing older material: the wider read could grant access
 * it was never meant to grant, "current" could start being inferred from media rows, an older asset
 * could be presented as belonging to the current revision, and a historical listing could acquire
 * a second asset-review implementation of its own.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { listArtifactMediaAssets } from "../../src/features/media-assets/read-media-assets.server";

const read = (f: string): string => readFileSync(f, "utf8");
const strip = (c: string): string =>
  c.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const READER = "src/features/media-assets/read-media-assets.server.ts";
const ACTIONS = "src/app/(dashboard)/operations/actions.ts";
const COMPOSER = "src/components/operations-preparation/operations-preparation.tsx";
const CARD = "src/components/operations-preparation/revision-media-assets.tsx";
const SCHEMA = "src/db/schema/media-asset.ts";
const REVISION_SCHEMA = "src/db/schema/work-artifact.ts";

const TENANT = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
} as never;
const ARTIFACT = "33333333-3333-4333-8333-333333333333";

async function main(): Promise<void> {
  /* ── 1. THE WIDER READ IS STILL ONLY A READ, AND IT GRANTS NOTHING ──────── */
  {
    const reader = strip(read(READER));
    const fn = reader.slice(reader.indexOf("export async function listArtifactMediaAssets"));
    assert.ok(fn.length > 0, "the MEDIA-4A reader is present to examine");
    assert.ok(
      !/resolveMediaObjectStore|createReadAccess|\.verify\(/.test(fn),
      "the artifact-wide listing resolves no store and mints no grant",
    );
    assert.ok(!/storageKey/.test(fn), "the artifact-wide listing does not even project the storage key");
    assert.ok(!/\.(insert|update|delete)\(/.test(fn), "the artifact-wide listing writes nothing");

    /* No database → unavailable, never an empty list. An empty list must mean "none exist". */
    assert.deepEqual(
      await listArtifactMediaAssets(TENANT, { artifactIds: [ARTIFACT] }, { getDb: () => null }),
      { status: "unavailable", reason: "persistence-unavailable" },
    );
    /* No tenant refuses before anything is read. */
    assert.deepEqual(
      await listArtifactMediaAssets(null, { artifactIds: [ARTIFACT] }, { getDb: () => null }),
      { status: "unavailable", reason: "persistence-unavailable" },
    );
    /*
     * Nothing asked for is an empty read, and it must not reach the database at all — a `getDb`
     * that throws proves the short-circuit is real rather than incidental.
     */
    assert.deepEqual(
      await listArtifactMediaAssets(TENANT, { artifactIds: [] }, {
        getDb: () => {
          throw new Error("the database must not be reached for an empty request");
        },
      }),
      { status: "read", assets: [] },
    );
    /* A non-uuid is not a lookup. It is filtered before any statement is built. */
    assert.deepEqual(
      await listArtifactMediaAssets(TENANT, { artifactIds: ["not-a-uuid"] }, {
        getDb: () => {
          throw new Error("the database must not be reached for an unusable id");
        },
      }),
      { status: "read", assets: [] },
    );
  }

  /* ── 2. TENANT SCOPE IS PREDICATED ON BOTH TABLES, AS MEDIA-3 ALREADY WAS ─ */
  {
    const reader = strip(read(READER));
    const fn = reader.slice(reader.indexOf("export async function listArtifactMediaAssets"));
    assert.equal(
      (fn.match(/eq\((mediaAssets|mediaGenerationInvocations)\.tenantId, tenant\.tenantId\)/g) ?? []).length,
      2,
      "both the asset and its invocation are predicated on the session tenant",
    );
    /* The tenant is never an input. It comes from the trusted context the action resolved. */
    assert.ok(!/tenantId\s*:/.test(fn.slice(0, fn.indexOf("const db"))), "no caller-supplied tenant id");
    const actions = strip(read(ACTIONS));
    assert.match(
      actions,
      /listArtifactMediaAssets\(tenant, input\)/,
      "the action passes the session tenant, never a client one",
    );
  }

  /* ── 3. "CURRENT" IS THE WORK ARTIFACT AUTHORITY'S WORD, NEVER THE MEDIA ROWS' ── */
  {
    const reader = strip(read(READER));
    const fn = reader.slice(reader.indexOf("export async function listArtifactMediaAssets"));
    assert.ok(
      !/currentRevision|current_revision|workArtifacts/.test(fn),
      "the media reader neither reads nor guesses which revision is current",
    );

    const composer = strip(read(COMPOSER));
    /*
     * The split compares the artifact's own currentRevision against each asset's sourceRevisionNo.
     * A max/sort over media rows would be the bug this pins: a draft at revision 3 whose newest
     * image came from revision 2 must not report revision 2 as current.
     */
    assert.match(
      composer,
      /a\.sourceRevisionNo === draft\.currentRevision/,
      "current-ness is decided by the artifact's currentRevision, not by the media rows",
    );
    assert.ok(
      !/Math\.max|\.sort\(/.test(composer),
      "no revision ordering is computed from the media rows in the composer",
    );
    assert.match(
      composer,
      /currentRevision: a\.currentRevision/,
      "currentRevision is carried from the released work-artifact listing",
    );
  }

  /* ── 4. AN OLDER ASSET IS NEVER PRESENTED AS THIS REVISION'S ────────────── */
  {
    const composer = read(COMPOSER);
    assert.match(composer, /Revision \{draft\.currentRevision\} — current/, "the current revision is named");
    assert.match(composer, /Previous revisions/, "historical groups are labelled as previous");
    assert.match(composer, /Revision \{revisionNo\}/, "every historical group names its exact revision");
    /* And each card independently states its own source revision, so the fact survives out of context. */
    assert.match(read(CARD), /Revision \{asset\.sourceRevisionNo\} of this draft/);

    /*
     * HISTORICAL MEANS ONE THING. The surface must not translate "not the current revision" into
     * retired, obsolete, superseded, inherited, selected or attached — none of which is a fact the
     * repository holds about an asset.
     */
    const stripped = strip(composer);
    for (const forbidden of ["obsolete", "superseded", "inherited", "selected", "attached", "deprecated"]) {
      assert.ok(
        !new RegExp(forbidden, "i").test(stripped),
        `the surface never calls a historical asset "${forbidden}"`,
      );
    }
    /* Explicitly: nothing is carried forward, and the copy says so. */
    assert.match(composer, /none of them is carried forward/i, "no inheritance is claimed");
  }

  /* ── 5. NO SECOND REVIEW IMPLEMENTATION, AND NO NEW WRITER ──────────────── */
  {
    const composer = strip(read(COMPOSER));
    /* The released MEDIA-3 card renders every asset in every group — current and historical alike. */
    assert.match(composer, /<RevisionMediaAssets/, "the released asset card is reused");
    assert.ok(
      !/reviewMediaAssetAction|acceptMediaAsset|declineMediaAsset|readMediaAssetAction/.test(composer),
      "the composer implements no review and no preview of its own",
    );
    assert.ok(
      !/decisionRecords|governanceSessions|writeGovernanceDecision/.test(composer),
      "the composer writes no Governance record",
    );
    assert.ok(
      !/\.(insert|update|delete)\(/.test(composer),
      "the composer writes nothing at all",
    );
    /*
     * Review authority is NOT restricted by age. If Governance may decide about an asset, it may
     * decide about an older revision's asset too — the card is the same card, and no UI-invented
     * restriction is layered on top of the released authority.
     */
    assert.ok(
      !/readOnly|disabled=\{historical|isHistorical/.test(composer),
      "no UI-invented restriction is placed on reviewing a historical asset",
    );
  }

  /* ── 6. NO NEW TRUTH: NO SELECTION, NO ATTACHMENT, NO SCHEMA ───────────── */
  {
    for (const file of [SCHEMA, REVISION_SCHEMA]) {
      const schema = strip(read(file));
      for (const word of ["selected", "attachment", "attached_", "chosen", "inherit"]) {
        assert.ok(!new RegExp(word, "i").test(schema), `${file} holds no ${word} column`);
      }
    }
    /* MEDIA-3's guarantee is unchanged: approval is still nowhere on the asset. */
    const schema = strip(read(SCHEMA));
    for (const word of ["approved", "approval", "review_state"]) {
      assert.ok(!new RegExp(word, "i").test(schema), `media-asset schema still holds no ${word} column`);
    }
    /* The reader adds no lifecycle filter: a retired asset stays visible and says so, as released. */
    const reader = strip(read(READER));
    const fn = reader.slice(reader.indexOf("export async function listArtifactMediaAssets"));
    assert.ok(
      !/assetLifecycleStatus,\s*"admitted"|eq\(mediaAssets\.assetLifecycleStatus/.test(fn),
      "the listing hides no retired asset — retirement is shown, never filtered away",
    );
  }

  console.log("media4a-revision-history/history-and-firewall: all assertions passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
