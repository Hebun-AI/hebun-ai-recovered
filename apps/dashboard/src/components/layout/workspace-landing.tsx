import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { getWorkspace, type WorkspaceId } from "@/config/workspace-nav";

/*
 * Structural landing surface for a workspace. It establishes WHERE the
 * workspace lives and routes to its Level-2 destinations. It does not
 * fabricate operational data — richer workspace content is a later phase.
 */

export function WorkspaceLanding({
  id,
  children,
}: {
  id: WorkspaceId;
  children?: React.ReactNode;
}) {
  const workspace = getWorkspace(id);
  const destinations = workspace.destinations.filter((d) => d.href !== workspace.href);

  return (
    <>
      <PageHeader
        title={workspace.label}
        context={workspace.tagline}
        action={<Badge variant="info">Workspace</Badge>}
      />

      {children}

      <section aria-label={`${workspace.label} sections`} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {destinations.map((destination) => {
          const Icon = destination.icon;
          const base =
            "flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 transition-colors duration-(--dur-fast)";

          if (destination.unavailable || !destination.href) {
            return (
              <div key={destination.label} className={`${base} opacity-70`}>
                <div className="flex items-center gap-2">
                  <Icon className="size-4 text-fg-muted" />
                  <span className="text-sm font-semibold text-fg">{destination.label}</span>
                  <span className="ml-auto text-[0.6rem] font-semibold uppercase tracking-wider text-fg-muted">Soon</span>
                </div>
                {destination.purpose && <p className="text-xs leading-5 text-fg-muted">{destination.purpose}</p>}
              </div>
            );
          }

          return (
            <Link
              key={destination.label}
              href={destination.href}
              className={`${base} hover:border-border-strong hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring`}
            >
              <div className="flex items-center gap-2">
                <Icon className="size-4 text-primary" />
                <span className="text-sm font-semibold text-fg">{destination.label}</span>
                <span className="ml-auto flex items-center gap-2">
                  {destination.elevated && <Badge variant="warning">Elevated</Badge>}
                  <ArrowUpRight className="size-4 text-fg-muted" />
                </span>
              </div>
              {destination.purpose && <p className="text-xs leading-5 text-fg-secondary">{destination.purpose}</p>}
            </Link>
          );
        })}
      </section>
    </>
  );
}
