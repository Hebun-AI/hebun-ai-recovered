/*
 * PBGA-1 — THE DECLARE-PURPOSE AFFORDANCE.
 *
 * THE DEFECT THIS FILE EXISTS FOR:
 *
 *   The button's predicate was correct and the surface still read as inert. Selecting a work item
 *   armed it, and the ONLY visual difference between armed and unarmed was `disabled:opacity-40` on
 *   already-muted text, beside a solid primary "Authorize this action" button. A Director selected
 *   the work, saw no change, and did not click — production acceptance stalled on a control that
 *   was working.
 *
 *   A CORRECT PREDICATE THE OPERATOR CANNOT SEE IS NOT A WORKING CONTROL.
 *
 * Structural, over the shipped source. It asserts the two states are distinguishable by something
 * other than opacity, and — the half that matters more — that the PREDICATE and the SEMANTICS were
 * not touched to achieve it.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SURFACE = "src/components/decision-workspace/action-authorizations.tsx";

function main(): void {
  const source = readFileSync(path.join(ROOT, SURFACE), "utf8");
  const control =
    /function DeclarePurposeControl\(([\s\S]*?)\nfunction RequestCard/.exec(source)?.[1] ?? "";
  assert.ok(control.length > 0, "the declare-purpose control is present");

  /* ── 1 · THE PREDICATE IS UNCHANGED ──────────────────────────────────────
   * The fix is presentational. If this assertion ever needs relaxing, the change is no longer a
   * presentation change and the pending-only / declared-once rules are back in scope.
   */
  {
    assert.ok(
      control.includes('disabled={pending || choice === ""}'),
      "the button is still disabled exactly while a transition is in flight or nothing is chosen",
    );
    assert.equal(
      (control.match(/disabled=\{/g) ?? []).length,
      2,
      "exactly two disabled bindings — the select and the button — and no third path",
    );
  }

  /* ── 2 · ARMED AND UNARMED DIFFER BY MORE THAN OPACITY ───────────────────
   * The released defect was that they differed by opacity ALONE. A reader scanning a surface does
   * not measure opacity; they look for a control that appears actionable.
   */
  {
    const armed = /:\s*"(rounded-md border border-fg-secondary[^"]*)"/.exec(control)?.[1] ?? "";
    const unarmed = /\?\s*"(rounded-md border border-border[^"]*)"/.exec(control)?.[1] ?? "";
    assert.ok(armed.length > 0 && unarmed.length > 0, "both button states are expressed");
    assert.notEqual(armed, unarmed, "and they are not the same class list");

    const strip = (s: string): string => s.replace(/opacity-\d+/g, "").trim();
    assert.notEqual(
      strip(armed),
      strip(unarmed),
      "the two states differ by something other than opacity — border, weight or foreground",
    );
    assert.ok(
      armed.includes("text-fg-primary"),
      "the armed state carries a foreground a reader registers as actionable",
    );
    assert.ok(
      !armed.includes("bg-primary") && !armed.includes("text-on-primary"),
      "and it is still NOT the primary treatment — a declaration is not a decision",
    );
  }

  /* ── 3 · THE CHOSEN WORK IS NAMED, PER CARD ──────────────────────────────
   * Three identical pending proposals to one recipient stack on this surface. Naming the chosen
   * work beside the button that would record it is what makes a selection legible per card.
   */
  {
    assert.ok(
      /will declare: \{options\.find\(/.test(control),
      "the control names the work it would declare, resolved from the offered options",
    );
    assert.ok(
      control.includes("?.title ?? choice"),
      "and falls back to the identifier rather than rendering nothing when it cannot name it",
    );
  }

  /* ── 4 · NO SEMANTICS MOVED ──────────────────────────────────────────────
   * The affordance fix must not have acquired an approval, an execution, or a second writer.
   */
  {
    for (const forbidden of [
      "approveActionRequestAction",
      "rejectActionRequestAction",
      "revokeActionPermitAction",
      "executeAuthorizedActionAction",
    ]) {
      assert.ok(
        !control.includes(forbidden),
        `the declare-purpose control must not reach ${forbidden}`,
      );
    }
    assert.equal(
      (control.match(/declareActionPurposeAction/g) ?? []).length,
      1,
      "one call, to the declaration action, and nothing else",
    );
  }

  console.log("pbga1-purpose-bound-act/purpose-affordance: OK");
}

main();
