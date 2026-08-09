import { DirectorIntent } from "@/components/director-intent/director-intent";
import { getDirectorIntentModel } from "@/features/director-intent/workspace-model";

export const metadata = { title: "Director Intent — Hebun AI" };

/*
 * Command · Director Intent (Phase 20B) — the prepared-intent surface that replaces the former
 * "Command Console" (Phase 20A decision D1). Not a shell, terminal, or direct execution. It
 * presents the Phase 17 action lifecycle read-only: only read-only / side-effect-free preparation
 * is invokable; every mutation is gated to human authority with no connected substrate. Prepared
 * ≠ authorized ≠ executed; there is no "authorized" state the system can produce.
 */

export default function DirectorIntentPage() {
  return <DirectorIntent model={getDirectorIntentModel()} />;
}
