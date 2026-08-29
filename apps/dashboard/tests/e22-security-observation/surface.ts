/*
 * E2-2 / S-B — WHAT A DIRECTOR ACTUALLY SEES.
 *
 * The model tests prove the projection is truthful. This proves the RENDERED SURFACE is, because a
 * correct model displayed by a component with two branches where three states exist is still a lie
 * on the page — which is exactly the truth bug E2-2 repaired in `security-sources.tsx`.
 *
 * Rendered with `renderToStaticMarkup`, the same way the released Command and workspace suites
 * check their surfaces. No database, no network, no browser.
 *
 *     KNOWN EMPTY        != UNAVAILABLE
 *     ZERO RECORDED ACTS != SECURE
 *     AUDIT RECORD       != SECURITY EVENT
 */
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

import { SecurityCenter } from "../../src/components/security-center/security-center";
import { getSecurityCenterModel } from "../../src/features/security-center";
import type { SecurityRecordedActObservation } from "../../src/features/security-center/contracts";
import {
  SECURITY_OBSERVATION_PROVENANCE,
  SECURITY_OBSERVATION_LIMITS,
  SECURITY_OBSERVATION_UNAVAILABLE,
} from "../../src/features/governance-activity/security-observation-source.server";

const TENANT = "11111111-1111-4111-8111-111111111111";

/** Strip tags so an assertion reads the SENTENCE a person sees, not the markup around it. */
const text = (markup: string): string =>
  markup.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ");

function render(observation: SecurityRecordedActObservation | null): string {
  return text(renderToStaticMarkup(React.createElement(SecurityCenter, { model: getSecurityCenterModel(TENANT, observation) })));
}

const base = {
  sourceClass: "audit",
  authoritative: false,
  provenance: SECURITY_OBSERVATION_PROVENANCE,
  limits: SECURITY_OBSERVATION_LIMITS,
} as const;

