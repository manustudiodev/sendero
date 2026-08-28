import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyInvitationEmailError,
  invitationEmailContent,
  isValidEmailAddress,
  sendInvitationEmail,
  validateInvitationUrl,
} from "./email.mjs";

const secureInviteUrl = "https://sendero.example/invite/trip_web_123#opaque-secret-token";

test("validates recipient addresses, invitation roles, and safe invite origins", async () => {
  assert.equal(isValidEmailAddress("amiga@example.com"), true);
  assert.equal(isValidEmailAddress("Sendero <hola@sendero.example>"), true);
  assert.equal(isValidEmailAddress("not-an-email"), false);
  assert.equal(isValidEmailAddress("Sendero\r\nBcc: intruso@example.com <hola@sendero.example>"), false);
  assert.equal(validateInvitationUrl("http://localhost:3000/invite/local#token"), "http://localhost:3000/invite/local#token");
  assert.throws(
    () => validateInvitationUrl("http://sendero.example/invite/trip#token"),
    /debe usar HTTPS/,
  );
  assert.throws(
    () => invitationEmailContent({ inviteUrl: secureInviteUrl, role: "owner" }),
    /viewer o collaborator/,
  );

  let providerCalls = 0;
  await assert.rejects(
    sendInvitationEmail(
      { to: "bad", role: "viewer", inviteUrl: secureInviteUrl },
      { provider: async () => { providerCalls += 1; } },
    ),
    /email de la persona invitada no es válido/,
  );
  assert.equal(providerCalls, 0);
});

test("returns not_configured without making an HTTP request when Resend config is incomplete", async () => {
  let fetchCalls = 0;
  const fetchImpl = async () => {
    fetchCalls += 1;
    throw new Error("must not be called");
  };

  const missingKey = await sendInvitationEmail(
    { to: "amiga@example.com", role: "viewer", inviteUrl: secureInviteUrl },
    { env: { SENDERO_EMAIL_FROM: "Sendero <hola@sendero.example>" }, fetchImpl },
  );
  const missingFrom = await sendInvitationEmail(
    { to: "amiga@example.com", role: "viewer", inviteUrl: secureInviteUrl },
    { env: { RESEND_API_KEY: "re_test_key" }, fetchImpl },
  );
  const invalidFrom = await sendInvitationEmail(
    { to: "amiga@example.com", role: "viewer", inviteUrl: secureInviteUrl },
    {
      env: { RESEND_API_KEY: "re_test_key", SENDERO_EMAIL_FROM: "not-an-email" },
      fetchImpl,
    },
  );
  const missingFetch = await sendInvitationEmail(
    { to: "amiga@example.com", role: "viewer", inviteUrl: secureInviteUrl },
    {
      env: {
        RESEND_API_KEY: "re_test_key",
        SENDERO_EMAIL_FROM: "Sendero <hola@sendero.example>",
      },
      fetchImpl: null,
    },
  );

  assert.deepEqual(missingKey, { status: "not_configured" });
  assert.deepEqual(missingFrom, { status: "not_configured" });
  assert.deepEqual(invalidFrom, { status: "not_configured" });
  assert.deepEqual(missingFetch, { status: "not_configured" });
  assert.equal(fetchCalls, 0);
});

test("uses Resend over HTTP only when both settings are present", async () => {
  const requests = [];
  const result = await sendInvitationEmail(
    {
      to: "amiga@example.com",
      role: "viewer",
      inviteUrl: secureInviteUrl,
      ownerName: "Manuel",
      tripTitle: "Buenos Aires entre amigos",
      idempotencyKey: "invite/sendero-sharing:request-1",
    },
    {
      env: {
        RESEND_API_KEY: "re_test_key",
        SENDERO_EMAIL_FROM: "Sendero <hola@sendero.example>",
      },
      fetchImpl: async (url, init) => {
        requests.push({ url, init });
        return { ok: true, json: async () => ({ id: "email_123" }) };
      },
    },
  );

  assert.deepEqual(result, { status: "sent", id: "email_123" });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://api.resend.com/emails");
  assert.equal(requests[0].init.method, "POST");
  assert.equal(requests[0].init.headers.authorization, "Bearer re_test_key");
  assert.equal(requests[0].init.headers["idempotency-key"], "invite/sendero-sharing:request-1");
  const body = JSON.parse(requests[0].init.body);
  assert.equal(body.from, "Sendero <hola@sendero.example>");
  assert.deepEqual(body.to, ["amiga@example.com"]);
  assert.match(body.subject, /Manuel te invitó a ver Buenos Aires entre amigos/);
  assert.match(body.html, /Ver el itinerario/);
  assert.match(body.html, /opaque-secret-token/);
  assert.match(body.text, /Los viajes se organizan conversando/);
});

