import { ThemeScope } from "@/components/theme/theme-scope";
import { requireAdminAccess } from "@/features/operator-authority/require-admin.server";

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
  return (
    <ThemeScope experience="admin">
      <div className="min-h-dvh bg-background text-fg">
        <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-4 sm:px-6">
          <span className="text-sm font-semibold">Hebun Platform Admin</span>
          <span className="text-meta text-fg-muted">MFA-verified session</span>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">{children}</main>
      </div>
    </ThemeScope>
  );
}
