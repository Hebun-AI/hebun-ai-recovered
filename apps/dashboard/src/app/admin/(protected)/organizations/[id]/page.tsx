import Link from "next/link";
import { requireAdminAccess } from "@/features/operator-authority/require-admin.server";
import { adminReadContext, settleAdminRead } from "@/features/admin-views/admin-view.server";
import { readPlatformOrganizationMetrics } from "@/features/admin-views/platform-readers.server";
import {
  ADMIN_AUDIT_FAILED,
  ADMIN_UNAVAILABLE,
  AdminNotice,
  AdminPageHeader,
  MetricCard,
  Panel,
  StatusPill,
  formatCount,
  formatDate,
  formatDateTime,
} from "@/components/admin-views/admin-parts";

export const metadata = { title: "Organization — Platform Admin" };

/* The id in the URL selects a row; it grants nothing. Access is the operator grant + MFA alone. */
export default async function AdminOrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminAccess();
  const { id } = await params;
  const result = settleAdminRead(await readPlatformOrganizationMetrics(await adminReadContext(), id));

  const back = (
    <Link href="/admin/organizations" className="mb-4 inline-block text-sm text-primary hover:underline">
      ← Organizations
    </Link>
  );
  if (result.status !== "read") {
    return (
      <>
        {back}
        <AdminNotice
          tone={result.status === "audit-failed" ? "warning" : "neutral"}
          message={result.status === "audit-failed" ? ADMIN_AUDIT_FAILED : ADMIN_UNAVAILABLE}
        />
      </>
    );
  }
  if (!result.data) {
    return (
      <>
        {back}
        <AdminNotice message="No organization has this id." />
      </>
    );
  }
  const { organization: org, aiUsage } = result.data;
  return (
    <>
      {back}
      <AdminPageHeader title={org.name} description="Operational summary. No documents, conversations or content are read." />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Members" value={formatCount(org.memberCount)} note="Active memberships" />
        <MetricCard label="Agents" value={formatCount(org.agentCount)} note="Agents in service" />
        <MetricCard
          label="AI requests"
          value={formatCount(aiUsage.recordedCalls)}
          note="Recorded provider calls, all recorded history"
        />
        <MetricCard
          label="Last recorded AI call"
          value={aiUsage.lastRecordedAt ? formatDate(aiUsage.lastRecordedAt) : "None recorded"}
          muted={!aiUsage.lastRecordedAt}
          note={aiUsage.lastRecordedAt ? formatDateTime(aiUsage.lastRecordedAt) : undefined}
        />
      </div>
      <div className="mt-6">
        <Panel title="Organization record">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 p-4 text-sm sm:grid-cols-2">
            <Fact label="Organization ID"><span className="break-all font-mono">{org.id}</span></Fact>
            <Fact label="Slug"><span className="break-all">{org.slug}</span></Fact>
            <Fact label="Status"><StatusPill status={org.status} /></Fact>
            <Fact label="Status changed">{formatDateTime(org.statusChangedAt)}</Fact>
            <Fact label="Created">{formatDateTime(org.createdAt)}</Fact>
            <Fact label="Tokens (measured calls)">
              {aiUsage.measuredCalls > 0
                ? `${formatCount(aiUsage.inputTokens + aiUsage.outputTokens)} across ${formatCount(aiUsage.measuredCalls)} calls`
                : "No token counts recorded"}
            </Fact>
          </dl>
        </Panel>
      </div>
    </>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-meta text-fg-muted">{label}</dt>
      <dd className="mt-0.5 text-fg">{children}</dd>
    </div>
  );
}
