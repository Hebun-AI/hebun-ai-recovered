/*
 * HEBY-CONVERSATION-CONTINUITY-1 — switching cannot mix conversations, and the new reach is exactly
 * one owner-scoped read.
 *
 *   A. The selection guard: a slow load of A never overwrites B; an answer for A never lands after a
 *      switch or a detach. Proven by simulating out-of-order resolution.
 *   B. The hook: every async completion checks the guard before writing; switching is refused while
 *      busy; the pointer has ONE writer; the URL is touched only by the Full Workspace; foreign and
 *      unknown ids share ONE sentence.
 *   C. The boundaries: the page reads nothing for the deep link; the list read and its component
 *      reach no model, provider or writer.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createConversationSelectionGuard } from "../../src/components/layout/heby/heby-conversation-selection";

const read = (path: string) => readFileSync(path, "utf8");
const HOOK = read("src/components/layout/heby/use-heby-conversation.ts");
const LIST_UI = read("src/components/layout/heby/heby-conversations.tsx");
const LIST_SERVER = read("src/features/heby-answer/list-conversations.server.ts");
const PAGE = read("src/app/(dashboard)/heby/page.tsx");
const WORKSPACE_CLIENT = read("src/components/layout/heby/heby-workspace-client.tsx");
const QUICK_PANEL_CLIENT = read("src/components/layout/heby/heby-quick-panel-client.tsx");

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

/** The hook's pattern, reduced: claim, await, write only if still current. */
function viewModel() {
  const guard = createConversationSelectionGuard();
  let shown: string | null = null;
  const writes: string[] = [];
  return {
    get shown() { return shown; },
    writes,
    select(loaded: Promise<string>) {
      const token = guard.claim();
      return loaded.then((id) => {
        if (!guard.isCurrent(token)) return;
        shown = id;
        writes.push(id);
      });
    },
    detach() {
      guard.claim();
      shown = null;
    },
  };
}

