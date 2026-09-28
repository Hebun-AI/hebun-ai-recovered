"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/login/actions";

/**
 * Who is signed in, as the authenticated layout resolved it on the server. Never hardcoded, never
 * read from the client: `name` is the Identity label (`display_name → name → email`) and `role` is
 * the role of the membership this session is in. Either may be null when the source has none.
 */
export interface ShellAccount {
  readonly name: string | null;
  readonly role: string | null;
}

function initialsOf(name: string | null): string {
  if (!name) return "";
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((w) => w[0]!.toLocaleUpperCase())
    .join("");
}

/*
 * ── THE ACCOUNT MENU ─────────────────────────────────────────────────────────
 *
 * The top-right identity control on every authenticated page. It opens a small menu whose only
 * action is Sign out, and Sign out is the EXISTING session authority — `logoutAction` in
 * `app/login/actions.ts`, the same server action `/foundation` already renders. It revokes the
 * durable session row, clears the cookie and redirects to `/login`. Nothing here touches a cookie.
 *
 * Keyboard: Enter / Space / ArrowDown on the trigger opens the menu and focuses Sign out; Escape
 * closes it and returns focus to the trigger; Tab or a click outside closes it.
 *
 * With no resolved account (auth not configured — the pre-auth build) the control stays a
 * disabled, anonymous placeholder: there is no session to end and no name to show.
 */
export function AccountMenu({ account }: { account: ShellAccount | null }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    itemRef.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const initials = initialsOf(account?.name ?? null);
  const label = [account?.name, account?.role].filter(Boolean).join(" — ") || "Account";

  const avatar = (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-on-primary"
    >
      {initials}
    </span>
  );

  if (!account) {
    return (
      <button
        type="button"
        disabled
        aria-label="Account — not signed in"
        className="flex shrink-0 items-center gap-2 rounded-lg p-1.5 text-left disabled:cursor-not-allowed"
      >
        {avatar}
      </button>
    );
  }

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${label} — account menu`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          } else if (event.key === "Escape" && open) {
            event.preventDefault();
            close(true);
          }
        }}
        className="flex items-center gap-2 rounded-lg p-1.5 text-left transition-colors duration-(--dur-fast) hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
      >
        {avatar}
        <span className="hidden whitespace-nowrap xl:block">
          {account.name ? <span className="block text-xs font-semibold text-fg">{account.name}</span> : null}
          {/* VI-2: 10.88px → the 12px floor. It names the operator's role; it is not decoration. */}
          {account.role ? <span className="block text-xs text-fg-muted">{account.role}</span> : null}
        </span>
      </button>

      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Account"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close(true);
            } else if (event.key === "Tab") {
              setOpen(false);
            }
          }}
          className="absolute right-0 top-full z-(--z-dropdown) mt-1 w-56 rounded-lg border border-border bg-surface p-1 shadow-lg"
        >
          <div role="none" className="px-2.5 py-2">
            {account.name ? <p className="truncate text-sm font-semibold text-fg">{account.name}</p> : null}
            {account.role ? <p className="truncate text-xs text-fg-muted">{account.role}</p> : null}
          </div>
          <div role="separator" className="my-1 h-px bg-border" />
          <form action={logoutAction} role="none">
            <button
              ref={itemRef}
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-fg transition-colors duration-(--dur-fast) hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary-ring"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
