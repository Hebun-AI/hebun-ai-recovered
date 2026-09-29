/*
 * tests/helpers/simulated-data-use.ts — recorded data-use decisions for the SIMULATED providers only
 * (DATA-USE-MEDIA-GUARD-1).
 *
 * TEST-ONLY. The generation suites exercise registration, dispatch, admission and lineage with fake
 * transports whose provider names say "simulated". No production decision names those providers, so
 * without a decision they would now (correctly) refuse every source. These rows let a suite keep proving
 * the machinery it was written for; they say nothing about any real provider, and they enter only
 * through the authorities' test deps — never through an application door.
 */
import type { RecordedDataUseDecision } from "../../src/features/media-assets/external-generative-data-use";
import { SIMULATED_VIDEO_PROVIDER } from "./fake-async-video-transport";
import { FAKE_MEDIA_PROVIDER } from "./media-fakes";

const EVIDENCE = "TEST ONLY — simulated provider, no bytes leave the test process";

export const SIMULATED_PROVIDER_DATA_USE_DECISIONS: readonly RecordedDataUseDecision[] = Object.freeze([
  { provider: FAKE_MEDIA_PROVIDER, purpose: "reference-edit", lineage: "generated-only", decision: "allowed", evidence: EVIDENCE },
  { provider: FAKE_MEDIA_PROVIDER, purpose: "reference-edit", lineage: "includes-supplied", decision: "allowed", evidence: EVIDENCE },
  { provider: SIMULATED_VIDEO_PROVIDER, purpose: "image-to-video", lineage: "generated-only", decision: "allowed", evidence: EVIDENCE },
  { provider: SIMULATED_VIDEO_PROVIDER, purpose: "image-to-video", lineage: "includes-supplied", decision: "allowed", evidence: EVIDENCE },
]);
