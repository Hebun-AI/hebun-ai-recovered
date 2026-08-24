"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { SidebarItem as SidebarItemConfig } from "@/config/sidebar.config";

/*
 * ── THE CONNECTION-STATUS DOT IS GONE ────────────────────────────────────────
 *
 * This file used to hold a `statusDot` map — green for `connected`, amber for `pending`, blue for
 * `syncing`, red for `error` — and render it for any item carrying a `status` badge. The only
 * items that ever carried one were the four Integrations entries, and every value they passed came
 * from a fixture rather than from a connection.
 *
 * The renderer is removed along with the badge variant it drew. A dot in persistent chrome is read
 * as a fact about the organization; this component is a client-rendered navigation item and has no
 * tenant, no request and no authority with which to establish one.
 */
interface SidebarItemProps {
  item: SidebarItemConfig;
  active: boolean;
  muted?: boolean;
}

export function SidebarItem({ item, active, muted }: SidebarItemProps) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "relative flex items-center gap-2.5 rounded-md py-1.5 pr-2 pl-3 text-sm",
        "transition-colors duration-(--dur-fast)",
        active
          ? "bg-primary-subtle font-medium text-fg"
          : cn(
              "text-fg-secondary hover:bg-surface-raised hover:text-fg",
              muted && "text-fg-muted"
            )
      )}
    >
      {active && (
        <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" />
      )}
      {Icon && <Icon className="size-3.5 shrink-0" />}
      <span className="min-w-0 flex-1 truncate">{item.label}</span>

      {item.badge?.type === "count" && item.badge.value > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-error-subtle px-1.5 text-xs font-semibold tabular-nums text-error">
          {item.badge.value}
        </span>
      )}
      {item.badge?.type === "tag" && (
        <span className="rounded-sm bg-surface-raised px-1.5 py-0.5 text-xs text-fg-muted">
          {item.badge.value}
        </span>
      )}
    </Link>
  );
}