async function main(): Promise<void> {
  /* ── A ───────────────────────────────────────────────────────────────────────────────────── */
  {
    const vm = viewModel();
    const a = deferred<string>();
    const b = deferred<string>();
    const doneA = vm.select(a.promise);
    const doneB = vm.select(b.promise);
    b.resolve("B");
    await doneB;
    a.resolve("A");
    await doneA;
    assert.equal(vm.shown, "B", "the later selection wins although the earlier resolved last");
    assert.deepEqual(vm.writes, ["B"], "the stale load wrote nothing");
  }
  {
    const vm = viewModel();
    const answer = deferred<string>();
    const pending = vm.select(answer.promise);
    vm.detach();
    answer.resolve("A");
    await pending;
    assert.equal(vm.shown, null, "an answer arriving after New conversation does not resurrect the old thread");
    assert.deepEqual(vm.writes, []);
  }
  {
    const vm = viewModel();
    await vm.select(Promise.resolve("A"));
    await vm.select(Promise.resolve("B"));
    assert.deepEqual(vm.writes, ["A", "B"], "in-order selections all apply");
    const guard = createConversationSelectionGuard();
    const t1 = guard.claim();
    assert.ok(guard.isCurrent(t1));
    guard.claim();
    assert.ok(!guard.isCurrent(t1), "a claim makes every earlier token stale");
  }

  /* ── B ───────────────────────────────────────────────────────────────────────────────────── */
  {
    const select = HOOK.slice(HOOK.indexOf("function selectConversation("), HOOK.indexOf("/** Evidence for `/sources`"));
    assert.ok(select.length > 0);
    assert.ok(select.includes("if (asking || reading || id === session.conversationId) return;"), "switching is refused while busy");
    assert.ok(select.includes("const token = selection.claim();"));
    assert.equal((select.match(/selection\.isCurrent\(token\)/g) ?? []).length, 2, "both the result and the failure check the guard");

    const restore = HOOK.slice(HOOK.indexOf("// A deep link outranks"), HOOK.indexOf("THE single detach primitive"));
    assert.ok(restore.includes("const token = selection.claim();"));
    assert.equal((restore.match(/selection\.isCurrent\(token\)/g) ?? []).length, 2, "restore checks the guard on success and failure");
    assert.ok(restore.includes("selection.claim();\n    };"), "leaving a context makes its restore stale");
    assert.ok(restore.includes("const requested = workspace ? requestedConversationId : undefined;"), "only the Full Workspace honours a deep link");

    const detach = HOOK.slice(HOOK.indexOf("const detachConversation"), HOOK.indexOf("function rememberConversation"));
    assert.ok(detach.includes("selection.claim();"), "detach is a selection");

    const ask = HOOK.slice(HOOK.indexOf("askHebyAction({ prompt"), HOOK.indexOf("const turns = useMemo"));
    const claimAt = HOOK.indexOf("const token = selection.claim();\n    try {");
    assert.ok(claimAt > -1 && claimAt < HOOK.indexOf("askHebyAction({ prompt"), "the ask claims before it awaits");
    assert.equal((ask.match(/if \(!selection\.isCurrent\(token\)\) return;/g) ?? []).length, 2, "after the answer AND after the reload");
    assert.ok(ask.indexOf("if (!selection.isCurrent(token)) return;") < ask.indexOf("patch("), "no write before the check");

    assert.equal((HOOK.match(/localStorage\.setItem/g) ?? []).length, 1, "one writer of the pointer");
    const remember = HOOK.slice(HOOK.indexOf("function rememberConversation"), HOOK.indexOf("function selectConversation("));
    assert.ok(remember.includes("localStorage.setItem") && remember.includes("if (workspace) syncConversationParam(id);"));
    assert.equal((HOOK.match(/syncConversationParam\(/g) ?? []).length, 3, "definition + remember + detach");
    assert.ok(HOOK.includes("if (workspace) syncConversationParam(null);"), "the Quick Panel never edits another page's URL");
    assert.ok(HOOK.includes("window.history.replaceState"), "no navigation, no server round trip");

    assert.equal((HOOK.match(/CONVERSATION_UNAVAILABLE/g) ?? []).length, 5, "one sentence for every unavailable conversation");
    assert.ok(!/not-found|unauthorized/.test(HOOK.slice(HOOK.indexOf("function selectConversation("), HOOK.indexOf("/** Evidence for `/sources`"))), "the reason never reaches the operator");

    assert.ok(!QUICK_PANEL_CLIENT.includes("requestedConversationId"), "the Quick Panel takes no deep link");
    assert.ok(WORKSPACE_CLIENT.includes("disabled={conversation.busy}"), "the list is disabled while the seam is busy");
  }

  /* ── C ───────────────────────────────────────────────────────────────────────────────────── */
  {
    assert.ok(PAGE.includes("requestedConversationId={rawConversation || undefined}"));
    const pageImports = [...PAGE.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
    assert.ok(!pageImports.some((m) => /heby-conversation|heby-answer|heby\/actions/.test(m)), "the page imports no conversation read");
    assert.ok(!/loadHebyConversation(Action)?\(|listOwnedConversations\(|getConversation\(/.test(PAGE), "the page reads nothing for the deep link");

    const listImports = [...LIST_SERVER.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(listImports, ["@/features/auth/tenant/tenant-context", "@/features/heby-conversation/durable-conversation-repository.server"], "the list read imports only the session type and the conversation authority");
    assert.ok(LIST_SERVER.includes("{ tenantId: tenant.tenantId, actorId: tenant.userId }"), "scope comes from the session");

    const uiImports = [...LIST_UI.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(uiImports, ["react", "lucide-react", "@/app/(dashboard)/heby/actions"]);
    assert.ok(/import \{ listHebyConversationsAction, type ListConversationsResult \} from "@\/app\/\(dashboard\)\/heby\/actions";/.test(LIST_UI), "the component reaches only the list action");
    assert.ok(!/localStorage|askHebyAction|loadHebyConversationAction|dangerouslySetInnerHTML/.test(LIST_UI));
    assert.ok(LIST_UI.includes("disabled={props.disabled || current}"));
    for (const word of ["content", "summary", "preview"]) {
      assert.ok(!new RegExp(`item\\.${word}`).test(LIST_UI), `the list renders no ${word}`);
    }
  }

  /*
   * ── D: the action module loads ──────────────────────────────────────────────────────────────
   * Found in local browser acceptance, missed by tsc and `next build`: a bare `export type { X };` in a
   * "use server" module is emitted as a runtime export, and EVERY Heby action then fails with
   * "X is not defined". Type re-exports there must carry their `from`.
   */
  for (const file of ["actions.ts", "ai-plan-actions.ts", "knowledge-origination-actions.ts", "origination-availability-actions.ts", "request-lifecycle-actions.ts", "work-state-origination-actions.ts"]) {
    const src = read(`src/app/(dashboard)/heby/${file}`);
    const code = src.split("\n").filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line)).join("\n");
    assert.ok(!/^export\s+type\s*\{[^}]*\}\s*;/m.test(code), `${file}: no bare type re-export in a "use server" module`);
  }

  console.log("heby-conversation-continuity-1 selection + wiring checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
