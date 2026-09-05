/*
 * K4 — the ratification ceremony is RENDERED, not merely present in a file.
 *
 * ── WHY THIS EXISTS, AND WHAT IT REPAIRS ─────────────────────────────────────
 *
 * `boundaries-and-firewall.ts` asserts `assert.match(read(PAGE), /KnowledgeReviewCard/)`. That is a
 * REGEX OVER SOURCE TEXT. It proves the identifier appears in the page file and nothing more — it
 * would pass unchanged if the component were mounted behind a predicate that is never true, and it
 * did in fact coexist with a TRH-4 report that claimed a rendered surface it had never rendered.
 *
 *     SOURCE PRESENCE != COMPONENT DEFINED != COMPONENT MOUNTED
 *                     != ROUTE RENDERED    != AUTHORIZED CONTROL AVAILABLE
 *
 * This file moves exactly one rung up that ladder: it RENDERS the component and asserts what a
 * reader would actually see, for each authorization state. It does not claim the rung above it.
 *
 * ── WHAT THIS DELIBERATELY DOES NOT CLAIM ────────────────────────────────────
 *
 * NOT route-level acceptance. `/knowledge` is an async server component that resolves a durable
 * session, reads the canonical Knowledge authority and resolves Governance authority. Rendering it
 * here would mean faking all three — that is, MOCKING AWAY THE EXACT PREDICATE the missing test was
 * supposed to prove — and extracting its `reviewBlock` derivation into a helper purely to make it
 * testable would move product logic for the test's convenience. Both were refused. The route's own
 * derivation of `reviewBlock`/`reviewable` therefore REMAINS UNPROVEN BY TEST, and the closure that
 * depends on it says so.
 *
 * ── NO NEW TEST ARCHITECTURE ─────────────────────────────────────────────────
 *
 * No Playwright, Cypress, Vitest, jsdom or testing-library was added. `react-dom/server` is already
 * a dependency of this application, and this file runs under the existing `node --import tsx`
 * runner like every other suite. The only unusual import is Next's app-router context, which the
 * card needs because it calls `useRouter()`; a static render supplies an inert router that is never
 * invoked, because nothing here clicks anything.
 *
 * ── WHAT IS REAL, AND WHAT IS A FIXTURE ──────────────────────────────────────
 *
 * REAL: the component, its `reviewable` predicate, the contract strings, and the markup it emits.
 * FIXTURE: the record and the `ReviewBlock`, which stand in for the values the route derives.
 * NOTHING is mocked inside the component itself.
 */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { KnowledgeReviewCard } from "../../src/components/knowledge-workspace/knowledge-review-card";
import type { ReviewBlock } from "../../src/components/knowledge-workspace/knowledge-review-card";
import {
  RATIFICATION_NON_EFFECTS,
  RATIFICATION_VERSION_SCOPE_NOTICE,
} from "../../src/features/knowledge-ratification/contracts";

/*
 * An inert router. The card calls `useRouter()` at render time and `router.refresh()` only after a
 * successful submission — which a static render never reaches, so every method here stays uncalled.
 * Providing it is what makes the component renderable outside a Next request; it grants nothing.
 */
const INERT_ROUTER = {
  push() {},
  replace() {},
  refresh() {},
  back() {},
  forward() {},
  prefetch() {},
} as unknown as never;

/**
 * The shape the route derives for one Knowledge record. Field names and values mirror the released
 * read model — `activeKnowledgeNodeId`, `knowledgeVersion` and `ratified` are the three the card's
 * own predicate reads.
 */
function record(overrides: Record<string, unknown> = {}) {
  return {
    factId: "00000000-0000-4000-8000-00000000fac7",
    factKey: "test-product-offering",
    domainKey: "products",
    scope: "company-wide",
    title: "Ürün yelpazesi",
    statement: "Bu kuruluş el yapımı ürünler satmaktadır.",
    lifecycleStatus: "draft",
    authorityClass: "provisional",
    ratified: false,
    ratifiedAt: null,
    ratifiedByActorId: null,
    activeKnowledgeNodeId: "00000000-0000-4000-8000-00000000n0de".replace(/[^0-9a-f-]/g, "0"),
    knowledgeVersion: 1,
    freshness: "unknown",
    ...overrides,
  } as never;
}

