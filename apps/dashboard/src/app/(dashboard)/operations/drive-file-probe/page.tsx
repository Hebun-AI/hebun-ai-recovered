/*
 * TEMPORARY — DRIVE-FILE-FOLDER-PROBE-1. Hidden (no navigation entry); removed after the probe.
 * A read-only provider experiment over the existing Google connection. It admits nothing.
 */
import { DriveFolderProbe } from "./probe-client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default function DriveFileProbePage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
      <h1 className="text-lg font-semibold text-fg-primary">drive.file folder probe (temporary)</h1>
      <p className="text-sm text-fg-secondary">
        Read-only experiment. Chooses one folder in Google&apos;s chooser and records what this app can see and read inside it.
        Nothing is admitted, stored or published.
      </p>
      <DriveFolderProbe />
    </div>
  );
}
