import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Policies & Rules — Hebun AI" };

/*
 * Legacy Permission Center — retired in Hebun UI Phase 23D.
 *
 * This page presented a fabricated capability/role matrix, permission changes, and conflicts. That is
 * policy/rule applicability and restriction — which role may perform which governed capability — not an
 * identity/IAM system Governance owns, and not human authority (human decisions live in Decisions).
 * The honest owner of rule applicability is Policies & Rules at /director/governance/policies (Phase 23B),
 * where the real engine's permission checks are part of the policy pipeline. This route permanently
 * redirects there. Single hop, no loop, no chain. No new Permissions surface is invented.
 */

export default function GovernancePermissionsLegacyPage(): never {
  permanentRedirect("/director/governance/policies");
}
