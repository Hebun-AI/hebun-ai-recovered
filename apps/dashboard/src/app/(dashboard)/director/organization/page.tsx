import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { OrganizationOverview } from "@/components/organization-domain/organization-overview";
import { DepartmentsPanel, ReportingAndBusinessUnits } from "@/components/organization-domain/organization-structure";
import { EnterpriseRelationshipsPanel, RolesAndResponsibilities } from "@/components/organization-domain/organization-ownership";
import { businessUnits, enterpriseRelationships, organizationDepartments, organizationMetrics, organizationRoles, reportingStructure, responsibilityOverlaps } from "@/features/organization-domain/mock";

export default function OrganizationDomainPage() {
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
        <OrganizationOverview items={organizationMetrics} />
        <DepartmentsPanel items={organizationDepartments} />
        <ReportingAndBusinessUnits reporting={reportingStructure} units={businessUnits} />
        <RolesAndResponsibilities roles={organizationRoles} overlaps={responsibilityOverlaps} />
        <EnterpriseRelationshipsPanel items={enterpriseRelationships} />
      </div>
    </>
  );
}
