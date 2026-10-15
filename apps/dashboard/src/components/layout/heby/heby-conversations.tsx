"use client";

/*
 * heby-conversations.tsx — HEBY-CONVERSATION-CONTINUITY-1: "where was I?", from Heby's top bar.
 *
 * Closed, it is one button and reads nothing. Opening it runs ONE owner-scoped read of this
 * person's own conversations, newest activity first; "Show older" follows the server's keyset
 * cursor. Selecting one hands its id to the shared conversation seam, which re-checks ownership
 * before a single message is shown. Same placement and states as `heby-my-requests.tsx`.
 *
 * It shows only the owner's own subject (their first question) and a time — no message text, no
 * summary, and nothing Heby inferred. It deletes, renames and shares nothing.
 */
import { useRef, useState, useTransition, type CSSProperties } from "react";
import { MessagesSquare } from "lucide-react";
import { listHebyConversationsAction, type ListConversationsResult } from "@/app/(dashboard)/heby/actions";

type Listed = Extract<ListConversationsResult, { status: "listed" }>;
type Item = Listed["items"][number];

const UNREADABLE = "Hebun could not read your conversations right now. Nothing was changed.";

type ListState =
  | { readonly status: "idle" }
  | { readonly status: "checking" }
  | { readonly status: "unavailable" }
  | { readonly status: "listed"; readonly items: readonly Item[]; readonly nextCursor: string | null; readonly loadingMore: boolean; readonly moreFailed: boolean };

export interface HebyConversationsProps {
  /** The conversation on screen, marked in the list. */
  readonly currentId: string | null;
  /** The seam is busy; switching would race the in-flight request, so it is refused. */
  readonly disabled: boolean;
  readonly onSelect: (conversationId: string) => void;
}

function when(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function HebyConversations(props: HebyConversationsProps) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<ListState>({ status: "idle" });
  const [, startTransition] = useTransition();
  /* `fixed` and clamped to a 16px gutter for the same reason as the requests panel. */
  const anchor = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<CSSProperties>({});
  const position = () => {
    const rect = anchor.current?.getBoundingClientRect();
    if (!rect) return;
    const top = rect.bottom + 8;
    const vw = document.documentElement.clientWidth;
    const width = Math.min(416, vw - 32);
    const left = Math.min(Math.max(16, rect.right - width), vw - 16 - width);
    setPlace({ top, left, width, maxHeight: `calc(100dvh - ${top + 16}px)` });
  };

  const load = () => {
    setList({ status: "checking" });
    startTransition(async () => {
      try {
        const read = await listHebyConversationsAction();
        setList(read.status === "listed" ? { ...read, loadingMore: false, moreFailed: false } : { status: "unavailable" });
      } catch {
        setList({ status: "unavailable" });
      }
    });
  };

  const loadMore = () => {
    if (list.status !== "listed" || !list.nextCursor || list.loadingMore) return;
    const cursor = list.nextCursor;
    setList({ ...list, loadingMore: true, moreFailed: false });
    startTransition(async () => {
      let read: ListConversationsResult | null = null;
      try {
        read = await listHebyConversationsAction({ cursor });
      } catch {
        read = null;
      }
      setList((prev) => {
        if (prev.status !== "listed") return prev;
        if (!read || read.status !== "listed") return { ...prev, loadingMore: false, moreFailed: true };
        const seen = new Set(prev.items.map((item) => item.id));
        return {
          ...prev,
          items: [...prev.items, ...read.items.filter((item) => !seen.has(item.id))],
          nextCursor: read.nextCursor,
          loadingMore: false,
        };
      });
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
        <MessagesSquare className="size-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Your conversations</span>
      </button>
      {open ? (
        <div
          role="region"
          aria-label="Your conversations"
          data-heby-conversations=""
          style={place}
          className="fixed z-(--z-dropdown) overflow-y-auto rounded-xl border border-border bg-surface p-3 text-xs leading-5 text-fg-secondary shadow-lg"
        >
          {list.status === "idle" || list.status === "checking" ? (
            <p aria-live="polite">Reading your conversations…</p>
          ) : list.status === "unavailable" ? (
            <p>{UNREADABLE}</p>
          ) : list.items.length === 0 ? (
            <p>You have no Heby conversations in this organization yet.</p>
          ) : (
            <ol className="flex flex-col gap-1">
              {list.items.map((item) => {
                const current = item.id === props.currentId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-current={current ? "true" : undefined}
                      disabled={props.disabled || current}
                      onClick={() => {
                        props.onSelect(item.id);
                        setOpen(false);
                      }}
                      className="flex w-full flex-col items-start rounded-lg px-2 py-1.5 text-left hover:bg-highlight/5 disabled:cursor-default disabled:opacity-60 aria-[current=true]:bg-highlight/10"
                    >
                      <span className="line-clamp-2 font-medium text-fg">{item.subject ?? "Untitled conversation"}</span>
                      <span className="text-fg-muted">{when(item.lastActivityAt)}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
          {list.status === "listed" && list.moreFailed ? <p className="mt-2">{UNREADABLE}</p> : null}
          {props.disabled && list.status === "listed" && list.items.length > 0 ? (
            <p className="mt-2 text-fg-muted">Heby is busy. You can switch when it finishes.</p>
          ) : null}
          <div className="mt-2 flex items-center gap-3">
            {list.status === "listed" && list.nextCursor ? (
              <button
                type="button"
                className="rounded text-[0.72rem] text-fg-muted hover:text-fg-secondary disabled:opacity-50"
                disabled={list.loadingMore}
                onClick={loadMore}
              >
                {list.loadingMore ? "Reading…" : "Show older"}
              </button>
            ) : null}
            <button
              type="button"
              className="rounded text-[0.72rem] text-fg-muted hover:text-fg-secondary disabled:opacity-50"
              disabled={list.status === "checking"}
              onClick={load}
            >
              Refresh
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
