import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { WORKSPACES, destinationsForRole, resolveActiveWorkspace } from "../../src/config/workspace-nav";

const read = (path: string) => readFileSync(path, "utf8");
const codeOf = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const rail = read("src/components/layout/workspace-rail.tsx");
const shell = read("src/components/layout/hebun-shell.tsx");
const topbar = read("src/components/layout/topbar.tsx");
const secondary = read("src/components/layout/secondary-nav.tsx");
const mobile = read("src/components/layout/mobile-nav.tsx");
const css = read("src/app/globals.css");
const tokens = read("src/styles/tokens.css");

assert.equal(WORKSPACES.length, 7, "the canonical seven-workspace authority is unchanged");
assert.ok(rail.includes("workspaces.map((workspace)"), "one mechanism renders every canonical workspace");
assert.ok(rail.includes("const isActive = workspace.id === active"), "URL/workspace truth decides the open workspace");
assert.ok(rail.includes("const active = resolveShellSurface(pathname).workspace"), "expansion is route-derived");
assert.ok(rail.includes("href={workspace.href}"), "the workspace remains a real route link");
assert.ok(rail.includes("aria-expanded={isActive}"), "the route link exposes inline expansion state");
assert.ok(rail.includes("aria-controls={isActive ? sectionsId : undefined}"), "the link identifies its owned submenu");
assert.ok(rail.includes("{isActive ? ("), "only the active workspace renders Level-2");
assert.equal((rail.match(/<SecondaryNavContent/g) ?? []).length, 1, "one inline shared renderer serves every workspace");
assert.ok(rail.includes('density="inline"') && rail.includes('data-l2-presentation="inline"'), "the shared renderer is inline in the owning list item");
assert.ok(!existsSync("src/components/layout/contextual-sections.tsx"), "the rejected contextual component is removed");
assert.ok(!read("src/config/workspace-nav.ts").includes("l2Presentation"), "no presentation metadata remains");

for (const workspace of WORKSPACES) {
  const destinations = destinationsForRole(workspace, "director");
  assert.ok(destinations.length > 0, `${workspace.label} supplies canonical L2 destinations`);
  assert.equal(resolveActiveWorkspace(workspace.href), workspace.id, `${workspace.label} opens from route truth in one navigation`);
  for (const destination of destinations) {
    assert.ok(destination.label.length > 0, `${workspace.label} keeps complete destination labels`);
    if (destination.href) assert.equal(resolveActiveWorkspace(destination.href), workspace.id, `${destination.href} keeps ${workspace.label} expanded`);
  }
}
assert.equal(resolveActiveWorkspace("/command/inbox"), "command", "legacy routes keep honest workspace ownership");

assert.ok(!shell.includes("<SecondaryNav />"), "no detached desktop Level-2 column is mounted");
assert.ok(!/SecondaryToggle|Sections/.test(topbar), "there is no top-bar Sections trigger");
for (const rejected of ["ContextualSections", "getBoundingClientRect", "pointerdown", "backdrop", 'role="dialog"', "aria-modal", "Pin", "onMouseEnter", "onMouseOver"]) {
  assert.ok(!codeOf(rail).includes(rejected), `inline navigation has no rejected desktop behavior: ${rejected}`);
}
for (const workspace of WORKSPACES) assert.ok(!codeOf(rail).includes(`workspace.id === "${workspace.id}"`), `presentation does not special-case ${workspace.id}`);

assert.ok(mobile.includes("SecondaryNavContent"), "the mobile sheet keeps the shared renderer");
assert.ok(secondary.includes("destinationsForRole(workspace, role)"), "role filtering stays canonical");
assert.ok(rail.includes("overflow-y-auto"), "the workspace region scrolls vertically when needed");
assert.ok(rail.includes("shrink-0 border-t") && rail.includes("<HebyLauncher"), "Heby remains reachable in a stable footer");
assert.ok(css.includes("@media (min-width: 768px)") && css.includes("--rail-w: var(--rail-inline-w)"), "inline navigation starts at tablet width");
/*
 * THE RAIL WIDTH IS DERIVED, NOT APPROVED. This pinned `156px`, and 156px is what made the defect
 * necessary: it left the longest canonical Level-2 label 77px, so the rows bought the difference
 * with `w-max` and painted across the workspace canvas. Measured in Plus Jakarta Sans at the row's
 * own 12px/500, "Infrastructure & Settings" is 141px, and the chrome between the rail edge and that
 * text is 71px — so 212px is the floor, and anything below it forces an overflow hack back.
 */
const railInline = /--rail-inline-w:\s*(\d+)px/.exec(tokens);
assert.ok(railInline, "the integrated rail declares one width, in px, in the token authority");
assert.ok(
  Number(railInline![1]) >= 212,
  `the integrated rail is ${railInline![1]}px; the longest canonical L2 label (141px) plus its ` +
    "chrome (71px) needs 212px, and a narrower rail can only fit it by escaping the rail",
);
assert.ok(secondary.includes('inline ? "px-1 pb-1"'), "inline navigation uses compact nested padding");
assert.ok(secondary.includes('inline ? "mt-0.5 size-3" : "size-4"'), "L2 icons remain subordinate to L1 icons");
assert.ok(!/truncate|line-clamp|text-ellipsis/.test(codeOf(rail + secondary)), "canonical labels are never shortened");
/*
 * NOTHING INSIDE THE NAVIGATION MAY BE WIDER THAN THE NAVIGATION. These three assertions pinned the
 * defect itself: an intrinsic row width (`w-max`), a refusal to wrap (`whitespace-nowrap`), and a
 * 320px paint area inside a 156px rail. "Viewport-capped" was never the boundary that mattered —
 * the rail is, and 164px of the old paint area sat on top of the workspace canvas.
 */
for (const escape of ["w-max", "whitespace-nowrap"]) {
  assert.ok(
    !codeOf(secondary).includes(escape),
    `an inline L2 row may not use ${escape} — it is how a row grows past the rail it lives in`,
  );
}
for (const escape of ["w-[min(20rem,100vw)]", "pointer-events-none", "z-(--z-dropdown)", "w-max"]) {
  assert.ok(
    !codeOf(rail).includes(escape),
    `the inline navigation may not use ${escape} — it paints or lifts outside the rail`,
  );
}
assert.ok(rail.includes("overflow-x-hidden"), "and horizontal overflow remains a backstop");
assert.ok(rail.indexOf("href={workspace.href}") < rail.indexOf("<SecondaryNavContent"), "DOM and focus order place L2 immediately after its owner");

console.log("Responsive L2: all seven workspaces expose canonical inline navigation from URL truth.");
