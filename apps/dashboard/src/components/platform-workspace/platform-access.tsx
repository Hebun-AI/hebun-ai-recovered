import Link from "next/link";
import { ArrowUpRight, Lock } from "lucide-react";
import { PlatformRegion, PlatformEmptyState } from "./platform-region";

/*
 * Authentication & Access (Phase 13 §27) — technical access state, honestly.
 *
 * The authentication dependency's health is shown in System Dependencies. This
 * region owns the administration boundary: no user, role, or permission record is
 * surfaced or fabricated, and no secret or credential is ever shown. Visibility is
 * not authorization — access is enforced server-side by tenant and role. Phase 13
 * introduces no permission mutation; it routes to the existing surfaces.
 */

export function PlatformAccess() {
  return (
    <PlatformRegion variant="plain" eyebrow="Who can administer the platform" title="Authentication & Access">
      <div className="flex flex-col gap-3">
        <PlatformEmptyState
          title="No access or permission records surfaced"
          detail="User, role, and permission records are not surfaced here, and none is fabricated. No secret, key, password, or token is ever shown."
          tone="blocked"
          compact
        />
        <p className="flex items-start gap-1.5 text-[0.7rem] leading-5 text-fg-muted">
          <Lock className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
          Visibility is not authorization. Access is enforced server-side by tenant and role; this workspace
          changes no permission.
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link
            href="/settings"
            className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
          >
            Platform settings
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
          <Link
            href="/director/governance/permissions"
            className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
          >
            Permissions
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </PlatformRegion>
  );
}