/** Render the card exactly as the route mounts it, and return the markup a reader would receive. */
function render(rec: unknown, block: ReviewBlock | undefined): string {
  return renderToStaticMarkup(
    createElement(
      AppRouterContext.Provider as never,
      { value: INERT_ROUTER },
      createElement(KnowledgeReviewCard as never, { record: rec, block } as never),
    ),
  );
}

function main(): void {
  /* ── 1. AUTHORIZED + UNRATIFIED — the ceremony is actually on screen ──────── */
  {
    const html = render(record(), undefined);

    // The section identity, so a reader can tell this apart from the records list.
    assert.match(html, /Governance review/, "the rendered card names the Governance act");

    // The exact record identity. Ratifying the wrong version is the failure this addresses.
    assert.ok(html.includes("test-product-offering"), "the fact key is rendered");
    assert.ok(html.includes("products"), "the domain is rendered");
    assert.ok(html.includes("company-wide"), "the scope is rendered");
    assert.match(html, /v1\b/, "the exact version under review is rendered");

    /*
     * THE DISCLOSURES, ASSERTED FROM THE CONTRACT RATHER THAN FROM A COPY. If somebody edits a
     * non-effect string, this fails — which is the point: the surface must render the contract, not
     * a paraphrase that has drifted from it.
     */
    for (const nonEffect of RATIFICATION_NON_EFFECTS) {
      assert.ok(html.includes(nonEffect), `the rendered card states that ratification ${nonEffect}`);
    }
    assert.ok(
      html.includes(RATIFICATION_VERSION_SCOPE_NOTICE),
      "the rendered card carries the version-scope notice verbatim",
    );

    // The control itself. Not the import — the rendered affordance.
    assert.match(html, /Ratify/, "an eligible reviewer is offered the ratification action");
  }

  /* ── 2. UNAUTHORIZED — the control is ABSENT, not merely disabled ─────────── */
  {
    /*
     * Each refusal the route can derive. A Knowledge author who is not the Governance authority is
     * the case that matters most: they may legitimately SEE the record, and must not be offered the
     * decision. Absence is asserted rather than a `disabled` attribute, because a disabled control
     * still tells a reader the act is theirs to make.
     */
    for (const kind of ["unauthenticated", "no-governance-authority", "not-the-governance-authority"] as const) {
      const html = render(record(), { kind });
      assert.ok(!html.includes("Ratify"), `a ${kind} reviewer is offered no ratification action`);
      assert.ok(!html.includes("<textarea"), `a ${kind} reviewer is offered no justification field`);
    }
  }

  /* ── 3. ALREADY RATIFIED — settled, and not offered a second time ─────────── */
  {
    const html = render(
      record({ ratified: true, ratifiedAt: "2026-09-05T10:36:51.165Z" }),
      undefined,
    );
    assert.match(html, /ratified/, "a ratified version says so");
    assert.ok(!html.includes("<textarea"), "a ratified version is offered no second justification");
    /*
     * `previouslyRatified: false` is the writer's own guarantee that a second ratification cannot be
     * recorded. The surface must not invite the attempt the writer would refuse.
     */
    assert.ok(
      !/>\s*Ratify\s*</.test(html),
      "a ratified version is not offered a second ratification control",
    );
  }

  /* ── 4. NO ACTIVE NODE — nothing to bind a decision to ────────────────────── */
  {
    /*
     * The third clause of the card's predicate. A fact whose active node cannot be resolved has no
     * exact version for a decision to name, and the writer would refuse with `version-unresolvable`.
     * The surface refuses first.
     */
    const html = render(record({ activeKnowledgeNodeId: null }), undefined);
    assert.ok(!html.includes("<textarea"), "a record with no active version offers no ceremony");
  }

  console.log("PASS k4 review card renders the ratification ceremony by authorization state");
}

main();
