import Link from "next/link";
import { requireAdminAccess } from "@/features/operator-authority/require-admin.server";
import { adminReadContext, settleAdminRead } from "@/features/admin-views/admin-view.server";
import { listPlatformOrganizations, parsePage } from "@/features/admin-views/platform-readers.server";
import {
  ADMIN_AUDIT_FAILED,
  ADMIN_UNAVAILABLE,
  AdminNotice,
  AdminPageHeader,
  DataTable,
  Panel,
  StatusPill,
  formatCount,
  formatDate,
} from "@/components/admin-views/admin-parts";

export const metadata = { title: "Organizations — Platform Admin" };

export default async function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  await requireAdminAccess();
  const page = parsePage((await searchParams).page);
  const result = settleAdminRead(await listPlatformOrganizations(await adminReadContext(), page));

  return (
    <>
      <AdminPageHeader
        title="Organizations"
        description="Every organization on the platform. Counts only — no tenant content is read."
      />
      {result.status !== "read" ? (
        <AdminNotice
          tone={result.status === "audit-failed" ? "warning" : "neutral"}
          message={result.status === "audit-failed" ? ADMIN_AUDIT_FAILED : ADMIN_UNAVAILABLE}
        />
      ) : result.data.total === 0 ? (
        <AdminNotice message="No organization exists yet." />
      ) : (
        <Panel
          title={`${formatCount(result.data.total)} organizations`}
          description="Members: active memberships. Agents: agents in service."
        >
          {result.data.rows.length === 0 ? (
            <p className="p-4 text-sm text-fg-secondary">This page is past the end of the list.</p>
          ) : (
            <DataTable head={["Organization", "Status", "Created", "Members", "Agents"]}>
              {result.data.rows.map((org) => (
                <tr key={org.id}>
                  <td className="max-w-[16rem] px-4 py-2.5">
                    <Link href={`/admin/organizations/${org.id}`} className="block truncate font-medium text-fg hover:text-primary">
                      {org.name}
                    </Link>
                    <span className="block truncate font-mono text-meta text-fg-muted">{org.id}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right"><StatusPill status={org.status} /></td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-fg-secondary">{formatDate(org.createdAt)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCount(org.memberCount)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCount(org.agentCount)}</td>
                </tr>
              ))}
            </DataTable>
          )}
          <Pagination page={result.data.page} pageSize={result.data.pageSize} total={result.data.total} />
        </Panel>
      )}
    </>
  );
}

function Pagination({ page, pageSize, total }: { page: number; pageSize: number; total: number }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const link = "rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-sunken";
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-meta text-fg-muted">
      <span>Page {formatCount(page)} of {formatCount(pages)}</span>
      <div className="flex gap-2">
        {page > 1 ? <Link className={link} href={`/admin/organizations?page=${Math.min(page - 1, pages)}`}>Previous</Link> : null}
        {page < pages ? <Link className={link} href={`/admin/organizations?page=${page + 1}`}>Next</Link> : null}
      </div>
    </div>
  );
}
