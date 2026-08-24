import type { Metadata } from "next";
import Link from "next/link";
import { CapabilityLedger } from "@/components/public/capability-ledger";
import { GovernedPath } from "@/components/public/governed-path";
import { PublicLede, PublicProse, PublicSection } from "@/components/public/public-section";
import { PublicTrace, PublicTraceOrigin } from "@/components/public/public-trace";
import { RecordAnatomy } from "@/components/public/record-anatomy";
import { RequestAccessLink } from "@/components/public/request-access-link";
import { ScopeBoundary } from "@/components/public/scope-boundary";
import { SecurityMechanisms } from "@/components/public/security-mechanisms";
import { SystemPlate } from "@/components/public/system-plate";

/*
 * The public homepage.
 *
 * ── `/` IS PUBLIC, AND IT DOES NOT LOOK AT THE READER ────────────────────────
 *
 * No session-aware branch: a signed-in reader and a signed-out reader get the same bytes. The
 * authenticated product stays reachable at its own routes.
 *
 * ── EVERY CLAIM COMES FROM THE PUBLIC CLAIM CONTRACT ─────────────────────────
 *
 * Capabilities, limits, the governed path, the record anatomy and the security mechanisms are all
 * rendered from `features/public-claims/capability-claims.ts`, whose statements are bound to the
 * authoritative repository contracts by `tests/pub1-public-surface/claim-truth.ts`.
 *
 * ── NO TENANT DATA REACHES THIS FILE ─────────────────────────────────────────
 *
 * No database handle, no session, no tenant context, no provider credential authority. The page is
 * static: it takes no request input, so there is nothing for it to vary on.
 *
 * ── THE REWORK: TWO REGISTERS, ONE PATH ──────────────────────────────────────
 *
 * The page now alternates between two grounds, and the alternation is a RULE rather than a rhythm
 * trick:
 *
 *   INK  is the MECHANISM register — the hero, the governed path, the Google scope boundary and the
 *        close. These are the places where the page DRAWS how the system works.
 *   LIGHT is the EVIDENCE register — what it is, what works today, what protects it. These are the
 *        places where the page asks to be READ.
 *
 * A reader always knows which of the two they are in, and the trace crosses between them.
 *
 * NOT ONE SENTENCE OF COPY IS NEW. Every headline, statement, paragraph and label below is a string
 * the site already published, or comes from the claim contract. What changed is scale, ground,
 * order and geometry — the hero's flat strip of three sentences became a sequenced plate that
 * breaks the fold, the section heading stopped being an 18px label, and the two mechanism sections
 * became drawings instead of paragraphs.
 *
 * THE TRACE MAKES NO CLAIM. It is a drawn line whose length follows the viewport's own scroll
 * position — it observes nothing about the reader and is not related to Hebun's audit records.
 */
export const metadata: Metadata = {
  title: "Hebun AI — authority before action",
  description:
    "Hebun AI is an enterprise AI operating system where organizational knowledge, governed decisions and permitted actions carry explicit authority and a durable record.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Hebun AI",
    title: "Hebun AI — authority before action",
    description:
      "An enterprise AI operating system where organizational knowledge, governed decisions and permitted actions carry explicit authority and a durable record.",
  },
};

