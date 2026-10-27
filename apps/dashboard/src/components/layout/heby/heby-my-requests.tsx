"use client";

/*
 * heby-my-requests.tsx — HEBY-MY-REQUESTS: "what happened to the things I asked for?", from Heby's
 * top bar, after a reload or a day later.
 *
 * Closed, it is one button and reads nothing. Opening it (and "Refresh") runs ONE read of the
 * requests this person's session filed — human proposals and the agent proposals they asked for —
 * and states each lifecycle with the same sentences as the per-proposal check. It approves, executes
 * and links to nothing that would act; deciding still happens in Approvals.
 */
import { useRef, useState, useTransition, type CSSProperties } from "react";
import Link from "next/link";
import { ListChecks } from "lucide-react";
import {
  readMyHebyRequestsAction,
  type MyActionRequestLifecyclesRead,
} from "@/app/(dashboard)/heby/request-lifecycle-actions";
import { describeRequestLifecycle, LifecycleNextStepLink } from "./heby-origination-affordance";
import { HebyExecuteAuthorized } from "./heby-execute-authorized";

const UNREADABLE = "Hebun could not read your requests right now. Nothing was changed.";

export function HebyMyRequests() {
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState<MyActionRequestLifecyclesRead | "checking" | null>(null);
  const [, startTransition] = useTransition();
  /*
   * The Heby workspace is a fixed-height `overflow-hidden` section, which clipped an `absolute`
   * panel. `fixed` escapes it; the panel is placed under the button and BOTH edges are clamped to a
   * 16px viewport gutter (right-anchoring alone pushed it off the left edge when the button sat
   * left, as on phones). `--z-dropdown` lifts it over the `--z-sticky` sidebar and rail.
   */
  const anchor = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<CSSProperties>({});
  const position = () => {
    const rect = anchor.current?.getBoundingClientRect();
    if (!rect) return;
    const top = rect.bottom + 8;
    const vw = document.documentElement.clientWidth; // excludes a visible scrollbar, unlike innerWidth
    const width = Math.min(416, vw - 32);
    const left = Math.min(Math.max(16, rect.right - width), vw - 16 - width);
    setPlace({ top, left, width, maxHeight: `calc(100dvh - ${top + 16}px)` });
  };

  const load = () => {
    setRead("checking");
    startTransition(async () => {
      try {
        setRead(await readMyHebyRequestsAction());
      } catch {
        setRead({ status: "unavailable", reason: "read-failed" });
      }
    });
  };

  return (
    <div ref={anchor} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) position();
          if (next) load();
        }}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-xs font-medium text-fg-secondary transition-colors duration-(--dur-fast) hover:border-highlight/50 hover:bg-highlight/5 hover:text-highlight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight"
      >
        <ListChecks className="size-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Your requests</span>
      </button>
      {open ? (
        <div
          role="region"
          aria-label="Your requests"
          data-heby-my-requests=""
          style={place}
          className="fixed z-(--z-dropdown) overflow-y-auto rounded-xl border border-border bg-surface p-3 text-xs leading-5 text-fg-secondary shadow-lg"
        >
          {read === "checking" || read === null ? (
            <p aria-live="polite">Reading your requests…</p>
          ) : read.status === "unavailable" ? (
            <p>{UNREADABLE}</p>
          ) : read.items.length === 0 ? (
            <p>You have not filed any requests in this organization.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {read.items.map((item) => (
                <li key={item.requestId} className="border-b border-border pb-2 last:border-0 last:pb-0">
                  <p className="font-medium text-fg">{item.label}</p>
                  {describeRequestLifecycle(item).map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                  <LifecycleNextStepLink view={item} />
                  {/* HEBY-EXECUTE-AUTHORIZED-1: an authorized act, performed here; the list is re-read after it. */}
                  <HebyExecuteAuthorized view={item} onExecuted={load} />
                </li>
              ))}
            </ol>
          )}
          {read !== null && read !== "checking" && read.status === "read" && read.more ? (
            <p className="mt-2 text-fg-muted">Showing your {read.items.length} most recent requests.</p>
          ) : null}
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              className="rounded text-[0.72rem] text-fg-muted hover:text-fg-secondary disabled:opacity-50"
              disabled={read === "checking"}
              onClick={load}
            >
              Refresh
            </button>
            <Link href="/approvals" className="text-[0.72rem] underline">
              Approvals
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
