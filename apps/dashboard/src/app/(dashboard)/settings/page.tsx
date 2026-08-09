import { PageHeader } from "@/components/layout/page-header";
import { InfrastructureSettingsSurface } from "@/components/platform-infrastructure/infrastructure-settings-surface";

export const metadata = { title: "Infrastructure & Settings — Hebun AI" };

/*
 * Infrastructure & Settings (Platform L2 · Hebun UI Phase 24C rebuild).
 *
 * The authoritative read-only platform infrastructure/configuration surface. It replaces the fabricated
 * settings (Profile/Notifications/Appearance and "API Keys: Supabase configured / Vercel configured")
 * with honest technical truth: in-memory persistence, no durable configuration store, no configured
 * provider, no connected integration, external authentication authority, and a strict secrets boundary.
 * No fabricated infrastructure health, no secret value, no secret/credential-mutation control.
 */

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Infrastructure & Settings"
        context="The real platform configuration and runtime infrastructure state — in-memory, not connected, with a strict secrets boundary. No live infrastructure health is claimed."
      />
      <InfrastructureSettingsSurface />
    </>
  );
}
