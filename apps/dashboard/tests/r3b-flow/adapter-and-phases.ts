/*
 * R3B — the adapter seam, the transport PHASE classifier, and the registry.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "The transport can tell a request that never left from one that may already have arrived, it
 *    never calls a provider without a credential, a sender and a subject, it never retries, it
 *    never leaks the credential into an error — and exactly one adapter exists."
 *
 * EVERY FETCH IS INJECTED. `globalThis.fetch` is never reached: every case supplies its own
 * `fetchImpl`, including the registry cases, so no socket is opened by this file even though the
 * host is now the real Resend constant rather than a `.invalid` name from a test environment.
 *
 * The Resend WIRE MAPPING is proved next door in `resend-mapping.ts`; this file stays about the
 * seam, the phases and the registry.
 */
import assert from "node:assert/strict";
import {
  classifyResponse,
  classifyTransportError,
  createResendEmailTransport,
  extractErrorCode,
  isExternalSendCredentialPresent,
  resolveExternalSendSender,
  resolveExternalSendSubject,
  RESEND_ADAPTER_ID,
  RESEND_SEND_ENDPOINT,
} from "../../src/features/action-execution-live/resend-email-transport.server";
import {
  checkAdapterAvailability,
  listExternalSendAdapters,
  resolveExternalSendAdapter,
} from "../../src/features/action-execution/adapter-registry.server";
import { ADAPTER_SANDBOX_BOUNDARY } from "../../src/features/action-execution/adapter-contract";
import { EXECUTION_RETRY_POLICY } from "../../src/features/action-execution/contracts";

/*
 * A fully-armed environment, for the availability cases only. No value here is real, and no case
 * in this file dials the host: `RESEND_SEND_ENDPOINT` is now a frozen constant rather than
 * something a test env could point at a `.invalid` name, so every case injects `fetchImpl`.
 */
const ARMED = Object.freeze({
  HEBUN_EXTERNAL_SEND_API_KEY: "test-key-never-real",
  HEBUN_EXTERNAL_SEND_FROM: "nobody@example.invalid",
  HEBUN_EXTERNAL_SEND_SUBJECT: "Test subject, never configured for real",
});

/** A fetch that must never be called. Reaching it is the failure. */
const forbiddenFetch = () => {
  throw new Error("no network call may happen in this test");
};

