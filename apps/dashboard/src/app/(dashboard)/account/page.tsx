import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { DisplayNameForm } from "@/components/account-profile/display-name-form";
import { readOwnProfile, readTeam } from "@/features/account-profile/account-profile.server";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { utcInstant } from "@/lib/format";

export const metadata = { title: "Profile & Team — Hebun AI" };
export const dynamic = "force-dynamic";

/*
 * V1-STAGE-4 — Profile & Team. The viewer's own profile, their organization and membership, and —
 * for the organization's Governance authority only — the team with roles and pending invitations.
 *
 * It owns no authority. Membership, roles and invitations are read through the released readers and
 * changed only on /governance/authority. The one thing editable here is the viewer's own display
 * name. Email is the sign-in and ownership identity and is never edited here.
 */
export default async function AccountPage() {
  const tenant = await resolveTenantContext();
  const [profile, team] = await Promise.all([readOwnProfile(tenant), readTeam(tenant)]);

  if (profile.status !== "read") {
    return (
      <>
        <PageHeader title="Profile & Team" context="Your profile, your organization, and your team." />
        <p className="text-sm text-fg-muted">
          {profile.status === "unauthenticated" ? "Sign in to see your profile." : "Your profile could not be read right now."}
        </p>
      </>
    );
  }
  const p = profile.profile;
  return (
    <>
      <PageHeader title="Profile & Team" context="Your profile, your organization, and your team." />

      <section aria-labelledby="profile-heading" className="max-w-3xl space-y-3">
        <h2 id="profile-heading" className="text-sm font-semibold text-fg-primary">
          Profile
        </h2>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-fg-muted">Email</dt>
          <dd className="min-w-0 break-all text-fg-primary">
            {p.email}{" "}
            <span className="text-xs text-fg-muted">
              ({p.emailVerified === "verified" ? "verified" : p.emailVerified === "unverified" ? "not verified" : "verification unknown"} · your sign-in
              address, not editable here)
            </span>
          </dd>
          <dt className="text-fg-muted">Name</dt>
          <dd className="text-fg-primary">{p.name ?? <span className="text-fg-muted">Not recorded</span>}</dd>
        </dl>
        <DisplayNameForm current={p.displayName} version={p.profileVersion} />
        <p className="text-xs text-fg-muted">Your display name is how your team sees you across Hebun. Leave it empty to show your name.</p>
      </section>

      <section aria-labelledby="org-heading" className="mt-8 max-w-3xl space-y-3">
        <h2 id="org-heading" className="text-sm font-semibold text-fg-primary">
          Organization
        </h2>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-fg-muted">Organization</dt>
          <dd className="text-fg-primary">
            {p.tenant.name} <span className="text-xs text-fg-muted">({p.tenant.slug})</span>
          </dd>
          <dt className="text-fg-muted">Your role</dt>
          <dd className="text-fg-primary">{p.membership.roleName ?? <span className="text-fg-muted">No role recorded</span>}</dd>
          <dt className="text-fg-muted">Member since</dt>
          <dd className="text-fg-primary">{utcInstant(p.membership.since)}</dd>
          <dt className="text-fg-muted">Governance authority</dt>
          <dd className="text-fg-primary">{p.viewerIsGovernanceAuthority ? "Yes — you hold it" : "No"}</dd>
        </dl>
      </section>

      <section aria-labelledby="team-heading" className="mt-8 max-w-4xl space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="team-heading" className="text-sm font-semibold text-fg-primary">
            Team
          </h2>
          <Link href="/governance/authority" className="text-xs underline underline-offset-2 text-fg-secondary">
            Invite or change access in Governance
          </Link>
        </div>
        {team.status === "authority-only" ? (
          <p className="text-sm text-fg-muted">
            The member list and pending invitations are visible to your organization&apos;s Governance authority.
          </p>
        ) : team.status !== "read" ? (
          <p className="text-sm text-fg-muted">The team could not be read right now.</p>
        ) : (
          <>
            <table className="w-full min-w-0 text-left text-sm">
              <thead className="text-xs text-fg-muted">
                <tr>
                  <th scope="col" className="py-1 pr-4 font-medium">Member</th>
                  <th scope="col" className="py-1 pr-4 font-medium">Role</th>
                  <th scope="col" className="py-1 font-medium">Member since</th>
                </tr>
              </thead>
              <tbody>
                {team.members.map((m) => (
                  <tr key={m.userId} className="border-t border-border-subtle">
                    <td className="py-1.5 pr-4 text-fg-primary">
                      {m.label ?? <span className="text-fg-muted">Unnamed member</span>}
                      {m.isViewer ? <span className="text-xs text-fg-muted"> (you)</span> : null}
                    </td>
                    <td className="py-1.5 pr-4 text-fg-secondary">{m.roleName ?? "—"}</td>
                    <td className="py-1.5 text-fg-secondary">{utcInstant(m.since)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {team.truncated ? <p className="text-xs text-fg-muted">Showing the first members only.</p> : null}
            <h3 className="pt-2 text-xs font-medium text-fg-secondary">Pending invitations ({team.invitations.length})</h3>
            {team.invitations.length === 0 ? (
              <p className="text-xs text-fg-muted">No pending invitations.</p>
            ) : (
              <ul className="space-y-1 text-xs text-fg-secondary">
                {team.invitations.map((i) => (
                  <li key={i.invitationId}>
                    Issued {utcInstant(i.issuedAt)} · {i.expired ? "expired" : `expires ${utcInstant(i.expiresAt)}`}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </>
  );
}
