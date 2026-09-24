import { PageHeader } from "@/components/layout/page-header";
import { ActBoundarySurface } from "@/components/operations-act-boundary/act-boundary-surface";
import { OperationsOverview } from "@/components/operations-overview/operations-overview";
import { OperationsPreparation } from "@/components/operations-preparation/operations-preparation";

/*
 * MEDIA-2B. The generation action defined in this route's `actions.ts` awaits a real OpenAI image
 * call whose transport pins a 150 s timeout (`OPENAI_IMAGE_TIMEOUT_MS`). Server Actions execute in
 * THIS route's function, so the route's duration is the one that has to outlast the transport.
 *
 * It is stated here rather than inherited. The platform default is 300 s only while Fluid compute
 * is on; without it the legacy default is far shorter, and the deployment API does not report which
 * regime applies. 180 s is valid under BOTH (it is under the 300 s legacy ceiling and far under the
 * 800 s Fluid one) and leaves 30 s of headroom over the transport, so the transport's own abort —
 * which records `timeout` on the invocation — always fires BEFORE the platform kills the function
 * and leaves the row stranded in `registered`.
 */
export const maxDuration = 180;

/*
 * ── WHY THIS ROUTE MAY NOT BE PRERENDERED ────────────────────────────────────
 *
 * MEASURED, not assumed: before this line existed, `next build` emitted
 * `.next/server/app/operations.html` with `x-nextjs-prerender: 1` and
 * `initialRevalidateSeconds: false` — a FULLY STATIC page — and the rendered HTML already
 * contained this route's band content baked in at build time.
 *
 * Every band here reads per-request, tenant-scoped truth: Band 1 reads this organization's work
 * artifacts, Band 2 reads its arming state and its execution ledger. A static prerender serves ONE
 * build-time render to every viewer, and at build time there is no session — so the cached page
 * would report "arming could not be established" and an unreadable ledger to everybody, forever,
 * no matter what the authorities actually hold.
 *
 * That is not a slow surface; it is a surface that states something untrue about an organization's
 * authority. This page's entire purpose is to not do that. So the route is explicitly dynamic, and
 * the prerender is refused rather than left to be inferred from whether some transitive callee
 * happened to touch `cookies()`.
 */
export const dynamic = "force-dynamic";

export const metadata = { title: "Operations — Hebun AI" };

/*
 * Operations Overview (Hebun UI Phase 22B rebuild).
 *
 * The operational truth surface: what operational state Hebun can actually observe today,
 * and where the execution boundary sits. It states honest availability per subsystem and
 * the real prepared→executed boundary (counts from the Phase 17 action registry). It no
 * longer presents the seeded/derived Executive Overview record counts as live operational
 * detail. No aggregate Operations Health %, no fabricated run/queue/incident/agent counts,
 * no execution controls. Read-only.
 *
 * OPS-P1 adds the PREPARATION surface beneath it — Recipients and Prepared work — which completes
 * the R3R and R3W authorities that shipped with server actions and no interface. It changes nothing
 * about the Overview above: preparation is not execution, records an address and a draft and
 * nothing else, and files no proposal. `/send` in Heby remains the only way a proposal is created.
 *
 * It renders INSIDE this route rather than beside it: the released Operations L2 is exactly
 * `Overview · Execution · Runtime & Signals · Execution Substrate`, pinned by deepEqual, and no
 * fifth destination is introduced.
 *
 * ── THE THREE BANDS, AND WHY THIS ORDER ──────────────────────────────────────
 *
 * 1. WORK IN FLIGHT      the human operational workspace — drafts, revisions, review, media,
 *                        package readiness, recipients. It leads because it is the only band
 *                        somebody comes here to USE.
 * 2. THE ACT BOUNDARY    can Hebun act on finished work, and if not, exactly what is missing.
 *                        Composed from two released readers; it originates no state.
 * 3. WHAT HEBUN CAN      the capability/reality diagnostic. Demoted to last, kept in full:
 *    OBSERVE             seeded, simulated and not-connected subsystems stay visible BY NAME,
 *                        because a known gap that is hidden stops being known.
 *
 * The Overview previously led this page. It was written in Phase 22A, and by the time the
 * execution ledger, the arming authority and the media authority shipped, the surface whose whole
 * purpose was to report reality honestly had become the page's most out-of-date claim. Correcting
 * it and demoting it are the same change.
 */

export default function OperationsPage() {
  return (
    <>
      <PageHeader
        title="Operations"
        context="The work in flight, whether Hebun may act on it, and what Hebun can observe — in that order."
      />
      {/* BAND 1 — the human operational workspace. It dominates the page by leading it. */}
      <OperationsPreparation />
      {/* BAND 2 — derived entirely from released arming and execution readers. */}
      <ActBoundarySurface />
      {/* BAND 3 — capability/reality diagnostic, last and deliberately quieter. */}
      <OperationsOverview />
    </>
  );
}
