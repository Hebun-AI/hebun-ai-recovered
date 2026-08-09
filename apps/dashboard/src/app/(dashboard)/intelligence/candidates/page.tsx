import { Candidates } from "@/components/intelligence-candidates/candidates";
import { getCandidatesModel } from "@/features/intelligence-surfaces/workspace-model";

export const metadata = { title: "Candidates — Hebun AI" };

/*
 * Intelligence · Candidates (Phase 20C) — emerging intelligence under validation, preserving kind,
 * evidence basis, provenance, uncertainty, lifecycle, and restriction status. Contract-only runtime:
 * no candidate instance is surfaced, so the queue renders an honest empty state.
 */

export default function CandidatesPage() {
  return <Candidates model={getCandidatesModel()} />;
}