export default function PublicHomePage() {
  return (
    <>
      <PublicTrace>
        {/* ══ HERO ══════════════════════════════════════════════════════════
          * An ink surface holding the first screen, and ending mid-object.
          *
          * Layers, back to front: one ambient wash low in the frame, the blueprint lattice, the
          * boundary rule with its gate, then the words, then the plate. No mesh, no orb, no
          * particle field, no shader, no screenshot and no illustration standing in for one.
          *
          * The composition IS the headline's argument. The trace descends the margin, reaches a
          * drawn boundary, passes through a gate on it — and only past that gate does the plate,
          * where acts are sequenced, begin.
          */}
        <section className="public-ink relative overflow-hidden">
          <span aria-hidden="true" className="public-field">
            <span className="public-field-wash" />
            <span className="public-blueprint" />
          </span>

          <div className="public-inset relative mx-auto w-full max-w-[var(--container-max)]">
            <div className="relative flex flex-col justify-center pt-16 pb-14 lg:min-h-[calc(100svh-var(--topbar-h)-9rem)] lg:pt-20 lg:pb-16">
              <PublicTraceOrigin />

              <p className="public-rise-in flex items-center gap-3 font-mono text-label tracking-[0.16em] uppercase text-fg-muted">
                <span>Enterprise AI operating system</span>
              </p>

              <h1 className="public-reveal mt-8 max-w-[11ch] text-hero font-extrabold tracking-[var(--tracking-hero)] text-balance text-fg">
                Authority before action.
              </h1>

              {/*
                * Everything stays in the left column and the right of the frame is left to the
                * drawing. A call to action parked alone in the far corner of a 1440 hero is not
                * asymmetry, it is a gap — the composition's weight belongs low and left, with the
                * plate anchoring the bottom edge.
                */}
              <p className="public-rise-in mt-9 max-w-[46ch] text-title leading-relaxed text-pretty text-fg-secondary [--public-stagger:var(--dur-fast)]">
                Hebun AI is an enterprise AI operating system where organizational knowledge,
                governed decisions and permitted actions carry explicit authority and a durable
                record.
              </p>

              <div className="public-rise-in mt-10 flex flex-col items-stretch gap-3 [--public-stagger:var(--dur-base)] sm:flex-row sm:items-center sm:gap-4">
                <RequestAccessLink />
                <Link
                  href="#how-it-works"
                  className="inline-flex h-13 min-h-[3.25rem] items-center justify-center rounded-md border border-border-strong px-6 text-body font-semibold text-fg hover:border-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  How it works
                </Link>
              </div>
            </div>

            {/* The boundary, and the gate the trace passes through. */}
            <div className="relative h-0" aria-hidden="true">
              <span className="public-boundary" />
              <span className="public-boundary-gate" />
            </div>

            {/*
              * The plate breaks the fold: on a laptop the first screen ends part-way down it, so
              * finishing the object you are already reading is the reason to scroll.
              */}
            <div className="public-rise-in relative pt-16 pb-20 [--public-stagger:var(--dur-slow)] lg:pt-20 lg:pb-24">
              <SystemPlate />
            </div>
          </div>
        </section>

        {/* ══ 01 · PRODUCT — light, the first evidence surface ═══════════════ */}
        <PublicSection
          id="product"
          index="01"
          title="What it is"
          statement="Where an organization keeps what it knows, and who may decide with it."
          size="tall"
          layout="wide"
          trace
        >
          <div className="grid grid-cols-1 gap-x-20 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <PublicLede>
              An organization works inside its own workspace. A permitted person brings in text —
              pasted, a .txt or .md file, or a text-bearing PDF — and it becomes a knowledge record
              attributed to its source and to the person who added it.
            </PublicLede>
            <PublicProse>
              Anyone permitted can then ask a question and receive an answer drawn from those
              records, with the records shown beside it. When the organization holds nothing on the
              subject, the answer says so rather than composing one. Authority to decide is read
              from a recorded act, never inferred from a job title.
            </PublicProse>
          </div>
          <RecordAnatomy />
        </PublicSection>

        {/* ══ 02 · MECHANISM — ink, the tall system passage ══════════════════
          * The page's longest section and its centre of gravity. The heading sticks under the
          * header for the whole descent, so the six stages are read as one argument rather than as
          * six blocks that happen to follow each other.
          */}
        <PublicSection
          id="how-it-works"
          index="02"
          title="The governed path"
          statement="A chatbot answers. Hebun records."
          tone="ink"
          size="tall"
          trace
        >
          <PublicLede>
            One path runs from what an organization knows to what it permitted and what was written
            down afterwards. The stages are not equally wide, and each one below states where it
            stops.
          </PublicLede>
          <GovernedPath />
        </PublicSection>

        {/* ══ 03 · CAPABILITY LEDGER — light, the dense evidence moment ══════
          * `layout="wide"` moves the heading above the content. The ledger is a three-column table
          * whose third column is the limit, and the limit is the reason the table exists — it gets
          * the full measure rather than the two-thirds a gutter would leave it.
          */}
        <PublicSection
          index="03"
          title="What works today"
          statement="Every capability is published with the limit that goes with it."
          size="dense"
          layout="wide"
          trace
        >
          <PublicProse>Anything absent from this table is absent from the product.</PublicProse>
          <CapabilityLedger />
        </PublicSection>

        {/* ══ 04 · GOOGLE — ink, the scope boundary drawn ════════════════════ */}
        <PublicSection
          id="integrations"
          index="04"
          title="Integrations"
          statement="An organization can connect a real Google account."
          tone="ink"
          layout="split"
          trace
        >
          <div className="flex flex-col gap-8">
            <PublicLede>
              An organization can connect a real Google account. What Hebun may then do is derived
              from the scope that account actually granted, read back in Google&rsquo;s own spelling
              and checked before anything is spent — a short grant is reported as short, not as an
              error.
            </PublicLede>
            <PublicProse>
              Any other integration is listed here the same way, with the access it needs written
              next to it.
            </PublicProse>
          </div>
          <ScopeBoundary />
        </PublicSection>

        {/* ══ 05 · SECURITY — light, compact and dense ═══════════════════════ */}
        <PublicSection
          id="security"
          index="05"
          title="Security and governance"
          statement="Named mechanisms, not adjectives."
          size="compact"
          trace
        >
          <SecurityMechanisms />
          <PublicProse>Hebun holds no compliance certification and claims none.</PublicProse>
        </PublicSection>
      </PublicTrace>

      {/* ══ FINAL CTA — ink, and the trace's DESTINATION ═══════════════════════
        * It sits OUTSIDE the trace on purpose. The trace is the argument; this is where the
        * argument arrives.
        */}
      <section className="public-ink relative overflow-hidden border-t border-border">
        <span aria-hidden="true" className="public-field">
          <span className="public-field-wash" />
        </span>
        <div className="public-inset relative mx-auto grid w-full max-w-[var(--container-max)] grid-cols-1 gap-y-10 py-24 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-x-20 lg:py-32">
          <p className="flex items-baseline gap-3 font-mono text-label tracking-[0.16em] uppercase text-fg-muted">
            <span>Access</span>
          </p>
          <div className="flex flex-col gap-8">
            <h2 className="max-w-[var(--measure-statement)] text-statement font-bold tracking-[var(--tracking-statement)] text-balance text-fg">
              Hebun is not open for self-serve sign-up.
            </h2>
            <p className="max-w-[var(--measure-prose)] text-title leading-relaxed text-pretty text-fg-secondary">
              Organizations join by invitation. Tell us who you are and what your organization needs
              to govern.
            </p>
            <div>
              <RequestAccessLink />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
