/*
 * HW3 — the dual-surface presentation model: every required transition, mutual exclusivity, and the
 * safety of the return target.
 *
 * Heby has THREE presentation states (CLOSED / QUICK_PANEL / FULL_WORKSPACE) and exactly TWO
 * controls. These proofs drive the pure planner the product actually uses, then apply the command
 * exactly as the router adapter does, so the assertions are about real behaviour and not about a
 * parallel description of it.
 *
 * Pure: no React, no router, no network, no database.
 */
import assert from "node:assert/strict";
import {
  HEBY_FALLBACK_ROUTE,
  HEBY_WORKSPACE_ROUTE,
  hebyWorkspaceHref,
  planHebyTransition,
  resolveHebyReturnLabel,
  resolveHebyReturnRoute,
  resolveHebySurfaceState,
  type HebySurfaceControl,
  type HebySurfaceState,
} from "../../src/features/heby-surface";
import { HEBY_WORKSPACE_IDS } from "../../src/features/heby-integration";

/** The world the operator is standing in. Exactly the two inputs the provider holds. */
interface World {
  readonly pathname: string;
  readonly quickPanelRequested: boolean;
}

const surfaceOf = (world: World): HebySurfaceState => resolveHebySurfaceState(world);

/**
 * Apply a control EXACTLY as `heby-surface-context.tsx` does: plan the transition, then execute it.
 * If this diverges from the provider, the wiring test catches it — this proves the semantics.
 */
function operate(world: World, control: HebySurfaceControl, returnRoute: string): World {
  const command = planHebyTransition({
    state: surfaceOf(world),
    control,
    pathname: world.pathname,
    returnRoute,
  });
  switch (command.kind) {
    case "open-quick":
      return { ...world, quickPanelRequested: true };
    case "close-quick":
      return { ...world, quickPanelRequested: false };
    case "enter-workspace":
      return { pathname: command.href.split("?")[0]!, quickPanelRequested: false };
    case "leave-workspace":
      return { pathname: command.href, quickPanelRequested: command.openQuick };
  }
}

