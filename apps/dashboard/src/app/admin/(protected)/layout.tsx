import { ShieldCheck } from "lucide-react";
import { ThemeScope } from "@/components/theme/theme-scope";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { AdminNav } from "@/components/admin-views/admin-nav";
import { requireAdminAccess } from "@/features/operator-authority/require-admin.server";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { readOwnNameFields } from "@/features/auth-runtime/human-label-read.server";

export const dynamic = "force-dynamic";

/*
 * Platform Admin (P4) — separate from the customer and Director shells (D6).
 *
 * The guard runs here, on the server, before anything renders: an active operator grant AND a
 * server-verified MFA on this session, re-read from the database on every request. Every admin page
 * and every admin data read calls `requireAdminAccess()` again — this layout is not the only gate.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminAccess();
  /* The operator's own name, through the one Identity seam that projects name columns. */
  const own = await readOwnNameFields(await resolveTenantContext());
  const label = own?.displayName || own?.name || null;
  return (
    <ThemeScope experience="admin">
      <div className="min-h-dvh bg-background text-fg">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b border-border bg-surface px-4 sm:px-6">
          <span className="truncate text-sm font-semibold">Hebun Platform Admin</span>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <span className="hidden min-w-0 truncate text-meta text-fg-secondary sm:inline" title="Current operator">
              {label ?? "Operator"}
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-meta font-medium text-success">
              <ShieldCheck className="size-3.5" aria-hidden />
              MFA verified
            </span>
            <ThemeToggle />
          </div>
        </header>
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:gap-8">
          <aside className="min-w-0 lg:w-52 lg:shrink-0">
            <AdminNav />
            <p className="mt-4 hidden text-meta text-fg-muted lg:block">Read-only. Every view is audited.</p>
          </aside>
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </ThemeScope>
  );
}
