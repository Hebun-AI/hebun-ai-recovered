/*
 * GS-2 — the review surface, rendered. The repository's UI harness is server rendering
 * (`renderToStaticMarkup`); it has no DOM, so a click cannot be dispatched here. What it CAN prove:
 *
 *   - the evidence panel renders open when deciding has started, and closed otherwise;
 *   - before deciding, the review control offers Accept / Request changes and no submit;
 *   - every grounding state the reviewer can meet is rendered as itself, with the manual-inspection
 *     line beside every verdict that is not `supported`.
 *
 * The click path (Accept / Request changes only set the intent; only "Record …" submits) is pinned
 * from source below. Evidence here is in-memory props: no database, tenant or Governance authority.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  EvidenceRecord,
  RevisionGenerationEvidence,
} from "../../src/components/operations-preparation/revision-generation-evidence";
import {
  GROUNDING_CHECK_MANUAL_INSPECTION,
  GROUNDING_CHECK_NOT_RUN,
  GROUNDING_CHECK_VERDICT,
  REVISION_EVIDENCE_NOTICE,
  type RevisionGenerationEvidence as Evidence,
} from "../../src/features/heby-answer/revision-generation-evidence";
import { assessRevisionSupport, type ClaimEvidence } from "../../src/features/knowledge-retrieval/claim-support";

globalThis.fetch = (() => {
  throw new Error("GS-2 render test must not reach the network");
}) as typeof fetch;

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const MANUAL = esc(GROUNDING_CHECK_MANUAL_INSPECTION);

const RECORD = "Most of the range is handmade.";
const supplied: ClaimEvidence = { provenance: "matched", items: [{ nodeId: "n1", text: RECORD }] };
const recorded = (copy: string, evidence: ClaimEvidence): Evidence => ({
  status: "recorded",
  revisionNo: 2,
  selection: { status: "matched", truncated: false, excludedCount: 0, degradedReason: null, unavailableReason: null },
  items: [],
  grounding: assessRevisionSupport(copy, evidence),
});
const html = (evidence: Evidence) => renderToStaticMarkup(createElement(EvidenceRecord, { evidence }));

/* insufficient — the dropped qualifier is named, and manual inspection is asked for. */
{
  const out = html(recorded("Handmade rugs.", supplied));
  assert.ok(out.includes('data-grounding-check="insufficient"'));
  assert.ok(out.includes(esc(GROUNDING_CHECK_VERDICT.insufficient)));
  assert.ok(out.includes("qualifier-dropped"), "the dropped qualification is named");
  assert.ok(out.includes(MANUAL), "manual inspection beside an insufficient verdict");
  assert.ok(!out.includes(esc(GROUNDING_CHECK_VERDICT.supported)));
}

/* unavailable check — said as unavailable, never as a pass, and manual inspection is asked for. */
{
  const out = html(recorded("Handmade rugs.", { provenance: "unavailable", items: [] }));
  assert.ok(out.includes('data-grounding-check="unavailable"'));
  assert.ok(out.includes(esc(GROUNDING_CHECK_VERDICT.unavailable)));
  assert.ok(out.includes(MANUAL), "manual inspection beside an unavailable verdict");
  assert.ok(!out.includes(esc(GROUNDING_CHECK_VERDICT.supported)));
}

/* unavailable evidence — the absence reason and "not run"; no verdict is invented. */
{
  const out = html({ status: "unavailable", reason: "provenance-unreadable" });
  assert.ok(out.includes("The generation record could not be read."));
  assert.ok(out.includes(esc(GROUNDING_CHECK_NOT_RUN)));
  assert.ok(!out.includes("data-grounding-check=\"insufficient\"") && !out.includes(esc(GROUNDING_CHECK_VERDICT.supported)));
}

/* supported — word for word; no manual-inspection line is added. */
{
  const out = html(recorded(RECORD, supplied));
  assert.ok(out.includes('data-grounding-check="supported"'));
  assert.ok(!out.includes(MANUAL));
}

/* The panel opens while deciding, and is closed otherwise. It renders no decision control. */
{
  const deciding = renderToStaticMarkup(
    createElement(RevisionGenerationEvidence, { artifactId: "a", revisionId: "r", openWhenDeciding: true }),
  );
  assert.ok(deciding.includes('aria-expanded="true"'));
  assert.ok(deciding.includes(esc(REVISION_EVIDENCE_NOTICE)));
  assert.ok(deciding.includes("Reading the generation record"));
  const idle = renderToStaticMarkup(createElement(RevisionGenerationEvidence, { artifactId: "a", revisionId: "r" }));
  assert.ok(idle.includes('aria-expanded="false"'));
  assert.ok(!idle.includes(esc(REVISION_EVIDENCE_NOTICE)));
  for (const out of [deciding, idle]) assert.ok(!/Record acceptance|Record changes requested|Accept for next/.test(out));
}

/* The click path, from source: the two intent buttons only set the intent; "Record …" is the only submit. */
{
  const review = read("src/components/operations-preparation/artifact-revision-review.tsx");
  assert.ok(review.includes('onClick={() => setIntent("accept")}'), "Accept only sets the intent");
  assert.ok(review.includes('onClick={() => setIntent("changes")}'), "Request changes only sets the intent");
  assert.equal((review.match(/submit\(/g) ?? []).length, 2, "submit is declared once and called once");
  assert.ok(review.includes("onClick={() => submit(intent)}"));
  assert.ok(review.includes("disabled={pending || tooShort}"), "the explicit submit still needs a reason");
  assert.ok(review.includes("openWhenDeciding={intent !== null}"));
}

console.log("PASS content-integrity-gs2 review-surface-render");
