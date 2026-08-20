"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Building2, ClipboardCheck, Search } from "lucide-react";
import { getWorkspace, resolveActiveWorkspace } from "@/config/workspace-nav";
import { MobileNav } from "./mobile-nav";
import { TabletSections } from "./tablet-sections";
import { SecondaryToggle } from "./secondary-toggle";
import { HebyLauncher } from "./heby/heby-launcher";
import { HebyFocusControl, useHebyFocus } from "./heby/heby-focus-mode";

/*
 * Global chrome (Level-1). Kept deliberately lean:
 *   left    — mobile menu / tablet sections trigger / active workspace title
 *   centre  — global search (stubbed, disabled — becomes a real index later)
 *   right   — approvals attention · notifications · org selector · Heby · account
 * Internal architecture concepts never appear here.
 */

export function TopBar() {
  const pathname = usePathname();
  const workspace = getWorkspace(resolveActiveWorkspace(pathname));
  /*
   * On Heby's own surface the focus control governs the shell's navigation, so the generic
   * secondary toggle stands aside: exactly ONE control is presented at a time, and the operator's
   * persisted preference is left untouched for as long as they are here.
   *
   * STANDS ASIDE, NOT UNMOUNTED — and that distinction was found in the real product, not reasoned
   * about. The generic toggle is what APPLIES the stored preference to the document on mount, so
   * unmounting it on Heby meant that restoring the navigation there showed an expanded column to an
   * operator whose saved preference was collapsed. The stored value was never touched; it simply
   * was not being applied. It stays mounted on every route and is hidden while Heby owns the
   * decision.
   */
  const { eligible: hebyFocusEligible } = useHebyFocus();

  return (
    <header
      /*
       * The stylesheet's handle on the global chrome. Focused mode uses it to let the top bar
       * RECEDE into Heby's field — it never removes it, never changes its height, and never takes
       * a control out of it.
       */
      data-shell="topbar"
      className="sticky top-0 z-(--z-sticky) flex h-(--topbar-h) min-w-0 items-center gap-3 border-b border-border bg-surface px-4 sm:px-6"
    >
      <MobileNav />
      <TabletSections />
      <span className={hebyFocusEligible ? "hidden" : "contents"}>
        <SecondaryToggle />
      </span>
      <HebyFocusControl />

      <div className="min-w-0 flex-1 lg:flex-none lg:w-52">
        <p className="truncate text-sm font-semibold text-fg">{workspace.label}</p>
        <p className="hidden truncate text-xs text-fg-muted sm:block">{workspace.tagline}</p>
      </div>

      <div className="ml-auto hidden min-w-0 max-w-sm flex-1 items-center gap-2 rounded-lg border border-border bg-surface-sunken px-3 lg:flex">
        <Search className="size-4 text-fg-muted" />
        <label htmlFor="global-search" className="sr-only">Global search</label>
        <input
          id="global-search"
          type="search"
          disabled
          placeholder="Search…"
          className="h-9 w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-muted disabled:cursor-not-allowed"
        />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5 lg:ml-0">
        <Link
          href="/approvals"
          aria-label="Approvals — pending attention"
          className="relative flex size-10 items-center justify-center rounded-lg text-fg-secondary transition-colors duration-(--dur-fast) hover:bg-surface-sunken hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
        >
          <ClipboardCheck className="size-4" />
        </Link>

        <button
          type="button"
          disabled
          aria-label="Notifications — coming soon"
          className="relative flex size-10 items-center justify-center rounded-lg text-fg-secondary transition-colors hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:cursor-not-allowed"
        >
          <Bell className="size-4" />
        </button>

        <button
          type="button"
          disabled
          aria-label="Organization — single tenant"
          className="hidden shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-border bg-surface px-2.5 py-2 text-xs font-medium text-fg-secondary disabled:cursor-not-allowed xl:flex"
        >
          <Building2 className="size-4" />
          <span>Hebun</span>
        </button>

        <HebyLauncher variant="topbar" />

        <button
          type="button"
          disabled
          aria-label="Şenol Sevim — Director"
          className="flex shrink-0 items-center gap-2 rounded-lg p-1.5 text-left disabled:cursor-not-allowed"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-on-primary">ŞS</span>
          <span className="hidden whitespace-nowrap xl:block">
            <span className="block text-xs font-semibold text-fg">Şenol Sevim</span>
            <span className="block text-[0.68rem] text-fg-muted">Director</span>
          </span>
        </button>
      </div>
    </header>
  );
}
