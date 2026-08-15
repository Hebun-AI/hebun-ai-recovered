/*
 * Director truth surface — mock data must never render as measured organizational truth.
 *
 * ── WHAT THIS DEFENDS ───────────────────────────────────────────────────────
 *
 * Every projection behind /director declares `source.kind: "Mock Adapter"`, and one of them carries
 * an explicit `disclosure: { simulated: true, authoritative: false }`. The data layer has always
 * been honest. The defect was that the PRESENTATION layer discarded that and rendered a fixed
 * literal as "94% confidence" beside a recommendation, next to today's real date.
 *
 * The rule being defended is not "never say confidence". It is:
 *
 *     A PRESENTATION LAYER MUST NEVER UPGRADE THE AUTHORITY OF ITS INPUT.
 *
 * ── WHY THESE ASSERTIONS AND NOT A SUBSTRING BAN ────────────────────────────
 *
 * Banning the word "confidence" repo-wide would be brittle and would fire on honest prose. These
 * assertions instead render the real components with the real projections and check what a reader
 * would actually see: no measured-looking figure survives, and the mock origin is stated.
 *
 * Rendering is `renderToStaticMarkup` — the strongest deterministic UI proof this repository has.
 * There is NO browser or e2e harness here, so nothing beyond this markup is proven.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HebyAssistantPanel } from "../../src/components/director-workspace/heby-assistant-panel";
import { HebyRecommendationsPanel } from "../../src/components/director-workspace/operational-panels";
import { ProjectionSourceNotice } from "../../src/components/director-workspace/projection-source-notice";
import { directorWorkspaceProjection } from "../../src/features/director-workspace/mock";
import {
  enterpriseIntelligenceProjection,
  hebyEnterpriseContext,
} from "../../src/features/enterprise-intelligence/mock";

const DIRECTOR_COMPONENTS = "src/components/director-workspace";
const PAGE = "src/app/(dashboard)/director/page.tsx";

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

/** Strip HTML tags so assertions read what a PERSON sees, not what the markup contains. */
function visibleText(markup: string): string {
  return markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function run(): void {
  /* ── 1. THE PROJECTIONS STILL DECLARE THEIR OWN MOCK ORIGIN ────────────── */
  {
    for (const projection of [
      directorWorkspaceProjection,
      enterpriseIntelligenceProjection,
      hebyEnterpriseContext,
    ]) {
      assert.equal(
        projection.source.kind,
        "Mock Adapter",
        "the notice is DERIVED from this field — if a projection stops declaring it, the notice must stop too",
      );
    }
    /*
     * This one goes further and always has. The presentation ignored it; that was the whole defect.
     */
    assert.deepEqual(hebyEnterpriseContext.disclosure, {
      simulated: true,
      authoritative: false,
      executionAllowed: false,
      authority: "Director",
    });
  }

  /* ── 2. THE FABRICATED CONFIDENCE FIGURES NO LONGER REACH A READER ─────── */
  {
    const advisor = visibleText(
      renderToStaticMarkup(
        createElement(HebyAssistantPanel, {
          awareness: directorWorkspaceProjection.advisorAwareness,
          context: hebyEnterpriseContext,
        }),
      ),
    );
    const recommendations = visibleText(
      renderToStaticMarkup(
        createElement(HebyRecommendationsPanel, { items: directorWorkspaceProjection.recommendations }),
      ),
    );

    /*
     * The literals are still in the mock data — this phase did not rewrite the fixtures. What must
     * be true is that no reader is shown them as a measurement.
     */
    assert.equal(hebyEnterpriseContext.confidence, 94, "the fixture is unchanged...");
    assert.ok(
      directorWorkspaceProjection.recommendations.some((item) => item.confidence === 94),
      "...and so are these",
    );

    /*
     * The assertion is deliberately about a MEASUREMENT, not about a word. "Restores launch
     * confidence" is honest English prose in the mock copy and must stay legal; what must not exist
     * is a NUMBER presented as a confidence. Banning the word outright would be the brittle test
     * this repository has been bitten by before — a guard that catches the thing it protects.
     */
    for (const [surface, text] of [["advisor", advisor], ["recommendations", recommendations]] as const) {
      assert.ok(!/\b\d{1,3}\s*%/.test(text), `${surface}: no percentage may be presented at all`);
      assert.ok(
        !/confidence\s*[:\s]*\d/i.test(text) && !/\d\s*%?\s*confidence/i.test(text),
        `${surface}: no figure may be labelled as a confidence`,
      );
      for (const literal of ["94", "87", "82"]) {
        assert.ok(
          !new RegExp(`\\b${literal}\\b`).test(text),
          `${surface}: the mock literal ${literal} must not surface as a number`,
        );
      }
    }
    /* Prose keeps its ordinary English. That is the point of testing the claim, not the token. */
    assert.ok(
      /confidence/i.test(recommendations),
      "the word still appears in honest prose — this test bans measurements, not vocabulary",
    );

    /* The USEFUL content survives — this was a removal of false precision, not of substance. */
    assert.ok(advisor.includes(hebyEnterpriseContext.recommendation), "the recommendation text stays");
    assert.ok(advisor.includes("Simulated intelligence"), "and the existing authority disclaimer stays");
    assert.ok(
      recommendations.includes(directorWorkspaceProjection.recommendations[0]!.recommendation),
      "the recommendations themselves stay",
    );
    assert.ok(recommendations.includes("Critical"), "priority is a declared ordering and stays");
  }

  /* ── 3. THE MOCK ORIGIN IS STATED, AND ONLY WHEN IT IS TRUE ────────────── */
  {
    const shown = visibleText(
      renderToStaticMarkup(
        createElement(ProjectionSourceNotice, {
          sources: [directorWorkspaceProjection.source, hebyEnterpriseContext.source],
        }),
      ),
    );
    assert.ok(shown.includes("Demonstration data"), "the reader is told plainly");
    assert.ok(
      shown.includes("does not describe your organization"),
      "and told what that means for them, not just that a flag is set",
    );
    assert.ok(shown.includes("Director Workspace"), "naming which adapter, from the projection itself");

    /*
     * DERIVED, NOT HARD-CODED. The day these projections are backed by a real runtime the notice
     * has to disappear on its own — a demo marker that must be remembered is a demo marker that
     * gets left behind on live data.
     */
    const live = renderToStaticMarkup(
      createElement(ProjectionSourceNotice, {
        sources: [{ kind: "Runtime", name: "Director Workspace" }],
      }),
    );
    assert.equal(live, "", "a non-mock source renders nothing at all");

    const mixed = visibleText(
      renderToStaticMarkup(
        createElement(ProjectionSourceNotice, {
          sources: [{ kind: "Runtime", name: "Live" }, { kind: "Mock Adapter", name: "Still Fake" }],
        }),
      ),
    );
    assert.ok(mixed.includes("Still Fake"), "one mock source among real ones still warns");
    assert.ok(!mixed.includes("Live"), "and does not accuse the real one of being mock");
  }

  /* ── 4. THE PAGE ACTUALLY MOUNTS IT, ABOVE THE FIGURES IT QUALIFIES ────── */
  {
    const page = read(PAGE);
    assert.ok(page.includes("ProjectionSourceNotice"), "the notice is mounted on /director");
    const noticeAt = page.indexOf("<ProjectionSourceNotice");
    for (const later of ["<EnterpriseIntelligenceOverview", "<ExecutiveStatus", "<HebyRecommendationsPanel"]) {
      assert.ok(
        noticeAt > 0 && noticeAt < page.indexOf(later),
        `the notice must precede ${later} — a disclaimer below the figures it qualifies is not a disclaimer`,
      );
    }
    assert.ok(
      /sources=\{\[[\s\S]*workspace\.source[\s\S]*intelligence\.source[\s\S]*hebyContext\.source[\s\S]*\]\}/.test(page),
      "and it is fed from the projections, never from a literal",
    );
  }

  /* ── 5. NO CONFIDENCE OR TRUST SYSTEM WAS INVENTED ─────────────────────── */
  {
    const notice = read(join(DIRECTOR_COMPONENTS, "projection-source-notice.tsx"));
    const panel = read(join(DIRECTOR_COMPONENTS, "heby-assistant-panel.tsx"));

    for (const banned of [
      "computeConfidence", "confidenceScore", "trustScore", "truthScore", "qualityScore",
      "certainty", "reliability", "probability", "Math.random", "estimate(",
    ]) {
      for (const [name, source] of [["notice", notice], ["panel", panel]] as const) {
        assert.ok(!source.includes(banned), `${name} must not introduce "${banned}"`);
      }
    }

    /* No score was borrowed from retrieval to fill the hole either. */
    for (const borrowed of ["knowledge-retrieval", "RetrievalEvidence", "ts_rank", "lexical", "combined"]) {
      assert.ok(!notice.includes(borrowed) && !panel.includes(borrowed),
        `a retrieval relevance score must never become a Director confidence ("${borrowed}")`);
    }

    /* And the view's own vocabulary no longer contains the field, so it cannot come back by habit. */
    assert.ok(
      !/confidence:\s*number/.test(panel),
      "the advisor message shape must not re-declare confidence",
    );
  }

  /* ── 6. THE REPAIR DID NOT REACH INTO KR3/KR4 ──────────────────────────── */
  {
    const notice = read(join(DIRECTOR_COMPONENTS, "projection-source-notice.tsx"));
    const panel = read(join(DIRECTOR_COMPONENTS, "heby-assistant-panel.tsx"));
    for (const source of [notice, panel]) {
      for (const kr of [
        "knowledge-retrieval", "buildRetrievalEvidence", "isSupportedEvidence",
        "multipleRelevantSources", "heby-answer", "knowledge-evidence",
      ]) {
        assert.ok(!source.includes(kr), `the Director repair must not touch the KR3/KR4 path (${kr})`);
      }
    }
  }
}

run();
