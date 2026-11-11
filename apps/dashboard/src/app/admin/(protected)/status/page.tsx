import { requireAdminAccess } from "@/features/operator-authority/require-admin.server";
import { adminReadContext, settleAdminRead } from "@/features/admin-views/admin-view.server";
import {
  readPlatformServiceStatus,
  type ServiceSignal,
} from "@/features/admin-views/platform-readers.server";
import {
  ADMIN_AUDIT_FAILED,
  ADMIN_UNAVAILABLE,
  AdminNotice,
  AdminPageHeader,
  formatDateTime,
} from "@/components/admin-views/admin-parts";
import { cn } from "@/lib/utils";

export const metadata = { title: "Platform Status — Platform Admin" };

/*
 * Only signals checked on this request are shown as responding. A service with no health check is
 * "Not monitored" — never "Healthy" — and a past successful run is not treated as current health.
 */
export default async function AdminStatusPage() {
  await requireAdminAccess();
  const result = settleAdminRead(await readPlatformServiceStatus(await adminReadContext()));

  return (
    <>
      <AdminPageHeader
        title="Platform Status"
        description="Signals checked on this request. Services without a health check are marked as not monitored."
      />
      {result.status !== "read" ? (
        <AdminNotice
          tone={result.status === "audit-failed" ? "warning" : "neutral"}
          message={result.status === "audit-failed" ? ADMIN_AUDIT_FAILED : ADMIN_UNAVAILABLE}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Service name="Database" signal={result.data.database} />
          <Service name="Authentication" signal={result.data.authentication} />
          <Service name="AI Provider Connectivity" signal={result.data.aiProviders} />
          <Service name="Background Jobs" signal={result.data.backgroundJobs} />
        </div>
      )}
    </>
  );
}

function Service({ name, signal }: { name: string; signal: ServiceSignal }) {
  const responding = signal.state === "responding";
  return (
    <section className="min-w-0 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-fg">{name}</h2>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-meta font-medium",
            responding ? "bg-success/15 text-success" : "bg-surface-sunken text-fg-muted",
          )}
        >
          <span className={cn("size-1.5 rounded-full", responding ? "bg-success" : "bg-fg-muted")} aria-hidden />
          {responding ? "Responding" : "Not monitored"}
        </span>
      </div>
      <p className="mt-2 text-sm text-fg-secondary">{signal.detail}</p>
      {signal.state === "responding" ? (
        <p className="mt-1 text-meta text-fg-muted">Checked {formatDateTime(signal.checkedAt)}</p>
      ) : null}
    </section>
  );
}
