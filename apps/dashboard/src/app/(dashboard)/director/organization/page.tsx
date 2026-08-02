import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { OrganizationOverview } from "@/components/organization-domain/organization-overview";
import { DepartmentsPanel, ReportingAndBusinessUnits } from "@/components/organization-domain/organization-structure";
import { EnterpriseRelationshipsPanel, RolesAndResponsibilities } from "@/components/organization-domain/organization-ownership";
import { getOrganizationProjection } from "@/features/enterprise-projection-providers";

export default function OrganizationDomainPage() {
  const organization = getOrganizationProjection();

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
        <OrganizationOverview items={organization.readiness} />
        <DepartmentsPanel items={organization.departments} />
        <ReportingAndBusinessUnits reporting={organization.reportingRelationships} units={organization.businessUnits} />
        <RolesAndResponsibilities roles={organization.roles} overlaps={organization.responsibilities} />
        <EnterpriseRelationshipsPanel items={organization.relationships} />
      </div>
    </>
  );
}