function main(): void {
  /* ── 1 · RECORDED — the acts reach the page, with their real values ───────── */
  {
    const page = render({
      ...base,
      state: "recorded",
      generatedAt: "2026-08-29T12:00:00.000Z",
      acts: [
        {
          occurredAt: "2026-08-29T10:00:00.000Z",
          action: "knowledge.ratify",
          entityType: "knowledge_fact",
          actorType: "human",
          result: "succeeded",
          source: "governance-authority",
          authoritySource: "membership",
          simulation: false,
        },
      ],
      totalRecordedActs: 41,
      truncated: true,
      unavailableReason: null,
    });

    assert.ok(page.includes("Recorded Governed Acts"), "the region is on the page");
    assert.ok(page.includes("knowledge.ratify"), "the act's own verb is shown, not a re-interpretation");
    assert.ok(page.includes("knowledge_fact") && page.includes("human") && page.includes("succeeded"));
    assert.ok(page.includes("governance-authority") && page.includes("membership"));
    assert.ok(page.includes("of 41"), "the INDEPENDENT total is shown beside the page");
    assert.ok(page.includes("holds more than this page shows"), "truncation is disclosed, not hidden");

    /* Provenance and limits travel WITH the evidence. */
    assert.ok(page.includes("Where this comes from:"));
    assert.ok(page.includes("What it does not show:"));
    assert.ok(page.includes("Connected · derived"), "the standing is on the page beside the evidence");
    assert.ok(page.includes("not a live stream"), "request-time is disclosed as request-time");

    /*
     * AND THE EVIDENCE BODY MUST NOT PROMOTE A RECORDED ACT INTO SOMETHING IT IS NOT.
     *
     * SCOPED, AND THE FIRST VERSION WAS NOT — it banned these words across the whole page and
     * failed, because the page DENIES them: the audit source's `cannotProve` reads "A security
     * event, finding, incident, threat or breach", and the limits sentence denies the same list.
     * A guard that a surface's own honest denial can trip is a guard that gets deleted, which this
     * repository has now recorded four times. So the ban runs over the EVIDENCE BODY only — the
     * region between its heading and its provenance block, which is where a promotion would live —
     * and the denials are asserted separately, by equality, below.
     */
    const body = page.slice(
      page.indexOf("Recorded Governed Acts"),
      page.indexOf("Where this comes from:"),
    );
    assert.ok(body.includes("knowledge.ratify"), "the slice really is the evidence body");
    for (const forbidden of ["security event", "threat", "attack", "breach", "malicious", "severity", "risk"]) {
      assert.equal(
        body.toLowerCase().includes(forbidden),
        false,
        `the rendered evidence must not call a recorded act a "${forbidden}"`,
      );
    }
    /* And the denial itself is present, verbatim, rather than merely absent-of-bad-words. */
    assert.ok(page.includes(SECURITY_OBSERVATION_LIMITS), "the limits sentence reaches the page verbatim");
    assert.ok(page.includes(SECURITY_OBSERVATION_PROVENANCE), "and so does the ledger's own provenance");
    /* No finding, no incident and no score appeared alongside the new evidence. */
    assert.ok(page.includes("No validated security findings"), "findings are still honestly empty");
    assert.ok(page.includes("Incidents Not available"), "incidents are still unavailable");
  }

  /* ── 2 · KNOWN-EMPTY — read, empty, and explicitly NOT an all-clear ───────── */
  {
    const page = render({
      ...base,
      state: "known-empty",
      generatedAt: "2026-08-29T12:00:00.000Z",
      acts: [],
      totalRecordedActs: 0,
      truncated: false,
      unavailableReason: null,
    });

    assert.ok(page.includes("holds no recorded acts for this organization"));
    assert.ok(page.includes("not a read failure"), "the page says which of the two states this is");
    assert.ok(
      page.includes("not an all-clear"),
      "ZERO RECORDED ACTS != SECURE — the page says so rather than letting the reader infer safety",
    );
    assert.ok(page.includes("Connected · derived"), "connected, and still derived");
  }

  /* ── 3 · UNAVAILABLE — and it does not read as calm or empty ──────────────── */
  {
    const page = render({
      ...base,
      state: "unavailable",
      generatedAt: null,
      acts: [],
      totalRecordedActs: null,
      truncated: false,
      unavailableReason: SECURITY_OBSERVATION_UNAVAILABLE["persistence-not-configured"],
    });

    assert.ok(page.includes("could not be read"), "the failure is stated");
    assert.ok(
      page.includes("That is a fact about the deployment, not about your organization"),
      "the honest reason reaches the page verbatim",
    );
    assert.ok(page.includes("Unavailable"), "labelled unavailable, never connected-and-empty");
    assert.equal(
      page.includes("holds no recorded acts for this organization"),
      false,
      "an unreadable ledger must never render as an empty one",
    );
  }

  /* ── 4 · NO OBSERVATION SUPPLIED — still not an empty ledger ──────────────── */
  {
    const page = render(null);
    assert.ok(page.includes("No observation was read for this request"));
    assert.ok(page.includes("not a statement that nothing was recorded"));
    assert.equal(page.includes("holds no recorded acts for this organization"), false);
  }

  /* ── 5 · (M) THE SOURCE CARD SHOWS "CONNECTED", NOT "DERIVED" ─────────────── */
  {
    /*
     * The truth bug, rendered. Before E2-2 this component had two branches, so a connected source
     * would have been labelled "Derived" and filed under derived sources with no error anywhere.
     */
    const page = render(null);
    assert.ok(page.includes("Connected sources"), "the connected group exists on the page");
    assert.ok(page.includes("Derived sources") && page.includes("Not connected"));

    const connectedGroup = page.slice(page.indexOf("Connected sources"), page.indexOf("Derived sources"));
    assert.ok(connectedGroup.includes("audit"), "the audit source is shown under Connected");
    assert.equal(
      connectedGroup.includes("Derived"),
      false,
      "and it is NOT labelled Derived — the released two-branch label was the defect",
    );

    /* The other nine classes did not follow it into the connected group. */
    for (const other of ["authentication", "provider", "policy", "network", "incident-feed"]) {
      assert.equal(connectedGroup.includes(other), false, `${other} did not become connected`);
    }
  }

  /* ── 6 · THE STATE STRIP STOPPED CLAIMING BOTH WAYS ───────────────────────── */
  {
    const page = render(null);
    /* "Not connected" alone became false; "Connected" alone would imply a live feed. Both halves. */
    assert.ok(page.includes("No live feed · recorded acts connected"));
    assert.ok(page.includes("Human authority required"), "response still requires a human");
    assert.ok(page.includes("No retained security evidence"), "this surface still retains nothing");
  }

  console.log("e22-security-observation/surface: OK");
}

main();