function main(): void {
  /* ── SURFACE MODEL: the six required transitions ─────────────────────────── */

  // 1. CLOSED → topbar → QUICK_PANEL
  {
    const start: World = { pathname: "/operations", quickPanelRequested: false };
    assert.equal(surfaceOf(start), "closed");
    const next = operate(start, "topbar", HEBY_FALLBACK_ROUTE);
    assert.equal(surfaceOf(next), "quick-panel");
    assert.equal(next.pathname, "/operations", "the Quick Panel never navigates away from the work");
  }

  // 2. QUICK_PANEL → topbar → CLOSED
  {
    const start: World = { pathname: "/operations", quickPanelRequested: true };
    assert.equal(surfaceOf(start), "quick-panel");
    const next = operate(start, "topbar", HEBY_FALLBACK_ROUTE);
    assert.equal(surfaceOf(next), "closed");
    assert.equal(next.pathname, "/operations", "closing the panel does not navigate");
  }

  // 3. CLOSED → rail → FULL_WORKSPACE (carrying the workspace as a hint)
  {
    const start: World = { pathname: "/operations", quickPanelRequested: false };
    const command = planHebyTransition({ state: "closed", control: "rail", pathname: "/operations", returnRoute: HEBY_FALLBACK_ROUTE });
    assert.deepEqual(command, { kind: "enter-workspace", href: "/heby?from=operations" });
    assert.equal(surfaceOf(operate(start, "rail", HEBY_FALLBACK_ROUTE)), "full-workspace");
  }

  // 4. FULL_WORKSPACE → rail → CLOSED, back on the previous workspace
  {
    const start: World = { pathname: HEBY_WORKSPACE_ROUTE, quickPanelRequested: false };
    assert.equal(surfaceOf(start), "full-workspace");
    const next = operate(start, "rail", "/operations");
    assert.equal(surfaceOf(next), "closed", "the rail control is a true toggle");
    assert.equal(next.pathname, "/operations", "and it returns to where the operator came from");
  }

  // 5. QUICK_PANEL → rail → FULL_WORKSPACE (the panel closes as part of the same command)
  {
    const start: World = { pathname: "/platform", quickPanelRequested: true };
    assert.equal(surfaceOf(start), "quick-panel");
    const command = planHebyTransition({ state: "quick-panel", control: "rail", pathname: "/platform", returnRoute: HEBY_FALLBACK_ROUTE });
    assert.deepEqual(command, { kind: "enter-workspace", href: "/heby?from=platform" });
    const next = operate(start, "rail", HEBY_FALLBACK_ROUTE);
    assert.equal(surfaceOf(next), "full-workspace");
    assert.equal(next.quickPanelRequested, false, "entering the workspace clears the panel request");
  }

  // 6. FULL_WORKSPACE → topbar → previous workspace + QUICK_PANEL
  {
    const start: World = { pathname: HEBY_WORKSPACE_ROUTE, quickPanelRequested: false };
    const command = planHebyTransition({ state: "full-workspace", control: "topbar", pathname: HEBY_WORKSPACE_ROUTE, returnRoute: "/operations" });
    assert.deepEqual(command, { kind: "leave-workspace", href: "/operations", openQuick: true });
    const next = operate(start, "topbar", "/operations");
    assert.equal(next.pathname, "/operations", "the previous workspace is restored");
    assert.equal(surfaceOf(next), "quick-panel", "and the conversation continues in the panel there");
  }

  // 7. BOTH SURFACES ARE NEVER ACTIVE AT ONCE — for every representable input, not just the ones we
  //    happen to drive. The surface is a single value, so "both" is unrepresentable by construction.
  {
    const paths = ["/operations", "/platform", "/command", "/approvals", HEBY_WORKSPACE_ROUTE, "/heby/sub", "/unknown"];
    for (const pathname of paths) {
      for (const quickPanelRequested of [true, false]) {
        const state = surfaceOf({ pathname, quickPanelRequested });
        assert.ok(["closed", "quick-panel", "full-workspace"].includes(state), `${pathname} resolves to one state`);
        // The route WINS: a stale panel request can never survive alongside the Full Workspace.
        if (pathname.startsWith(HEBY_WORKSPACE_ROUTE)) {
          assert.equal(state, "full-workspace", `${pathname} is always the Full Workspace`);
        } else {
          assert.notEqual(state, "full-workspace", `${pathname} is never the Full Workspace`);
        }
      }
    }
    // Exhaustive toggling from every state through every control leaves exactly one active surface.
    let world: World = { pathname: "/operations", quickPanelRequested: false };
    for (const control of ["topbar", "rail", "topbar", "rail", "rail", "topbar", "topbar"] as const) {
      world = operate(world, control, "/operations");
      const state = surfaceOf(world);
      assert.equal(
        state === "full-workspace" ? world.pathname.startsWith(HEBY_WORKSPACE_ROUTE) : !world.pathname.startsWith(HEBY_WORKSPACE_ROUTE),
        true,
        "the surface always agrees with the route",
      );
    }
  }

  /* ── NAVIGATION: return semantics and their security ─────────────────────── */

  // 8. A valid previous workspace is restored, for EVERY known identity, using that identity's own
  //    canonical route from the registry — never a caller-supplied string.
  {
    for (const id of HEBY_WORKSPACE_IDS) {
      const href = hebyWorkspaceHref(resolveHebyReturnRoute(id));
      assert.equal(href, `/heby?from=${id}`, `${id} round-trips: workspace → /heby → workspace`);
      assert.ok(resolveHebyReturnRoute(id).startsWith("/"), `${id} returns to an in-app route`);
      assert.ok(resolveHebyReturnLabel(id).length > 0, `${id} has a human-readable return label`);
    }
    assert.equal(resolveHebyReturnRoute("operations"), "/operations");
    assert.equal(resolveHebyReturnRoute("platform"), "/platform");
    assert.equal(resolveHebyReturnRoute("decisions"), "/approvals", "decisions is Command's human-authority surface");
  }

  // 9. Direct /heby (no hint) closes to the canonical safe Hebun fallback.
  {
    assert.equal(resolveHebyReturnRoute(undefined), HEBY_FALLBACK_ROUTE);
    assert.equal(resolveHebyReturnRoute(null), HEBY_FALLBACK_ROUTE);
    assert.equal(resolveHebyReturnRoute(""), HEBY_FALLBACK_ROUTE);
    assert.equal(HEBY_FALLBACK_ROUTE, "/command", "the fallback is the product's own landing surface");
    assert.equal(resolveHebyReturnLabel(undefined), "Command");
    // And leaving via either control from a direct load lands on that fallback.
    for (const control of ["rail", "topbar"] as const) {
      const command = planHebyTransition({
        state: "full-workspace",
        control,
        pathname: HEBY_WORKSPACE_ROUTE,
        returnRoute: resolveHebyReturnRoute(undefined),
      });
      assert.equal(command.kind, "leave-workspace");
      if (command.kind === "leave-workspace") assert.equal(command.href, HEBY_FALLBACK_ROUTE);
    }
  }

  // 10. A malicious or invalid `from` FAILS SAFE. This is an allow-list, not a sanitizer: the hint
  //     must be exactly a known identity, and the route then comes from the registry — so no caller
  //     string can ever become a redirect target, in-app or otherwise.
  {
    const hostile = [
      "https://evil.example",
      "http://evil.example/path",
      "//evil.example",
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "../",
      "../../etc/passwd",
      "/operations",
      "operations/../platform",
      "<script>alert(1)</script>",
      "operations; drop table",
      "OPERATIONS",
      "command,platform",
      "__proto__",
      "constructor",
      "tenant-2",
      "   ",
      "\n/operations",
      "%2F%2Fevil.example",
    ];
    for (const value of hostile) {
      const route = resolveHebyReturnRoute(value);
      assert.equal(route, HEBY_FALLBACK_ROUTE, `${JSON.stringify(value)} fails safe to the fallback`);
      // Nothing the caller supplied is reflected into the resolved route or label.
      assert.ok(!route.includes(value.trim()) || value.trim() === "", "caller text is never echoed into the route");
      assert.equal(resolveHebyReturnLabel(value), "Command", "and never into the label");
      // No off-origin or scheme-bearing target can be produced.
      assert.ok(route.startsWith("/") && !route.startsWith("//"), "the target is always a single-slash in-app path");
      assert.ok(!/^[a-z][a-z0-9+.-]*:/i.test(route), "the target never carries a URL scheme");
    }
  }

  console.log("hw3 surface model + navigation safety passed");
}

main();
