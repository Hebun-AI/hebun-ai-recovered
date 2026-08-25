"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Building2, ClipboardCheck, Search } from "lucide-react";
import { resolveShellSurface } from "@/config/workspace-nav";
import { MobileNav } from "./mobile-nav";
import { HebyLauncher } from "./heby/heby-launcher";
import { HebyFocusControl } from "./heby/heby-focus-mode";

/*
 * Global chrome (Level-1). Kept deliberately lean:
 *   left    — mobile menu / tablet sections trigger / active workspace title
 *   centre  — global search (stubbed, disabled — becomes a real index later)
 *   right   — approvals attention · notifications · org selector · Heby · account
 * Internal architecture concepts never appear here.
 */

export function TopBar() {
  const pathname = usePathname();
  /*
   * The identity chrome names the surface the operator is ON, so it asks the question that can be
   * answered `null`. It used to ask `resolveActiveWorkspace`, whose type cannot say "none of the
   * seven" and therefore answered "Command" — on `/heby`, a released and deliberately protected
   * surface, under Command's own tagline. Heby is still not a workspace and gains none here; the
   * shell simply stops claiming it is one.
   */
  const surface = resolveShellSurface(pathname);
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
      <HebyFocusControl />

      {/*
        ── THE TOP BAR NAMES THE SURFACE; IT DOES NOT DESCRIBE IT ─────────────
        VI-2. This slot used to carry the surface tagline too, in a 208px column, `truncate`d.
        Measured in the authenticated product: it was cut on FIVE of seven surfaces at ≥1024px
        (Command 425px of 208, Heby 470, Intelligence 266, Platform 242, Governance 224) and on
        three of seven at 768px. A description severed mid-clause is not a shorter description.

        Widening it is not available: at 1440px there are 23px between this slot and the search
        field, and 12px at 1024px. Only 1920px has slack, so growing the column would fix the one
        width that was least broken. Wrapping is not available either — Command's sentence needs
        three lines at 208px, which is 83px inside a 64px bar.

        So the duplicate goes. `SecondaryNavContent` retains the complete sentence where the mobile
        sheet has room for workspace context; the compact inline desktop list needs only destinations.

        The title stays, at every width, and is never truncated: the widest of the eight surface
        names is "Governance" at 83.1px in a slot that is 208px at ≥1024, 245–269px at 768, and
        110px at 390.
      */}
      <div className="min-w-0 flex-1 lg:flex-none lg:w-52">
        <p className="truncate text-sm font-semibold text-fg">{surface.label}</p>
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
            {/* VI-2: 10.88px → the 12px floor. It names the operator's role; it is not decoration. */}
            <span className="block text-xs text-fg-muted">Director</span>
          </span>
        </button>
      </div>
    </header>
  );
}
