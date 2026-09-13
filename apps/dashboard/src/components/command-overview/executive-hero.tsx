import Link from "next/link";
import { ArrowRight, ArrowUpRight, BriefcaseBusiness, Cable, ClipboardCheck, ShieldCheck, Sparkles } from "lucide-react";

import { CommandRegion } from "@/components/command-overview/region";
import { ExecutivePresentation } from "@/components/command-overview/executive-presentation-client";
import { cn } from "@/lib/utils";
import type {
  CommandStanding,
  ExpressIntentSummary,
  SummaryCard,
} from "@/features/command-overview/workspace-model";

/** The V3 opening is a shallow executive context band, never a decorative hero. */
export function ExecutiveContext({
  standing,
  intent,
  askPrimary,
  humanName,
}: {
  readonly standing: CommandStanding;
  readonly intent: ExpressIntentSummary;
  readonly askPrimary: boolean;
  readonly humanName?: string | null;
}) {
  const named = standing.status === "named";
  return (
    <div className="cmd-context relative grid min-w-0 grid-cols-1 items-stretch overflow-hidden rounded-2xl border border-border shadow-sm lg:grid-cols-[minmax(0,3fr)_minmax(13rem,1fr)]">
      <ExecutivePresentation humanName={humanName} organizationName={named ? standing.organizationName : null} />
      <CommandRegion
        id="executive-context"
        title="Organization context"
        question="Which organization is this operating picture for?"
        provenance="authoritative"
        provenanceDetail="The Organization Authority, through the released Live Map projection."
        readState={named ? "available" : "unavailable"}
        weight="bare"
        className="relative z-20 [&>div:first-child]:sr-only"
        bodyClassName="sr-only"
      >
        <div className="cmd-org-context min-w-0">
          <p className={cn("truncate text-label", named ? "text-fg-secondary" : "text-fg-muted") }>
            {named ? standing.organizationName : `Organization unavailable · ${standing.detail}`}
          </p>
        </div>
      </CommandRegion>

      <CommandRegion
        id="intent"
        title="Ask Hebun"
        question="Where can the Director ask Hebun to investigate or prepare an outcome?"
        provenance="configuration"
        provenanceDetail="Counted from the declared action registry."
        readState="available"
        provenanceNonClaims="Declared is not invokable. Invokable is not authorized. Authorized is not executed. Executed is not successful. Free text never reaches execution."
        weight="bare"
        className="cmd-ask-region relative z-20 justify-end border-t border-white/20 bg-transparent px-5 pb-2 pt-20 max-lg:pb-3 max-lg:pt-28 lg:border-t-0 [&>div:first-child]:sr-only"
        bodyClassName="gap-1"
      >
        <div className="cmd-ask-entry flex min-w-0 items-center justify-end gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/54 text-highlight shadow-xs backdrop-blur-sm" aria-hidden="true">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-meta font-semibold leading-tight text-fg">Ask Hebun</p>
            <p className="mt-0.5 truncate text-label leading-4 text-fg-secondary">
              {intent.declared} capabilities declared · {intent.invokableNow} can run now
            </p>
          </div>
          <Link
            href="/command/intent"
            className={cn(
              "group inline-flex size-11 shrink-0 items-center justify-center rounded-xl border transition-colors duration-(--dur-fast) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring",
              askPrimary
                ? "border-primary bg-primary text-on-primary shadow-sm hover:bg-primary-hover"
                : "border-border-strong bg-surface text-primary hover:border-primary/40 hover:bg-surface-sunken",
            )}
          >
            <span className="sr-only">Ask Hebun</span>
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>
      </CommandRegion>
    </div>
  );
}

function SignalCell({ card }: { readonly card: SummaryCard }) {
  const SignalIcon = {
    attention: ClipboardCheck,
    work: BriefcaseBusiness,
    connected: Cable,
    activity: ShieldCheck,
  }[card.key] ?? Sparkles;
  const iconTone = card.reading === "unread"
    ? "bg-surface-sunken text-fg-muted"
    : card.key === "attention"
      ? "bg-highlight/10 text-highlight"
      : card.key === "work"
        ? "bg-success-subtle text-success"
        : card.key === "connected"
          ? "bg-warning-subtle text-warning"
          : "bg-primary-subtle text-primary";
  const content = (
    <>
      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", iconTone)} aria-hidden="true">
        <SignalIcon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="cmd-signal-label block whitespace-nowrap text-label font-medium text-fg-secondary">{card.label}</span>
        <span className="mt-0.5 flex min-w-0 items-baseline gap-2">
          <span data-reading={card.reading} className={cn("cmd-signal-value shrink-0 font-semibold leading-none tabular-nums", card.reading === "unread" ? "text-fg-secondary" : "text-fg") }>
            {card.value}
          </span>
          <span className="min-w-0 truncate text-label text-fg-muted">{card.context}</span>
        </span>
      </span>
      {card.href ? <ArrowUpRight className="size-3.5 shrink-0 text-fg-muted" aria-hidden="true" /> : null}
    </>
  );

  return card.href ? (
    <Link href={card.href} className="cmd-signal-card flex min-h-20 min-w-0 items-center gap-2 rounded-xl border border-border bg-surface px-3 py-3 shadow-xs transition-colors hover:bg-surface-sunken focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring sm:gap-3 sm:px-4">
      {content}
    </Link>
  ) : (
    <div className="cmd-signal-card flex min-h-20 min-w-0 items-center gap-2 rounded-xl border border-border bg-surface px-3 py-3 shadow-xs sm:gap-3 sm:px-4">{content}</div>
  );
}

/** Four compact cards form one operating level; every value still comes from its owning read. */
export function OperatingSignalStrip({ cards }: { readonly cards: readonly SummaryCard[] }) {
  return (
    <CommandRegion
      id="operating-signals"
      title="Operating signals"
      question="What can Hebun currently measure about this organization?"
      provenance="derived"
      provenanceDetail="Composed per request from the authorities that own each record."
      readState={cards.some((card) => card.reading === "unread") ? "unavailable" : cards.every((card) => card.reading === "none") ? "empty" : "available"}
      weight="bare"
      className="cmd-signal-region relative [&>div:first-child]:sr-only"
      bodyClassName="gap-1"
    >
      <div className="cmd-signal-strip grid min-w-0 grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => <SignalCell key={card.key} card={card} />)}
      </div>
    </CommandRegion>
  );
}