function nodeError(code: string): Error {
  const outer = new TypeError("fetch failed");
  (outer as { cause?: unknown }).cause = Object.assign(new Error("inner"), { code });
  return outer;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. THE PHASE CLASSIFIER — the release-critical divergence from the Claude
 *    transport, which maps every non-abort throw to one generic error.
 * ═════════════════════════════════════════════════════════════════════════ */
function phaseClassification(): void {
  /* PROVABLY pre-write. The connection never came up, so no external effect is possible. */
  for (const code of [
    "ENOTFOUND",
    "EAI_AGAIN",
    "ECONNREFUSED",
    "EHOSTUNREACH",
    "ENETUNREACH",
    "CERT_HAS_EXPIRED",
    "DEPTH_ZERO_SELF_SIGNED_CERT",
    "SELF_SIGNED_CERT_IN_CHAIN",
    "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    "ERR_TLS_CERT_ALTNAME_INVALID",
  ]) {
    assert.equal(
      classifyTransportError(nodeError(code)),
      "unreachable",
      `${code} establishes that nothing was transmitted`,
    );
  }

  /*
   * THE DANGEROUS ONES. Each can occur AFTER the request body was written, so calling any of them
   * a clean failure would report a possible send as a non-send and invite a double send.
   */
  for (const code of ["ECONNRESET", "EPIPE", "ETIMEDOUT", "UNKNOWN_CODE"]) {
    assert.equal(
      classifyTransportError(nodeError(code)),
      "ambiguous",
      `${code} can happen after the write and must stay ambiguous`,
    );
  }

  /* Our own timeout. The request was already dispatched; the provider may hold it. */
  const abort = new Error("aborted");
  abort.name = "AbortError";
  assert.equal(classifyTransportError(abort), "ambiguous", "a timeout is never 'unreachable'");

  /* An error with no code at all defaults to the safe side. */
  assert.equal(classifyTransportError(new Error("mystery")), "ambiguous");
  assert.equal(classifyTransportError(null), "ambiguous");

  /* The cause walk is bounded, so a cyclic cause cannot hang the classifier. */
  const cyclic: { cause?: unknown } = {};
  cyclic.cause = cyclic;
  assert.equal(extractErrorCode(cyclic), null);
  assert.equal(classifyTransportError(cyclic), "ambiguous");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. RESPONSE CLASSIFICATION — acceptance requires an id, and 5xx is ambiguous.
 * ═════════════════════════════════════════════════════════════════════════ */
function responseClassification(): void {
  assert.deepEqual(classifyResponse(200, { id: "abc" }), {
    class: "accepted",
    providerMessageId: "abc",
  });
  assert.deepEqual(classifyResponse(200, { id: "  xyz  " }), {
    class: "accepted",
    providerMessageId: "xyz",
  });

  /*
   * ONLY `id`. Resend documents `{"id": "…"}` and sends nothing else; before a vendor was chosen
   * the classifier also honoured `messageId`, and keeping that would mean claiming ACCEPTED on a
   * shape the selected provider never returns.
   */
  assert.deepEqual(
    classifyResponse(200, { messageId: "xyz" }),
    { class: "ambiguous" },
    "a key Resend never sends must not be read as acceptance",
  );

  /* 2xx WITHOUT an id is NOT acceptance: nothing could reconcile it later. */
  for (const body of [{}, null, { id: "" }, { id: "   " }, { id: 42 }]) {
    assert.deepEqual(
      classifyResponse(200, body),
      { class: "ambiguous" },
      "a success with no usable message id is ambiguous, never accepted",
    );
  }

  /* 4xx — the provider answered and declined. Nothing was sent. */
  for (const status of [400, 401, 403, 404, 422, 429]) {
    assert.deepEqual(classifyResponse(status, { error: "no" }), { class: "rejected" });
  }

  /*
   * 409 is Resend's answer to BOTH "same key, different payload" and "same key already in flight".
   * As a 4xx it reads as `rejected` — nothing was sent — which is true for the first and would be
   * a lie for the second. Hebun is safe structurally, not by luck: one handoff is minted per spend
   * and two unique indexes forbid a second attempt on it, so it can never race itself.
   */
  assert.deepEqual(classifyResponse(409, { message: "duplicate idempotency key" }), {
    class: "rejected",
  });

  /* 5xx — a server error may follow an accept. */
  for (const status of [500, 502, 503, 504]) {
    assert.deepEqual(
      classifyResponse(status, {}),
      { class: "ambiguous" },
      "a server error cannot prove the request was not accepted",
    );
  }

  /* A message id is never invented from a rejection body. */
  assert.deepEqual(classifyResponse(400, { id: "looks-real" }), { class: "rejected" });
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. THE TRANSPORT ITSELF — construction gates, one call, redacted errors.
 * ═════════════════════════════════════════════════════════════════════════ */
async function transportBehaviour(): Promise<void> {
  /*
   * Construction refuses before any I/O, and it now takes THREE deployment values. The old
   * https/plaintext gates are gone because the URL is gone: there is no `endpointUrl` argument to
   * downgrade any more, which is a stronger guarantee than validating one.
   */
  assert.equal(RESEND_SEND_ENDPOINT, "https://api.resend.com/emails");
  assert.throws(
    () => createResendEmailTransport({ apiKey: "", sender: "a@b.co", subject: "s", fetchImpl: forbiddenFetch }),
    /credential/i,
    "no credential, no transport",
  );
  assert.throws(
    () => createResendEmailTransport({ apiKey: "k", sender: "   ", subject: "s", fetchImpl: forbiddenFetch }),
    /sender/i,
    "no sender, no transport",
  );
  assert.throws(
    () => createResendEmailTransport({ apiKey: "k", sender: "a@b.co", subject: "", fetchImpl: forbiddenFetch }),
    /subject/i,
    "no subject, no transport — and it is never defaulted to something friendly",
  );

  /* One send → exactly one fetch. No retry, no backoff, no second attempt. */
  {
    let calls = 0;
    const transport = createResendEmailTransport({
      apiKey: "secret-key-value",
      sender: "sender@example.invalid",
      subject: "Fixed deployment subject",
      fetchImpl: async (url, init) => {
        calls += 1;
        assert.equal(url, RESEND_SEND_ENDPOINT, "the host is the frozen Resend constant");
        assert.equal(init.method, "POST");
        /* THE PROVIDER-VISIBLE IDEMPOTENCY KEY is a HEADER for Resend, and only a header. */
        assert.equal(init.headers["Idempotency-Key"], "handoff-123");
        assert.ok(
          !init.body.includes("handoff-123"),
          "the wire body carries no second copy of the idempotency key",
        );
        assert.ok(init.signal, "a hard timeout is always armed");
        return { ok: true, status: 200, json: async () => ({ id: "prov-1" }) };
      },
    });
    const outcome = await transport.send({
      endpointKind: "email",
      endpoint: "someone@example.com",
      content: "body",
      idempotencyKey: "handoff-123",
    });
    assert.deepEqual(outcome, { class: "accepted", providerMessageId: "prov-1" });
    assert.equal(calls, 1, "exactly one network call per send — no automatic retry");
    assert.equal(transport.adapterId, RESEND_ADAPTER_ID);
  }

  /* A thrown transport error becomes a phase, and the raw error never escapes. */
  {
    const transport = createResendEmailTransport({
      apiKey: "secret-key-value",
      sender: "sender@example.invalid",
      subject: "Fixed deployment subject",
      fetchImpl: async () => {
        throw nodeError("ECONNREFUSED");
      },
    });
    const outcome = await transport.send({
      endpointKind: "email",
      endpoint: "someone@example.com",
      content: "body",
      idempotencyKey: "h",
    });
    assert.deepEqual(outcome, { class: "unreachable" });
  }
  {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    const transport = createResendEmailTransport({
      apiKey: "secret-key-value",
      sender: "sender@example.invalid",
      subject: "Fixed deployment subject",
      fetchImpl: async () => {
        throw abort;
      },
    });
    assert.deepEqual(
      await transport.send({ endpointKind: "email", endpoint: "a@b.co", content: "c", idempotencyKey: "h" }),
      { class: "ambiguous" },
      "a timeout after dispatch is UNKNOWN territory, not a failure",
    );
  }

  /* An unreadable body: a 2xx stays ambiguous, a 4xx is still a rejection. */
  {
    const make = (status: number) =>
      createResendEmailTransport({
        apiKey: "k",
        sender: "sender@example.invalid",
        subject: "Fixed deployment subject",
        fetchImpl: async () => ({
          ok: status < 400,
          status,
          json: async () => {
            throw new Error("not json");
          },
        }),
      });
    assert.deepEqual(
      await make(200).send({ endpointKind: "email", endpoint: "a@b.co", content: "c", idempotencyKey: "h" }),
      { class: "ambiguous" },
    );
    assert.deepEqual(
      await make(400).send({ endpointKind: "email", endpoint: "a@b.co", content: "c", idempotencyKey: "h" }),
      { class: "rejected" },
    );
  }

  /* THE CREDENTIAL NEVER APPEARS IN A RETURNED VALUE. */
  {
    const transport = createResendEmailTransport({
      apiKey: "super-secret-do-not-leak",
      sender: "sender@example.invalid",
      subject: "Fixed deployment subject",
      fetchImpl: async () => {
        throw nodeError("ECONNRESET");
      },
    });
    const outcome = await transport.send({
      endpointKind: "email",
      endpoint: "a@b.co",
      content: "c",
      idempotencyKey: "h",
    });
    assert.ok(
      !JSON.stringify(outcome).includes("super-secret-do-not-leak"),
      "an outcome never carries the credential",
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. PRESENCE CHECKS AND THE REGISTRY.
 * ═════════════════════════════════════════════════════════════════════════ */
function registryAndPresence(): void {
  /* Presence only — never the value. */
  assert.equal(isExternalSendCredentialPresent({}), false);
  assert.equal(isExternalSendCredentialPresent({ HEBUN_EXTERNAL_SEND_API_KEY: "   " }), false);
  assert.equal(isExternalSendCredentialPresent(ARMED), true);

  /* The sender and the subject resolve the same way, and neither is ever defaulted. */
  assert.equal(resolveExternalSendSender({}), null);
  assert.equal(resolveExternalSendSender({ HEBUN_EXTERNAL_SEND_FROM: "   " }), null);
  assert.equal(resolveExternalSendSender(ARMED), ARMED.HEBUN_EXTERNAL_SEND_FROM);
  assert.equal(resolveExternalSendSubject({}), null);
  assert.equal(resolveExternalSendSubject({ HEBUN_EXTERNAL_SEND_SUBJECT: "  " }), null);
  assert.equal(resolveExternalSendSubject(ARMED), ARMED.HEBUN_EXTERNAL_SEND_SUBJECT);

  /* EXACTLY ONE ADAPTER. The scope of this generation, asserted rather than assumed. */
  const adapters = listExternalSendAdapters();
  assert.equal(adapters.length, 1, "exactly one execution adapter exists");
  assert.equal(adapters[0]!.endpointKind, "email");
  assert.equal(adapters[0]!.adapterId, RESEND_ADAPTER_ID);
  /* The descriptor states the host instead of naming a variable that could redirect it. */
  assert.equal(adapters[0]!.providerEndpoint, RESEND_SEND_ENDPOINT);

  /*
   * Availability distinguishes "no channel" from "not armed" — different fixes.
   *
   * REPAIRED FOR RESEND: an empty environment used to answer `adapter-unavailable`, because the
   * unset endpoint variable meant Hebun could not reach the channel at all. With the host frozen
   * in code the channel IS reachable and only arming is missing, so the honest answer is now
   * `credential-unavailable` — and each of the three required values must produce it alone.
   */
  assert.equal(checkAdapterAvailability("email", { env: {} }), "credential-unavailable");
  for (const missing of [
    "HEBUN_EXTERNAL_SEND_API_KEY",
    "HEBUN_EXTERNAL_SEND_FROM",
    "HEBUN_EXTERNAL_SEND_SUBJECT",
  ] as const) {
    const partial: Record<string, string> = { ...ARMED };
    delete partial[missing];
    assert.equal(
      checkAdapterAvailability("email", { env: partial }),
      "credential-unavailable",
      `${missing} alone must be enough to keep the adapter unavailable`,
    );
    assert.equal(
      resolveExternalSendAdapter("email", { env: partial, fetchImpl: forbiddenFetch }),
      null,
      `${missing} alone must be enough to produce no adapter`,
    );
  }
  assert.equal(checkAdapterAvailability("email", { env: ARMED }), null);

  /* THE DEFAULT POSTURE IS DISARMED: this repository's own environment produces no adapter. */
  assert.equal(
    resolveExternalSendAdapter("email", { env: {} }),
    null,
    "with no deployment configuration there is no adapter at all",
  );
  assert.equal(
    checkAdapterAvailability("email", { env: process.env }),
    "credential-unavailable",
    "the ambient environment must not be armed — the vendor is chosen, nothing is configured",
  );
  assert.equal(
    resolveExternalSendAdapter("email", { env: process.env, fetchImpl: forbiddenFetch }),
    null,
    "the real environment must not yield an adapter",
  );

  /* An armed environment produces a constructed adapter, with an injected fetch. */
  const armed = resolveExternalSendAdapter("email", { env: ARMED, fetchImpl: forbiddenFetch });
  assert.ok(armed, "an armed environment yields exactly one adapter");
  assert.equal(armed!.adapterId, RESEND_ADAPTER_ID);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. THE DECLARED BOUNDARIES ARE VALUES, NOT PROSE.
 * ═════════════════════════════════════════════════════════════════════════ */
function declaredBoundaries(): void {
  assert.equal(EXECUTION_RETRY_POLICY.automaticRetries, 0);
  assert.equal(EXECUTION_RETRY_POLICY.retriesUnknownOutcomes, false);
  assert.equal(EXECUTION_RETRY_POLICY.requiresNewDecisionToRetry, true);

  for (const phrase of [
    "exactly one action kind may execute",
    "exactly one adapter is registered",
    "the provider host is a frozen constant, not configuration, not a record, not a model",
    "the sender and the subject come from deployment configuration, never from a record or a model",
    "no arbitrary URL, no arbitrary code, no dynamic adapter loading",
    "no shell, no filesystem, no browser, no device, no agent",
    "one hard timeout, and zero automatic retries",
  ]) {
    assert.ok(
      ADAPTER_SANDBOX_BOUNDARY.includes(phrase),
      `the declared sandbox must state: ${phrase}`,
    );
  }
}

async function main(): Promise<void> {
  phaseClassification();
  responseClassification();
  await transportBehaviour();
  registryAndPresence();
  declaredBoundaries();
  console.log("R3B adapter and phases: all assertions passed.");
}

void main();
