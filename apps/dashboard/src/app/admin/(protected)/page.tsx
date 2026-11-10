import Link from "next/link";
import { requireAdminAccess } from "@/features/operator-authority/require-admin.server";
import { adminReadContext, settleAdminRead } from "@/features/admin-views/admin-view.server";
import { readPlatformOverview } from "@/features/admin-views/platform-readers.server";
import {
  ADMIN_AUDIT_FAILED,
  ADMIN_UNAVAILABLE,
  AdminNotice,
  AdminPageHeader,
  MetricCard,
  formatCount,
  formatDate,
} from "@/components/admin-views/admin-parts";

export const metadata = { title: "Platform Admin — Hebun AI" };

export default async function AdminOverviewPage() {
  await requireAdminAccess();
  const overview = settleAdminRead(await readPlatformOverview(await adminReadContext()));

  return (
    <>
      <AdminPageHeader
        title="Platform Overview"
        description="Monitor organizations, AI activity and platform operations."
      />
      {overview.status === "read" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Total Organizations" value={formatCount(overview.data.totalOrganizations)} />
          <MetricCard
            label="Active Organizations"
            value={formatCount(overview.data.activeOrganizations)}
            note="Recorded tenant status: active"
          />
          <MetricCard
            label="AI Usage"
            value={`${formatCount(overview.data.aiUsage.recordedCalls)} calls`}
            note={
              overview.data.aiUsage.firstRecordedAt
                ? `Recorded provider calls, ${formatDate(overview.data.aiUsage.firstRecordedAt)} – ${formatDate(overview.data.aiUsage.lastRecordedAt)}`
                : "No provider call recorded yet"
            }
          />
          <MetricCard
            label="Platform Health"
            value="Not monitored"
            muted
            note="No platform health check exists."
          />
        </div>
      ) : (
        <AdminNotice
          tone={overview.status === "audit-failed" ? "warning" : "neutral"}
          message={overview.status === "audit-failed" ? ADMIN_AUDIT_FAILED : ADMIN_UNAVAILABLE}
        />
      )}
      <p className="mt-6 text-sm text-fg-secondary">
        Details: <Link className="text-primary hover:underline" href="/admin/organizations">organizations</Link>,{" "}
        <Link className="text-primary hover:underline" href="/admin/usage">AI usage</Link>,{" "}
        <Link className="text-primary hover:underline" href="/admin/status">platform status</Link>.
      </p>
    </>
  );
}
