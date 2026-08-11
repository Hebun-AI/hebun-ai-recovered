/*
 * HW1 — truthful context semantics.
 *
 * `/heby` is reachable directly and from any workspace. The workspace hint in the URL is UNTRUSTED:
 * it is resolved against the closed workspace identity set on the server, and anything unrecognized
 * becomes the general context instead of being echoed back or forwarded. This test proves the hint
 * cannot widen scope, cannot inject text into the UI, and that `/context` never claims connectivity
 * or organization-wide visibility Hebun does not have.
 */
import assert from "node:assert/strict";
import { HEBY_WORKSPACE_IDS, resolveHebyWorkspace } from "../../src/features/heby-integration";
import { resolveHebyWorkspaceEntry, HEBY_GENERAL_ROUTE } from "../../src/features/heby-workspace/context";
import { hebyWorkspaceHref } from "../../src/features/heby-surface";

/*
 * Language that would over-claim what Heby can see or do. The negative lookbehind lets an explicit
 * DENIAL through ("it is not connected to …") while still failing any positive claim.
 */
const OVERCLAIM =
  /(?<!not )(?:all company systems|fully connected|every system|real-?time|monitoring|online|healthy|connected to)/i;

function main(): void {
  // 1. A recognized hint resolves to that workspace's canonical route and label.
  {
    const entry = resolveHebyWorkspaceEntry("operations");
    assert.equal(entry.scope, "workspace");
    assert.equal(entry.workspace, "operations");
    assert.equal(entry.label, "Operations");
    assert.equal(entry.route, "/operations", "the canonical workspace route scopes the evidence");
    assert.ok(entry.detail[0]!.startsWith("Current context: Operations"), "/context states the real context");
  }

  // 2. Every known workspace identity resolves, and its route resolves BACK to the same workspace —
  //    so the hint selects an existing scope and can never point somewhere unmodelled.
  for (const id of HEBY_WORKSPACE_IDS) {
    const entry = resolveHebyWorkspaceEntry(id);
    assert.equal(entry.scope, "workspace", `${id} resolves`);
    assert.equal(resolveHebyWorkspace(entry.route), id, `${id} round-trips through the runtime resolver`);
  }

  // 3. Absent / unknown / hostile hints ALL fall back to the general context, and nothing supplied
  //    by the caller is reflected into the label, route, or copy.
  {
    const hostile = [
      undefined, null, "", "   ", "COMMAND", "admin", "root", "../operations", "/operations",
      "operations; drop table", "<script>alert(1)</script>", "__proto__", "constructor",
      "command,platform", "tenant-2", "https://evil.example.com",
    ];
    for (const value of hostile) {
      const entry = resolveHebyWorkspaceEntry(value as string | null | undefined);
      assert.equal(entry.scope, "general", `${JSON.stringify(value)} → general context`);
      assert.equal(entry.route, HEBY_GENERAL_ROUTE, "general context uses the plain Heby route");
      assert.equal(entry.label, "General Hebun workspace", "general label is fixed, never caller text");
      const rendered = [entry.label, entry.route, ...entry.detail].join(" ");
      if (typeof value === "string" && value.trim().length > 0) {
        assert.ok(!rendered.includes(value), "caller-supplied text is never reflected back");
      }
    }
  }

  // 4. The general Heby route resolves EXPLICITLY to the organization-wide Command read models —
  //    an intentional mapping, not an accidental default.
  {
    assert.equal(resolveHebyWorkspace("/heby"), "command", "/heby → organization-wide Command scope");
    assert.equal(resolveHebyWorkspace("/heby/anything"), "command", "sub-routes resolve the same way");
  }

  // 5. `/context` copy is honest: it names the sources, states the limits, and never over-claims.
  {
    for (const hint of [undefined, "operations", "platform", "decisions"]) {
      const entry = resolveHebyWorkspaceEntry(hint);
      const body = entry.detail.join(" ");
      assert.ok(!OVERCLAIM.test(body), `context copy for ${hint ?? "general"} must not over-claim: ${body}`);
      assert.ok(/cannot act, execute, or approve/i.test(body), "context states Heby cannot act");
      assert.ok(entry.detail.length >= 2, "context says more than a bare label");
    }
    assert.ok(
      /not connected to every company system/i.test(resolveHebyWorkspaceEntry(undefined).detail.join(" ")),
      "the general context explicitly denies organization-wide connectivity",
    );
  }

  // 6. Every Heby entry point links into /heby (never a drawer), hinting only a closed identity.
  {
    assert.equal(hebyWorkspaceHref("/operations"), "/heby?from=operations");
    assert.equal(hebyWorkspaceHref("/approvals"), "/heby?from=decisions");
    assert.equal(hebyWorkspaceHref("/command"), "/heby?from=command");
    assert.equal(hebyWorkspaceHref("/heby"), "/heby", "Heby never hints at itself");
    assert.equal(hebyWorkspaceHref("/totally/unknown/route"), "/heby?from=command", "unknown routes fall back");
    // Whatever the pathname, the hint is always one of the known identities.
    for (const path of ["/", "/settings", "/x?y=z", "/operations/deep/link"]) {
      const href = hebyWorkspaceHref(path);
      assert.ok(href.startsWith("/heby"), `${path} → the Heby workspace`);
      const hint = href.includes("?from=") ? href.split("?from=")[1]! : null;
      if (hint) assert.ok((HEBY_WORKSPACE_IDS as readonly string[]).includes(hint), `hint "${hint}" is a known identity`);
    }
  }

  console.log("hw1 context semantics passed");
}

main();
