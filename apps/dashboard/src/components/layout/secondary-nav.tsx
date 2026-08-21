"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  destinationsForRole,
  getWorkspace,
  resolveActiveWorkspace,
  resolveShellSurface,
  type NavDestination,
  type Workspace,
} from "@/config/workspace-nav";
import { useRole } from "./role-context";
import type { UiRole } from "@/config/workspace-nav";

/*
 * The active destination is the one whose href most specifically matches the pathname —
 * longest matching prefix wins. This prevents a workspace-landing destination (e.g. Overview,
 * href "/command") from co-highlighting on every sub-route ("/command/inbox"), where a more
 * specific destination ("/command/inbox") is the real active one.
 *
 * ── THE LANDING MATCHES EXACTLY, AND ONLY EXACTLY (CMD-B2) ───────────────────────────────────
 *
 * The rule above worked while every sub-route was ALSO a destination: something more specific
 * always outranked the landing. CMD-B2 removed five Command destinations while keeping their
 * routes, and the guard's premise went with them — measured on the real component, `/command/inbox`
 * and `/command/briefings` both lit up **Overview**, because a legacy route is still a sub-path of
 * `/command`. That is a false statement about where the operator is: they are not on the Overview.
 *
 * So the landing is matched by EQUALITY. A workspace landing is one page, not a namespace, and it
 * is the only destination whose href is a prefix of unrelated routes. Every other destination keeps
 * prefix matching, which is what makes `/approvals/<id>` still highlight Decisions.
 *
 * The honest outcome on a route that is no longer canonical is NO highlight at all — the workspace
 * still owns it (the rail and the header say Command), and none of the three canonical destinations
 * pretends to be the page you are on.
 */
function activeDestinationHref(
  destinations: readonly NavDestination[],
  pathname: string,
  landingHref: string,
): string | undefined {
  let best: string | undefined;
  for (const destination of destinations) {
    const href = destination.href;
    if (!href) continue;
    const matches = href === landingHref ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
    if (matches) {
      if (best === undefined || href.length > best.length) best = href;
    }
  }
  return best;
}

/** The inner Level-2 list — reused by the desktop column, tablet drawer, and mobile sheet. */
export function SecondaryNavContent({
  workspace,
  role,
  pathname,
  onNavigate,
}: {
  workspace: Workspace;
  role: UiRole;
  pathname: string;
  onNavigate?: () => void;
}) {
  const destinations = destinationsForRole(workspace, role);
  const activeHref = activeDestinationHref(destinations, pathname, workspace.href);

  /*
   * ── THIS COLUMN NAMES THE SURFACE, AND SEPARATELY NAMES WHOSE SECTIONS IT LISTS ────────────
   *
   * VI-1 stopped the top bar, the rail and the mobile mark from calling `/heby` "Command". It did
   * not reach here, and this header is an identity block: it renders a name and a description at
   * the top of the column, which reads as "where you are". On `/heby` it read "Command / Executive
   * operating surface — situational overview and the human decision.", and the tablet trigger read
   * "Command" — measured in the product at 768px, where focused mode does not exist and the trigger
   * is therefore unconditionally visible.
   *
   * The list below is NOT wrong: an ambient surface still needs a way out, and Command's sections
   * are that way out. So the two facts are stated as two facts. `workspace` stays the navigation
   * fallback it always was; the heading comes from the resolver that may answer "none of the seven".
   *
   * Derived here rather than in each of the three consumers — this component is the one owner of
   * the Level-2 list, and the desktop column, the tablet drawer and the mobile sheet all render it.
   */
  const surface = resolveShellSurface(pathname);
  const heading =
    surface.workspace === null
      ? { label: surface.label, detail: `Sections of ${workspace.label}` }
      : { label: workspace.label, detail: workspace.tagline };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-4 pb-2 pt-4">
        <p className="text-sm font-semibold text-fg">{heading.label}</p>
        {/* Never truncated, and never has been: at 224px this is where the full sentence lives. */}
        <p className="mt-0.5 text-xs leading-5 text-fg-muted">{heading.detail}</p>
      </div>
      <nav aria-label={`${workspace.label} sections`} className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-4">
        {destinations.map((destination) => {
          const Icon = destination.icon;
          if (destination.unavailable || !destination.href) {
            return (
              <span
                key={destination.label}
                role="link"
                aria-disabled="true"
                className="flex min-h-10 cursor-not-allowed items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-fg-muted"
              >
                <Icon className="size-4 shrink-0" />
                <span className="min-w-0">{destination.label}</span>
                <span className="ml-auto text-xs font-semibold uppercase tracking-wider">Soon</span>
              </span>
            );
          }
          const active = destination.href !== undefined && destination.href === activeHref;
          return (
            <Link
              key={destination.label}
              href={destination.href}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={cn(
                "flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors duration-(--dur-fast) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring",
                active
                  ? "bg-primary-subtle text-primary"
                  : "text-fg-secondary hover:bg-surface-raised hover:text-fg",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {/*
                VI-2 — a canonical navigation name may wrap; it may not be shortened. Two of the
                thirty Level-2 labels exceed the 150px this item gives them ("Infrastructure &
                Settings" 163.4px, "Signals & Assessments" 152.4px) and both were `truncate`d in
                the released shell. Wrapping costs NOTHING here: `text-sm` at `leading-5` is 20px a
                line, so two lines are exactly the 40px `min-h-10` this row already reserves, and
                the item height does not change. The remaining twenty-eight are unaffected.
              */}
              <span className="min-w-0">{destination.label}</span>
              {destination.elevated && (
                <Lock className="ml-auto size-3.5 shrink-0 text-fg-muted" aria-label="Requires elevated authority" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/** Fixed Level-2 column, persistent on desktop (lg+). */
export function SecondaryNav() {
  const pathname = usePathname();
  const role = useRole();
  const workspace = getWorkspace(resolveActiveWorkspace(pathname));

  return (
    <aside
      data-shell="secondary"
      aria-label="Workspace navigation"
      className="fixed inset-y-0 left-(--rail-w) z-(--z-sticky) hidden w-(--secondary-w) flex-col border-r border-border/70 bg-surface lg:flex"
    >
      <SecondaryNavContent workspace={workspace} role={role} pathname={pathname} />
    </aside>
  );
}
