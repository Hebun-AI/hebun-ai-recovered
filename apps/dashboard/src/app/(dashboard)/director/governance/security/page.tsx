import { SecurityCenter } from "@/components/security-center/security-center";
import { getSecurityCenterModel } from "@/features/security-center";

export const metadata = { title: "Security Center — Hebun AI" };

/*
 * Security Center (Phase 19) — Governance Level-2 security surface.
 *
 * Loads only the real/structural Security Intelligence model: the security source map (derived or
 * not-connected), the signal-kind / finding-status / risk-class vocabularies, the structural
 * response options, the inspector lenses, and the real disconnected Phase 18 device-security
 * summary. Every populated collection (findings, signals, incidents, timeline) is empty — none is
 * surfaced or fabricated. No incident, attacker, CVE, score, timestamp, secret, or evidence.
 * Security Center detects, explains, investigates, and prepares; it never decides or executes.
 */

export default function SecurityCenterPage() {
  // The surface is tenant-independent at static render: no security feed is connected, so every
  // collection is empty regardless of tenant. A future connected feed would resolve the request
  // tenant and scope signals/findings to it (see listSecuritySignals / listSecurityFindings).
  const model = getSecurityCenterModel("");
  return <SecurityCenter model={model} />;
}
