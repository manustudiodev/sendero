import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluatePublicShareOperationRetry,
  publicShareOperationFingerprint,
} from "../shared/public-share-operations.mjs";

const NOW = 1_800_000_000_000;
const TOKEN_A = "a".repeat(43);
const TOKEN_B = "b".repeat(43);

function operationArgs(operation) {
  if (operation === "publish") {
    return {
      expectedVersion: 3,
      tokenHash: TOKEN_A,
      expiresAt: NOW + 30 * 24 * 60 * 60 * 1000,
    };
  }
  if (operation === "update") return { expectedVersion: 3 };
  if (operation === "rotate") return { tokenHash: TOKEN_B };
  return {};
}

function retryFixture(
  operation,
  {
    generation = 2,
    resultStatus = operation === "revoke" ? "revoked" : "active",
    shareStatus = operation === "revoke" ? "revoked" : "active",
    expiresAt = NOW + 60_000,
  } = {},
) {
  const args = operationArgs(operation);
  const requestFingerprint = publicShareOperationFingerprint(operation, args);
  const tokenHash =
    operation === "publish" || operation === "rotate"
      ? args.tokenHash
      : undefined;
  return {
    previous: {
      tripId: "trip_1",
      operation,
      ...(tokenHash ? { tokenHash } : {}),
      requestFingerprint,
      resultStatus,
      generation,
    },
    request: {
      tripId: "trip_1",
      operation,
      ...(tokenHash ? { tokenHash } : {}),
      requestFingerprint,
    },
    share: {
      generation,
      tokenHash: tokenHash || TOKEN_A,
      status: shareStatus,
      expiresAt,
    },
    now: NOW,
  };
}

test("an exact publish retry succeeds while the share remains active", () => {
  const fixture = retryFixture("publish");
  assert.deepEqual(evaluatePublicShareOperationRetry(fixture), {
    repeated: true,
    share: fixture.share,
  });
});

test("a publish retry keeps the first expiry when the server clock advances", () => {
  const fixture = retryFixture("publish");
  fixture.request.requestFingerprint = publicShareOperationFingerprint(
    "publish",
    {
      ...operationArgs("publish"),
      expiresAt: operationArgs("publish").expiresAt + 1,
    },
  );
  assert.deepEqual(evaluatePublicShareOperationRetry(fixture), {
    repeated: true,
    share: fixture.share,
  });
});

test("a reused publish operation ID still rejects a different token", () => {
  const fixture = retryFixture("publish");
  fixture.request.tokenHash = TOKEN_B;
  fixture.request.requestFingerprint = publicShareOperationFingerprint(
    "publish",
    { ...operationArgs("publish"), tokenHash: TOKEN_B },
  );
  assert.throws(() => evaluatePublicShareOperationRetry(fixture), /different arguments/);
});

for (const operation of ["publish", "update", "rotate"]) {
  test(`${operation} retry fails after revocation`, () => {
    const fixture = retryFixture(operation, { shareStatus: "revoked" });
    assert.throws(
      () => evaluatePublicShareOperationRetry(fixture),
      /no longer current/,
    );
  });

  test(`${operation} retry fails after expiration`, () => {
    const fixture = retryFixture(operation, { expiresAt: NOW });
    assert.throws(
      () => evaluatePublicShareOperationRetry(fixture),
      /no longer current/,
    );
  });
}

test("an exact revoke retry succeeds only while the share remains revoked", () => {
  const fixture = retryFixture("revoke");
  assert.deepEqual(evaluatePublicShareOperationRetry(fixture), {
    repeated: true,
    share: fixture.share,
  });
  fixture.share.status = "active";
  assert.throws(
    () => evaluatePublicShareOperationRetry(fixture),
    /no longer current/,
  );
});

test("a no-op revoke remains a no-op after a later publication", () => {
  const fixture = retryFixture("revoke", {
    generation: 0,
    resultStatus: "not_published",
  });
  fixture.share = {
    generation: 1,
    tokenHash: TOKEN_A,
    status: "active",
    expiresAt: NOW + 60_000,
  };
  assert.deepEqual(evaluatePublicShareOperationRetry(fixture), {
    repeated: true,
    share: null,
  });
});

test("a retry fails after its recorded generation is superseded", () => {
  const fixture = retryFixture("publish");
  fixture.share.generation += 1;
  assert.throws(
    () => evaluatePublicShareOperationRetry(fixture),
    /later superseded/,
  );
});
