import assert from "node:assert/strict";
import test from "node:test";
import {
  createInvitationToken,
  deriveInvitationToken,
  hashInvitationToken,
  invitationLink,
  isValidInvitationToken,
  tokenHashMatches,
  deliverInvitationEmailOutboxJob,
  invitationEmailIdempotencyKey,
} from "./invitations.mjs";

const pepper = "sendero-invitation-test-pepper-at-least-thirty-two-bytes";

function durableTokenHash({
  tripId = "trip_123",
  email = "friend@example.com",
  operationId = "invite-operation-123",
  purpose = "invite",
} = {}) {
  return hashInvitationToken(
    deriveInvitationToken({ pepper, tripId, email, operationId, purpose }),
    pepper,
  );
}

test("creates a 256-bit opaque invitation token and stores only its keyed hash", () => {
  const invitation = createInvitationToken({
    pepper,
    randomBytes: (size) => Buffer.alloc(size, 11),
  });
  assert.equal(isValidInvitationToken(invitation.token), true);
  assert.equal(invitation.token.length, 43);
  assert.equal(invitation.tokenHash, hashInvitationToken(invitation.token, pepper));
  assert.doesNotMatch(invitation.tokenHash, new RegExp(invitation.token));
});

test("places the bearer token in the fragment so it is absent from the HTTP request URL", () => {
  const { token } = createInvitationToken({
    pepper,
    randomBytes: (size) => Buffer.alloc(size, 19),
  });
  const href = invitationLink({
    publicWebUrl: "https://sendero.example",
    webId: "trip_web_1234567890",
    token,
  });
  const link = new URL(href);
  assert.equal(link.pathname, "/invite/trip_web_1234567890");
  assert.equal(link.search, "");
  assert.equal(link.hash, `#token=${token}`);
  assert.doesNotMatch(`${link.origin}${link.pathname}${link.search}`, new RegExp(token));
});

test("rejects malformed tokens, insecure public origins, and short secrets", () => {
  assert.equal(isValidInvitationToken("too-short"), false);
  assert.throws(() => hashInvitationToken("too-short", pepper), /Invalid Sendero/);
  assert.throws(
    () => createInvitationToken({ pepper: "short" }),
    /must contain at least 32 bytes/,
  );
  const { token } = createInvitationToken({
    pepper,
    randomBytes: (size) => Buffer.alloc(size, 5),
  });
  assert.throws(
    () => invitationLink({ publicWebUrl: "http://sendero.example", webId: "trip_web_1234567890", token }),
    /must use HTTPS/,
  );
});

test("compares stored hashes without early string comparison", () => {
  const left = hashInvitationToken(
    createInvitationToken({ pepper, randomBytes: (size) => Buffer.alloc(size, 1) }).token,
    pepper,
  );
  assert.equal(tokenHashMatches(left, left), true);
  assert.equal(tokenHashMatches(left, `${left}x`), false);
});

test("derives stable invitation tokens for idempotent invite and resend operations", () => {
  const input = {
    pepper,
    tripId: "trip_123",
    email: " Friend@Example.com ",
    operationId: "invite-operation-123",
  };
  const first = deriveInvitationToken(input);
  const replay = deriveInvitationToken(input);
  const resend = deriveInvitationToken({ ...input, purpose: "resend" });
  assert.equal(first, replay);
  assert.equal(isValidInvitationToken(first), true);
  assert.notEqual(first, resend);
});

test("materializes a durable outbox job without persisting the bearer token", async () => {
  const sent = [];
  const job = {
    tripId: "trip_123",
    webId: "trip_web_1234567890",
    operationId: "invite-operation-123",
    idempotencyKey: invitationEmailIdempotencyKey({
      purpose: "invite",
      actorId: "user_owner",
      tripId: "trip_123",
      operationId: "invite-operation-123",
    }),
    purpose: "invite",
    recipientEmail: "friend@example.com",
    role: "editor",
    tokenHash: durableTokenHash(),
    invitationSentAt: 100,
    ownerName: "Manuel",
    tripTitle: "Buenos Aires entre amigos",
  };
  const result = await deliverInvitationEmailOutboxJob(job, {
    pepper,
    publicWebUrl: "https://sendero.example",
    async send(message) {
      sent.push(message);
      return { status: "sent", id: "email_123" };
    },
  });

  assert.deepEqual(result, {
    outcome: "sent",
    provider: "resend",
    providerMessageId: "email_123",
  });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].role, "collaborator");
  assert.equal(sent[0].idempotencyKey, "invite/user_owner/trip_123/invite-operation-123");
  assert.match(sent[0].inviteUrl, /#token=/);
  assert.equal("token" in job, false);
});

test("normalizes missing configuration and retryable provider failures", async () => {
  const job = {
    tripId: "trip_123",
    webId: "trip_web_1234567890",
    operationId: "invite-operation-123",
    idempotencyKey: "invite/user_owner/trip_123/invite-operation-123",
    purpose: "invite",
    recipientEmail: "friend@example.com",
    role: "viewer",
    tokenHash: durableTokenHash(),
    invitationSentAt: 100,
  };
  assert.deepEqual(
    await deliverInvitationEmailOutboxJob(job, {
      publicWebUrl: "https://sendero.example",
    }),
    { outcome: "not_configured", errorCode: "sendero_email_config_missing" },
  );
  assert.deepEqual(
    await deliverInvitationEmailOutboxJob(job, {
      pepper: "short",
      publicWebUrl: "https://sendero.example",
    }),
    { outcome: "not_configured", errorCode: "sendero_email_config_invalid" },
  );
  assert.deepEqual(
    await deliverInvitationEmailOutboxJob(job, {
      pepper,
      publicWebUrl: "http://sendero.example",
    }),
    { outcome: "not_configured", errorCode: "sendero_email_config_invalid" },
  );
  assert.deepEqual(
    await deliverInvitationEmailOutboxJob(job, {
      pepper,
      publicWebUrl: "https://sendero.example",
      async send() {
        return { status: "unexpected" };
      },
    }),
    { outcome: "retry", errorCode: "provider_invalid_result" },
  );
});
