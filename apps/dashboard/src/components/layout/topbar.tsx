"use client";

import { Bell, CircleHelp, Search } from "lucide-react";
import { MobileNav } from "./mobile-nav";

export function TopBar() {
  return (
    <header className="sticky top-0 z-(--z-sticky) flex h-(--topbar-h) min-w-0 items-center gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6 lg:px-8">
      <MobileNav />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-fg">Director Workspace</p>
        <p className="hidden truncate text-xs text-fg-muted sm:block">Enterprise overview</p>
      </div>
      <div className="hidden min-w-[15rem] max-w-sm flex-1 items-center gap-2 rounded-lg border border-border bg-surface-sunken px-3 md:flex">
        <Search className="size-4 text-fg-muted" />
        <label htmlFor="global-search" className="sr-only">Global search</label>
        <input id="global-search" type="search" disabled placeholder="Search enterprise…" className="h-9 w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-muted disabled:cursor-not-allowed" />
      </div>
      <button type="button" disabled aria-label="Notifications — coming soon" className="relative flex size-10 items-center justify-center rounded-lg text-fg-secondary transition-colors hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:cursor-not-allowed"><Bell className="size-4" /><span className="absolute right-2 top-2 size-2 rounded-full bg-error"><span className="sr-only">New notifications</span></span></button>
      <button type="button" disabled aria-label="Help — coming soon" className="hidden size-10 items-center justify-center rounded-lg text-fg-secondary transition-colors hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:cursor-not-allowed sm:flex"><CircleHelp className="size-4" /></button>
      <button type="button" disabled aria-label="Director profile — Şenol Sevim" className="flex items-center gap-2 rounded-lg p-1.5 text-left disabled:cursor-not-allowed">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-on-primary">ŞS</span>
        <span className="hidden lg:block"><span className="block text-xs font-semibold text-fg">Şenol Sevim</span><span className="block text-[0.68rem] text-fg-muted">Director</span></span>
      </button>
    </header>
  );
}
