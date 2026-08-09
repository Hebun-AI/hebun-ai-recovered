import { SignalsAssessments } from "@/components/intelligence-signals/signals-assessments";
import { getSignalsAssessmentsModel } from "@/features/intelligence-surfaces/workspace-model";

export const metadata = { title: "Signals & Assessments — Hebun AI" };

/*
 * Intelligence · Signals & Assessments (Phase 20C) — awareness-signal + awareness-assessment,
 * from the real Organizational Intelligence Runtime vocabulary. Contract-only: no instance is
 * surfaced, so the surface renders honest empty states. No fabricated signal or assessment.
 */

export default function SignalsAssessmentsPage() {
  return <SignalsAssessments model={getSignalsAssessmentsModel()} />;
}
