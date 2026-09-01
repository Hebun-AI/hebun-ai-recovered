import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { OrganizationOverview } from "@/components/organization-domain/organization-overview";
import { DepartmentsPanel, ReportingAndBusinessUnits } from "@/components/organization-domain/organization-structure";
import { EnterpriseRelationshipsPanel, RolesAndResponsibilities } from "@/components/organization-domain/organization-ownership";
import { AuthoritativeOrganizationPanel } from "@/components/organization-domain/authoritative-organization";
import { DepartmentStructurePanel } from "@/components/organization-domain/department-structure";
import { DepartmentalPlacementPanel } from "@/components/organization-domain/departmental-placement";
import { PeopleRegisterPanel } from "@/components/organization-domain/people-register";
import { getOrganizationProjection } from "@/features/enterprise-projection-providers";
import { readOrganizationAuthority } from "@/features/organization-authority/read-organization.server";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import {
  readSelectableMembers,
  resolveHumanLabels,
  type HumanLabel,
  type SelectableMembersRead,
} from "@/features/auth-runtime/human-label-read.server";
import {
  readPlacementRegister,
  type PlacementRegister,
} from "@/features/organization-authority/read-placement.server";
import {
  readPeopleRegister,
  type PeopleRegister,
} from "@/features/auth-runtime/people-register-read.server";

/*
 * L3 — THIS PAGE NOW HAS TWO SECTIONS AND THEY ARE NOT THE SAME KIND OF THING.
 *
 * The first is the Organization Authority: durable rows, tenant-resolved server-side, unavailable
 * when it cannot answer. The rest is the released mock projection this page has always rendered,
 * disclosed since L1 and left exactly as it was — L3 neither promotes it to truth nor removes it.
 *
 * THE TENANT IS RESOLVED HERE, ON THE SERVER. `resolveTenantContext()` takes no argument, so there
 * is no parameter through which this page could name a different organization, and the read seams it
 * calls have no organization parameter either. This page adds no authority.
 *
 * ── HUMAN LEGIBILITY REACH — TWO READS, COMPOSED, NEVER MERGED ───────────────
 *
 * The structure and the people who may be named in it come from DIFFERENT authorities and are read
 * separately here rather than joined inside either one. OSA stays authoritative for the department
 * and for the owner IDENTIFIER; Identity stays authoritative for what that identifier is called.
 * Nothing merges them into a record: `DepartmentView` gains no label field, no label is persisted,
 * and this page hands the surface two independent answers to hold side by side.
 *
 * The two legibility reads have deliberately different predicates and both are the projection's own
 * business, not this page's: the picker offers ACTIVE members, while the label resolution answers
 * for ids the structure already names even when that person has since left. Both are gated on this
 * organization's existing Governance authority and both fail closed to "unavailable" — which the
 * surface renders as the identifier, never as an invented name.
 */

export default async function OrganizationDomainPage() {
  const tenant = await resolveTenantContext();
  const organization = await getOrganizationProjection();
  const authoritative = await readOrganizationAuthority(tenant);

  /*
   * Only asked when there is a structure to be legible ABOUT. An unavailable structure renders no
   * ownership control and names no owner, so neither read would have a consumer.
   */
  let members: SelectableMembersRead = { status: "unavailable", reason: "authority-unavailable" };
  let ownerLabels: readonly HumanLabel[] = [];
  let placements: PlacementRegister = { status: "unavailable", detail: "" };
  let placedNames: readonly HumanLabel[] = [];
  if (authoritative.status === "available" && authoritative.organization.structure.status === "available") {
    members = await readSelectableMembers(tenant);
    const ownerIds = authoritative.organization.structure.departments
      .map((department) => department.owner?.actorId)
      .filter((id): id is string => Boolean(id));
    const resolved = await resolveHumanLabels(tenant, ownerIds);
    ownerLabels = [...resolved].map(([userId, label]) => ({ userId, label }));

    /*
     * ── AND WHO WORKS WHERE ───────────────────────────────────────────────────
     *
     * A THIRD independent read, composed here and never joined inside any of the others. The
     * placement authority stays authoritative for the placement and for the human IDENTIFIER;
     * Identity stays authoritative for what that identifier is called. `PlacementView` gains no
     * label field and no name is persisted anywhere.
     *
     * The names are resolved with the SAME released product read the owner labels use, deliberately:
     * this is a server-rendered surface for the organization's own authorized human, where an
     * address is a true and useful answer. The PROVIDER-SAFE read is what the Heby projection uses,
     * because that value leaves the process.
     *
     *     UI LEGIBILITY != MODEL PROVIDER DISCLOSURE
     */
    placements = await readPlacementRegister(tenant);
    if (placements.status === "available" && placements.placements.length > 0) {
      const placedIds = placements.placements.map((placement) => placement.userId);
      const placedResolved = await resolveHumanLabels(tenant, placedIds);
      placedNames = [...placedResolved].map(([userId, label]) => ({ userId, label }));
    }
  }

  /*
   * ── AND WHO IS IN THIS ORGANIZATION AT ALL ───────────────────────────────────
   *
   * A FOURTH independent read, and deliberately OUTSIDE the structure branch above: who belongs to
   * this organization does not depend on whether it has recorded any departments, and gating it on
   * the structure would make an organization with no departments look like an organization with no
   * people. The register carries its own unavailable state and the panel renders it.
   *
   * Its names use the SAME released product read the owner and placement labels use — this is a
   * server-rendered surface for the organization's own authorized human, where an address is a true
   * and useful answer. The PROVIDER-SAFE read is what the Heby projection uses, because that value
   * leaves the process.
   *
   *     UI LEGIBILITY != MODEL PROVIDER DISCLOSURE
   */
  const people: PeopleRegister = await readPeopleRegister(tenant);
  let peopleNames: readonly HumanLabel[] = [];
  if (people.status === "available" && people.people.length > 0) {
    const peopleIds = people.people.map((person) => person.userId);
    const peopleResolved = await resolveHumanLabels(tenant, peopleIds);
    peopleNames = [...peopleResolved].map(([userId, label]) => ({ userId, label }));
  }

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
          <DepartmentStructurePanel
            structure={authoritative.organization.structure}
            members={members}
            ownerLabels={ownerLabels}
          />
        ) : null}
        {/*
          * WHO WORKS WHERE. Directly beneath the structure it refers to, and still ABOVE the
          * disclosure line, because every row it renders is durable.
          */}
        {authoritative.status === "available" ? (
          <DepartmentalPlacementPanel
            register={placements}
            structure={authoritative.organization.structure}
            members={members}
            placedNames={placedNames}
          />
        ) : null}
        {/*
          * WHO IS IN THIS ORGANIZATION. Beneath the placements it is composed with, and still ABOVE
          * the disclosure line, because every row it renders is durable. Rendered unconditionally:
          * this register does not depend on the structural authority having answered.
          */}
        <PeopleRegisterPanel register={people} names={peopleNames} placements={placements} />
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
