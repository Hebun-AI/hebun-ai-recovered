/*
 * INSTAGRAM-APPROVAL-PREVIEW-1 — what the preview SAYS, rendered server-side from fixed views.
 *
 *   verified caption shown verbatim · digest mismatch shows NO caption and NO image · superseded
 *   revision is said · readiness BLOCKED stays beside the request · acknowledgement only when the
 *   payload carries one · an unread preview is "unknown, not empty" · no image URL before a click.
 */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InstagramApprovalPreview } from "../../src/components/decision-workspace/instagram-approval-preview";
import type { InstagramApprovalPreview as PreviewView } from "../../src/features/instagram-publishing/approval-preview.server";

const base: PreviewView = {
  requestId: "11111111-1111-4111-8111-111111111111",
  requestStatus: "pending",
  governed: {
    draftRef: "work-artifact/22222222-2222-4222-8222-222222222222@3",
    revisionNo: 3,
    originalAssetId: "33333333-3333-4333-8333-333333333333",
    publishAssetId: "44444444-4444-4444-8444-444444444444",
    externalAccountId: "28295264780115792",
  },
  caption: { status: "verified", text: "Black Rose Kilim — the governed caption", revisionStanding: "current" },
  image: { status: "bound", mimeType: "image/jpeg", width: 2000, height: 2601, lifecycle: "admitted", origin: "supplied" },
  derivative: { status: "lineage-verified" },
  account: { status: "bound-connection", label: "turkishrughouse" },
  readiness: { status: "ready" },
  acknowledgement: { status: "none-in-payload" },
};
const html = (p: PreviewView | undefined, status: "read" | "payload-unreadable" | "unavailable" = "read") =>
  renderToStaticMarkup(
    createElement(InstagramApprovalPreview, {
      requestId: base.requestId,
      preview: p === undefined ? undefined : status === "read" ? { status: "read", preview: p } : { status },
    }),
  );

const ok = html(base);
assert.ok(ok.includes("Black Rose Kilim — the governed caption"), "verified caption verbatim");
assert.ok(ok.includes("turkishrughouse (28295264780115792)"), "account label with the bound id");
assert.ok(ok.includes("READY"), "readiness shown");
assert.ok(ok.includes("Show the bound image") && !/<img/.test(ok), "no image and no URL before a click");
assert.ok(!ok.includes("Republish acknowledgement"), "no fake republish warning");

const mismatch = html({ ...base, caption: { status: "digest-mismatch" }, image: { status: "digest-mismatch" } });
assert.ok(!mismatch.includes("the governed caption"), "no caption text on mismatch");
assert.ok(/Integrity mismatch/.test(mismatch), "the mismatch is said");
assert.ok(!mismatch.includes("Show the bound image"), "no way to open an image that is not the governed one");

const superseded = html({ ...base, caption: { ...base.caption, revisionStanding: "superseded" } as PreviewView["caption"] });
assert.ok(/newer revision of this draft exists/.test(superseded), "supersession is said beside the governed text");

const blocked = html({ ...base, readiness: { status: "not-ready", failure: "image-not-selected", blockers: [] } });
assert.ok(/BLOCKED — image-not-selected/.test(blocked) && blocked.includes("the governed caption"), "readiness BLOCKED beside, not instead of, the request");

const acked = html({ ...base, acknowledgement: { status: "recorded", attemptId: "55555555-5555-4555-8555-555555555555", attemptStatus: "accepted", providerResultId: "18091512017663172" } });
assert.ok(/acknowledges prior attempt 55555555-5555-4555-8555-555555555555/.test(acked) && acked.includes("18091512017663172"), "acknowledgement with its ledger record");
assert.ok(/not a live read of what Instagram shows now/.test(acked), "and the non-claim");

const unknownAck = html({ ...base, acknowledgement: { status: "unknown", attemptId: "55555555-5555-4555-8555-555555555555" } });
assert.ok(/could not be read for it/.test(unknownAck), "an unreadable ledger is unknown, not none");

assert.ok(/unknown, not empty/.test(html(undefined)), "no preview answered → unknown");
assert.ok(/unknown, not empty/.test(html(base, "unavailable")), "unavailable → unknown");
assert.ok(/does not parse as an Instagram publication/.test(html(base, "payload-unreadable")), "unreadable payload is said");

const readinessUnknown = html({ ...base, readiness: { status: "unavailable" } });
assert.ok(/Unknown — the Content Package could not be read now/.test(readinessUnknown), "readiness unknown is not READY");

console.log("PASS instagram-approval-preview-1 preview render");
