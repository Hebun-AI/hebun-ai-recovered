/*
 * ORG-1 — "WHAT IS THIS DEPARTMENT?"
 *
 * THE SUCCESS CONDITION:
 *
 *   "One surface answers, for each department, who is accountable for it, who is recorded as
 *    working in it, and which work names it — from four separate authorities, composed and never
 *    merged. An unreadable or BOUNDED register is never read as a zero for a department, and the
 *    panel refuses the one inference adjacency invites: that the people placed here do this work."
 *
 * The pins:
 *
 *   PLACED HERE != DOES THIS WORK        WORK NAMES A DEPARTMENT != ITS PEOPLE PERFORM IT
 *   UNAVAILABLE != NONE                  TRUNCATED != COMPLETE
 *   THE GROUPING IS DERIVED; EVERY FACT IN IT IS AUTHORITATIVE TO ITS OWNER
 *
 * Structural: the panel is a pure presentation component, so this suite reads its shipped source
 * and asserts the guarantees it must carry. No database, no network, no model.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { codeOf } from "../helpers/durable-write-detector";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

const PANEL = "src/components/organization-domain/department-composition.tsx";
const PAGE = "src/app/(dashboard)/director/organization/page.tsx";

function main(): void {
  const panel = read(PANEL);
  const code = codeOf(panel);
  const page = read(PAGE);
  const pageCode = codeOf(page);

  /* ═════════════════════════════════════════════════════════════════════════
   * 1. IT COMPOSES FOUR AUTHORITIES AND OWNS NOTHING.
   * ═══════════════════════════════════════════════════════════════════════ */
  for (const shape of [
    "OrganizationStructure",
    "PlacementRegister",
    "WorkRegister",
    "HumanLabel",
  ]) {
    assert.ok(code.includes(shape), `the panel receives the ${shape} answer`);
  }
  /* TYPES ONLY. A component able to call a read would be a database handle in a browser bundle. */
  assert.match(
    panel,
    /import type \{ OrganizationStructure \}/,
    "the structural shape is imported as a TYPE",
  );
  for (const forbidden of [
    "readWorkRegister(",
    "readPlacementRegister(",
    "resolveHumanLabels(",
    "getControlPlaneDb",
    '"use server"',
    "useState",
    "onClick",
  ]) {
    assert.ok(!code.includes(forbidden), `the panel performs no read and offers no control: ${forbidden}`);
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * 2. THE REFUSED INFERENCE — THE REASON THIS PANEL NEEDED WRITING CAREFULLY.
   * ═══════════════════════════════════════════════════════════════════════ */
  assert.match(
    panel,
    /does not record\s*\n?\s*that the people placed here perform this work/,
    "PLACED HERE != DOES THIS WORK, said on the department itself",
  );
  assert.match(
    panel,
    /accountable human need not be placed in this department/,
    "ACCOUNTABLE != PLACED HERE — WORK-2's released pin, carried onto the surface",
  );
  assert.match(
    panel,
    /reference, not an assignment/,
    "and the header states that naming a department is not assigning work to it",
  );
  assert.match(
    panel,
    /the grouping is composed here and owns nothing/,
    "THE GROUPING IS DERIVED — stated where a reader sees it",
  );

  /* ═════════════════════════════════════════════════════════════════════════
   * 3. AN EMPTY SLICE IS ONLY READ AS A ZERO WHEN ITS REGISTER ANSWERED IN FULL.
   * ═══════════════════════════════════════════════════════════════════════ */
  assert.match(
    code,
    /const placementsComplete = placements\.status === "available" && !placements\.truncated/,
    "a bounded placement register may not produce a per-department zero",
  );
  assert.match(
    code,
    /const workComplete = work\.status === "available" && !work\.truncated/,
    "and neither may a bounded work register",
  );
  for (const sentence of [
    "Who works here is unknown",
    "Which work names this department is unknown",
    "whether anybody is placed here is unknown",
    "whether any work names this department is unknown",
  ]) {
    assert.ok(panel.includes(sentence), `the unknown case is stated, not zeroed: "${sentence}"`);
  }
  assert.match(
    panel,
    /not a statement that nobody works here/,
    "UNAVAILABLE != NONE, said out loud",
  );
  assert.match(
    panel,
    /not a statement that it carries none/,
    "and again for work",
  );

  /* ═════════════════════════════════════════════════════════════════════════
   * 4. THE RECORD IS NEVER ERASED, AND NO NAME IS INVENTED.
   * ═══════════════════════════════════════════════════════════════════════ */
  assert.match(panel, /name unavailable/, "an unresolved identifier is named unavailable, never guessed");
  assert.match(panel, /owner\.actorId/, "and the identifier travels beside whatever they are called");
  assert.match(
    panel,
    /no longer an active member of this organization\. The record still names them/,
    "a departed owner is still named — ownership is historical truth",
  );
  assert.match(
    panel,
    /Every state is declared by a human — Hebun observed nothing/,
    "work states stay declarations on this surface too",
  );
  assert.match(panel, /retired from service/, "a retired department is shown, not hidden");

  /* RETIRED WORK IS EXCLUDED FROM THE DEPARTMENT'S LIVE LIST, and by the released flag. */
  assert.match(code, /workHere\.filter\(\(item\) => item\.inService\)/,
    "retired work does not count toward what a department currently carries");

  /* ═════════════════════════════════════════════════════════════════════════
   * 5. THE PAGE COMPOSES; IT DOES NOT MERGE.
   * ═══════════════════════════════════════════════════════════════════════ */
  assert.ok(pageCode.includes("readWorkRegister(tenant)"), "the page performs the fourth read on the server");
  assert.ok(pageCode.includes("<DepartmentCompositionPanel"), "and renders the composition");
  assert.match(
    pageCode,
    /new Map\(\s*\[\.\.\.ownerLabels, \.\.\.placedNames, \.\.\.peopleNames\]/,
    "labels are the DEDUPED UNION of the three sets already resolved — one identifier asked once",
  );
  /* NO REGISTER GAINS A LABEL FIELD, and no read is merged into another. */
  for (const forbidden of ["placements.placements.map((p) => ({ ...p, label", "items.map((item) => ({ ...item, label"]) {
    assert.ok(!pageCode.includes(forbidden), `no view gains a label field: ${forbidden}`);
  }

  console.log("PASS org1-department-composition/composition-truth");
}

main();
