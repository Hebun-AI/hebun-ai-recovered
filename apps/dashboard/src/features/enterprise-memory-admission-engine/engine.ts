/**
 * Enterprise Memory Admission Engine — top-level engine.
 *
 * A stateless factory. The returned engine holds no mutable state, so repeated
 * calls with identical input are identical in result. It exposes a single pure
 * operation over the fixed pipeline; it starts nothing and persists nothing.
 */

import { PIPELINE_STAGES, runAdmissionPipeline } from "@/features/enterprise-memory-admission-engine/pipeline";
import type { PipelineStage } from "@/features/enterprise-memory-admission-engine/pipeline";
import type {
  AdmissionEngineInput,
  MemoryAdmissionResult,
} from "@/features/enterprise-memory-admission-engine/contracts";

export interface AdmissionEngine {
  readonly stages: readonly PipelineStage[];
  admit(input: AdmissionEngineInput): MemoryAdmissionResult;
}

export function createAdmissionEngine(): AdmissionEngine {
  return Object.freeze({
    stages: PIPELINE_STAGES,
    admit(input: AdmissionEngineInput): MemoryAdmissionResult {
      return runAdmissionPipeline(input);
    },
  });
}
