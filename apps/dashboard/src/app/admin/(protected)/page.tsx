import { requireAdminAccess } from "@/features/operator-authority/require-admin.server";

export const metadata = { title: "Platform Admin — Hebun AI" };

/*
 * The access-verified landing. It reads no platform data: the cross-tenant admin views (operator
 * principal D4) are the next P4 package, each behind its own `requireAdminAccess()` call.
 */
export default async function AdminHomePage() {
  await requireAdminAccess();
  return (
    <section className="rounded-2xl border border-border bg-surface p-6">
      <h1 className="text-title font-semibold text-fg">Platform Admin</h1>
      <p className="mt-2 text-sm text-fg-secondary">
        Access verified: active operator grant and MFA on this session.
      </p>
      <p className="mt-1 text-sm text-fg-muted">No platform views are available yet.</p>
    </section>
  );
}
