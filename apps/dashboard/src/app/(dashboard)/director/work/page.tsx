import { PageHeader } from "@/components/layout/page-header";
import { WorkRegisterPanel } from "@/components/organizational-work/work-register";
import { readWorkRegister } from "@/features/organizational-work/read-work.server";
import { readOrganizationAuthority } from "@/features/organization-authority/read-organization.server";
import { ORGANIZATION_STRUCTURE_UNAVAILABLE } from "@/features/organization-authority/contracts";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import {
  readSelectableMembers,
  resolveHumanLabels,
  type HumanLabel,
  type SelectableMembersRead,
} from "@/features/auth-runtime/human-label-read.server";

/*
 * /director/work — the Work Register (WORK-1).
 *
 * ── WHY THIS IS ITS OWN ROUTE AND NOT A SECTION OF /director/organization ────
 *
 * Organization Structure Authority answers "what parts does this organization have"; Organizational
 * Work Authority answers "what is this organization doing". They are DIFFERENT authorities with
 * different rules, and OSA's own released pins — `DEPARTMENT != TEAM`, `STRUCTURE != PERMISSION` —
 * exist because conflating structure with anything else is the failure mode that surface is most
 * exposed to. A work list under a header reading "Organization" would be exactly that conflation,
 * on the page a Director trusts most.
 *
 * No new Heby workspace is created: `HebyWorkspaceId` is a closed eight-value union and Command
 * already owns the Director's organization-wide routes. WORK-1 adds no source class and no
 * workspace entry at all — Heby grounding is a later milestone's work.
 *
 * ── THIS PAGE ADDS NO AUTHORITY ──────────────────────────────────────────────
 *
 * THE TENANT IS RESOLVED HERE, ON THE SERVER. `resolveTenantContext()` takes no argument, so there
 * is no parameter through which this page could name a different organization, and none of the read
 * seams it calls has an organization parameter either.
 *
 * ── THREE AUTHORITIES, COMPOSED, NEVER MERGED ────────────────────────────────
 *
 * Work, structure and identity are read SEPARATELY here rather than joined inside any one of them.
 * Organizational Work stays authoritative for the work and for the accountable IDENTIFIER;
 * Organization Structure stays authoritative for which departments exist and are in service;
 * Identity stays authoritative for what an identifier is called. Nothing merges them into a record:
 * no `WorkItemView` field holds a human name, no label is persisted, and this page hands the
 * surface three independent answers to hold side by side.
 *
 * That is the shape `/director/organization` already uses for department owners, and the two
 * legibility reads keep their deliberately different predicates: the picker offers currently
 * eligible members, while label resolution answers for ids the register already names even when
 * that person has since left. Both are gated on this organization's existing Governance authority
 * and both fail closed to "unavailable" — which the surface renders as the identifier, never as an
 * invented name.
 *
 * ── THE STRUCTURE READ GOES THROUGH THE ONE SEAM ─────────────────────────────
 *
 * `readOrganizationAuthority` is the single seam every consumer calls for organizational truth, and
 * this page calls it rather than the structural half directly, so no second way to ask is learned
 * here.
 */

export default async function OrganizationalWorkPage() {
  const tenant = await resolveTenantContext();
  const register = await readWorkRegister(tenant);
  const authoritative = await readOrganizationAuthority(tenant);
  const structure =
    authoritative.status === "available"
      ? authoritative.organization.structure
      : ORGANIZATION_STRUCTURE_UNAVAILABLE;

  /*
   * Only asked when there is a register to be legible ABOUT. An unavailable register renders no
   * control and names no accountable human, so neither read would have a consumer.
   */
  let members: SelectableMembersRead = { status: "unavailable", reason: "authority-unavailable" };
  let accountableLabels: readonly HumanLabel[] = [];
  if (register.status === "available") {
    members = await readSelectableMembers(tenant);
    const accountableIds = register.items
      .map((item) => item.accountableActorId)
      .filter((id): id is string => Boolean(id));
    const resolved = await resolveHumanLabels(tenant, accountableIds);
    accountableLabels = [...resolved].map(([userId, label]) => ({ userId, label }));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Work"
        context={
          "What this organization has declared it is doing — recorded work, the part of the " +
          "organization it belongs to, the human accountable for it, and the state a human " +
          "declared. Hebun observes nothing here and verifies nothing."
        }
      />
      <WorkRegisterPanel
        register={register}
        structure={structure}
        members={members}
        accountableLabels={accountableLabels}
      />
    </div>
  );
}