test("supports an injected provider and collaborator-friendly Spanish copy", async () => {
  const messages = [];
  const options = [];
  let fetchCalls = 0;
  const result = await sendInvitationEmail(
    {
      to: "colaborador@example.com",
      role: "collaborator",
      inviteUrl: secureInviteUrl,
      ownerName: "Ana & Sol",
      tripTitle: "México <local>",
      idempotencyKey: "resend/sendero-sharing:request-2",
    },
    {
      env: {},
      fetchImpl: async () => { fetchCalls += 1; },
      provider: {
        async send(message, sendOptions) {
          messages.push(message);
          options.push(sendOptions);
          return { id: "custom_1" };
        },
      },
    },
  );

  assert.deepEqual(result, { status: "sent", id: "custom_1" });
  assert.equal(fetchCalls, 0);
  assert.equal(messages.length, 1);
  assert.deepEqual(options, [{ idempotencyKey: "resend/sendero-sharing:request-2" }]);
  assert.match(messages[0].subject, /colaborar en/);
  assert.match(messages[0].text, /ayudar a organizarlo/);
  assert.match(messages[0].html, /Colaborar en el itinerario/);
  assert.match(messages[0].html, /Ana &amp; Sol/);
  assert.match(messages[0].html, /México &lt;local&gt;/);
});

test("provider failures remain owner-friendly and never expose the invitation URL or token", async () => {
  const logged = [];
  const originalError = console.error;
  console.error = (...values) => logged.push(values.join(" "));
  try {
    await assert.rejects(
      sendInvitationEmail(
        { to: "amiga@example.com", role: "viewer", inviteUrl: secureInviteUrl },
        {
          env: {
            RESEND_API_KEY: "re_test_key",
            SENDERO_EMAIL_FROM: "hola@sendero.example",
          },
          fetchImpl: async () => ({
            ok: false,
            status: 422,
            json: async () => ({ message: secureInviteUrl }),
          }),
        },
      ),
      (error) => {
        assert.match(error.message, /No pudimos enviar la invitación/);
        assert.doesNotMatch(error.message, /opaque-secret-token|sendero\.example/);
        return true;
      },
    );
  } finally {
    console.error = originalError;
  }

  assert.deepEqual(logged, []);
});

test("classifies transient provider failures for durable retries", async () => {
  await assert.rejects(
    sendInvitationEmail(
      { to: "amiga@example.com", role: "viewer", inviteUrl: secureInviteUrl },
      {
        env: {
          RESEND_API_KEY: "re_test_key",
          SENDERO_EMAIL_FROM: "hola@sendero.example",
        },
        fetchImpl: async () => ({
          ok: false,
          status: 429,
          headers: { get: (name) => name === "retry-after" ? "45" : null },
        }),
      },
    ),
    (error) => {
      assert.deepEqual(classifyInvitationEmailError(error), {
        code: "provider_http_429",
        retryable: true,
        retryAfterMs: 45_000,
        providerStatus: 429,
      });
      return true;
    },
  );

  await assert.rejects(
    sendInvitationEmail(
      { to: "amiga@example.com", role: "viewer", inviteUrl: secureInviteUrl },
      {
        env: {
          RESEND_API_KEY: "re_test_key",
          SENDERO_EMAIL_FROM: "hola@sendero.example",
        },
        fetchImpl: async () => ({ ok: false, status: 422, headers: { get: () => null } }),
      },
    ),
    (error) => {
      assert.deepEqual(classifyInvitationEmailError(error), {
        code: "provider_http_422",
        retryable: false,
        providerStatus: 422,
      });
      return true;
    },
  );
});
