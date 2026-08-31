import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { OrganizationOverview } from "@/components/organization-domain/organization-overview";
import { DepartmentsPanel, ReportingAndBusinessUnits } from "@/components/organization-domain/organization-structure";
import { EnterpriseRelationshipsPanel, RolesAndResponsibilities } from "@/components/organization-domain/organization-ownership";
import { AuthoritativeOrganizationPanel } from "@/components/organization-domain/authoritative-organization";
import { DepartmentStructurePanel } from "@/components/organization-domain/department-structure";
import { getOrganizationProjection } from "@/features/enterprise-projection-providers";
import { readOrganizationAuthority } from "@/features/organization-authority/read-organization.server";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";

/*
 * L3 — THIS PAGE NOW HAS TWO SECTIONS AND THEY ARE NOT THE SAME KIND OF THING.
 *
 * The first is the Organization Authority: durable rows, tenant-resolved server-side, unavailable
 * when it cannot answer. The rest is the released mock projection this page has always rendered,
 * disclosed since L1 and left exactly as it was — L3 neither promotes it to truth nor removes it.
 *
 * THE TENANT IS RESOLVED HERE, ON THE SERVER. `resolveTenantContext()` takes no argument, so there
 * is no parameter through which this page could name a different organization, and the read seam it
 * calls has no organization parameter either. This page adds no read of its own and no authority.
 */

export default async function OrganizationDomainPage() {
  const organization = await getOrganizationProjection();
  const authoritative = await readOrganizationAuthority(await resolveTenantContext());

  return (
    <>
      <PageHeader
        title="Organization Domain"
        context="The enterprise digital twin — structure, ownership, responsibility, and relationships understood as one organization."
        action={
          <><Badge variant="primary">Domain foundation</Badge><Badge variant="success">Mock projection</Badge></>
        }
      />
      <div className="space-y-6">
        <AuthoritativeOrganizationPanel read={authoritative} />
        {/*
          * OSA-1. The structural authority's own surface, ABOVE the disclosure line, because every
          * row it renders is durable. It is deliberately adjacent to `AuthoritativeOrganizationPanel`
          * and deliberately far from `DepartmentsPanel` below, which is the released mock: a reader
          * must never be choosing between two controls that both look like "create a department".
          */}
        {authoritative.status === "available" ? (
          <DepartmentStructurePanel structure={authoritative.organization.structure} />
        ) : null}
        <p className="text-xs leading-5 text-fg-secondary">
          Everything below this line is an illustrative mock projection. It is not connected to any
          live system and Hebun does not vouch for it.
        </p>
        <OrganizationOverview items={organization.readiness} />
        <DepartmentsPanel items={organization.departments} />
        <ReportingAndBusinessUnits reporting={organization.reportingRelationships} units={organization.businessUnits} />
        <RolesAndResponsibilities roles={organization.roles} overlaps={organization.responsibilities} />
        <EnterpriseRelationshipsPanel items={organization.relationships} />
      </div>
    </>
  );
}
