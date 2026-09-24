import Link from "next/link";
import { ArrowRight, CircleCheck, CircleDashed, Scale, Sparkles } from "lucide-react";

import { CommandRegion } from "@/components/command-overview/region";
import { ExecutivePresentation } from "@/components/command-overview/executive-presentation-client";
import { cn } from "@/lib/utils";
import type {
  CommandStanding,
  ExpressIntentSummary,
  WaitingOnYouState,
} from "@/features/command-overview/workspace-model";

/*
 * THE COMMAND HERO (command-final).
 *
 * The mountain plate, the greeting and the organization name come from the released presentation.
 * On top of it sit two things that ARE claims, each inside its own region:
 *
 *   the attention line  — the decision queue's own state, in its three honest shapes: something
 *                         waiting, nothing waiting, or a queue that could not be read. The last one
 *                         never becomes "0".
 *   Ask Hebun           — the intent entry, with the registry's declared and invokable counts. It
 *                         links to Director Intent; it submits nothing from here.
 */
function AttentionLine({ waiting }: { readonly waiting: WaitingOnYouState }) {
  if (waiting.status === "unavailable") {
    return (
      <div className="inline-flex min-w-0 max-w-full items-center gap-2.5 rounded-xl bg-surface/90 px-3 py-2 text-meta text-fg-secondary shadow-xs">
        <CircleDashed className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
        <span className="min-w-0 truncate">Decision queue could not be read · <span className="text-fg-muted">not the same as nothing waiting</span></span>
      </div>
    );
  }
  if (waiting.status === "none-waiting") {
    return (
      <div className="inline-flex min-w-0 max-w-full items-center gap-2.5 rounded-xl bg-surface/90 px-3 py-2 text-meta text-fg-secondary shadow-xs">
        <CircleCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
        <span className="min-w-0 truncate">Nothing is waiting on your decision</span>
      </div>
    );
  }
  const count = waiting.awaitingCount;
  return (
    <div className="cmd-attention inline-flex min-w-0 max-w-full items-center gap-3 rounded-xl bg-surface py-1.5 pl-2 pr-1.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-warning-subtle text-warning" aria-hidden="true">
        <Scale className="size-4" strokeWidth={1.8} />
      </span>
      <span className="min-w-0 truncate text-meta text-fg-secondary">
        {count !== null ? (
          <><span className="font-bold text-warning">{count} {count === 1 ? "proposal is" : "proposals are"}</span> held for your decision</>
        ) : (
          <span className="font-bold text-warning">Proposals are held for your decision</span>
        )}
        {waiting.oldestWaiting ? <> · oldest <span className="font-bold text-warning">{waiting.oldestWaiting.label}</span></> : null}
      </span>
      <Link
        href="/approvals"
        className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-meta font-semibold text-primary transition-colors hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
      >
        Review <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}

export function ExecutiveContext({
  standing,
  intent,
  waiting,
  askPrimary,
  humanName,
}: {
  readonly standing: CommandStanding;
  readonly intent: ExpressIntentSummary;
  readonly waiting: WaitingOnYouState;
  /** When nothing waits on a decision, asking Hebun is the one primary act on the page. */
  readonly askPrimary: boolean;
  readonly humanName?: string | null;
}) {
  const named = standing.status === "named";
  return (
    <div className="cmd-context cmd-hero relative grid min-w-0 grid-cols-1 overflow-hidden rounded-[1.25rem] border border-border shadow-sm lg:grid-cols-[minmax(0,1fr)_24rem]">
      <ExecutivePresentation humanName={humanName} organizationName={named ? standing.organizationName : null} />

      <CommandRegion
        id="executive-context"
        title="Organization context"
        question="Which organization is this operating picture for?"
        provenance={null}
        readState={named ? "available" : "unavailable"}
        weight="bare"
        className={cn("relative z-20 justify-end px-6 pb-5 pt-28 sm:px-8 [&>div:first-child]:sr-only")}
        bodyClassName="gap-2"
      >
        {named ? null : (
          <p className="text-meta text-fg-muted">Organization could not be read · {standing.detail}</p>
        )}
        <div className="min-w-0">
          <AttentionLine waiting={waiting} />
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
        className="relative z-20 justify-center gap-1.5 px-6 pb-4 lg:py-4 lg:pl-0 lg:pr-6 [&>div:first-child]:sr-only [&_[data-provenance]]:justify-end"
      >
        <div className="rounded-2xl border border-border bg-surface/95 p-4 shadow-[0_12px_30px_-16px_rgb(59_79_160/0.45)]">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[0.625rem] bg-highlight text-on-primary" aria-hidden="true">
              <Sparkles className="size-[1.125rem]" strokeWidth={1.8} />
            </span>
            <div className="min-w-0">
              <p className="text-meta font-bold leading-tight text-fg">Ask Hebun</p>
              <p className="truncate text-label text-fg-muted">Heby proposes · you decide</p>
            </div>
          </div>
          <Link
            href="/command/intent"
            className={cn(
              "group mt-3 flex min-w-0 items-center gap-2 rounded-xl border py-2 pl-3 pr-2 text-meta transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring",
              askPrimary
                ? "border-primary bg-primary text-on-primary hover:bg-primary-hover"
                : "border-border bg-surface-sunken text-fg-muted hover:border-primary/40",
            )}
          >
            <span className="min-w-0 flex-1 truncate">What do you want your organization to do?</span>
            <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", askPrimary ? "bg-white/20 text-on-primary" : "bg-primary text-on-primary")} aria-hidden="true">
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
          <p className="mt-2.5 truncate text-label text-fg-secondary">
            {intent.declared} capabilities declared · {intent.invokableNow} can run now
          </p>
        </div>
      </CommandRegion>
    </div>
  );
}
