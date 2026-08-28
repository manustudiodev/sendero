export function publicShareState(share, now) {
  if (!share) return "not_published";
  if (share.status === "revoked") return "revoked";
  if (share.expiresAt <= now) return "expired";
  return "active";
}

export function publicShareOperationFingerprint(operation, args = {}) {
  if (operation === "publish") {
    return JSON.stringify([
      operation,
      args.expectedVersion,
      args.tokenHash,
    ]);
  }
  if (operation === "update") {
    return JSON.stringify([operation, args.expectedVersion]);
  }
  if (operation === "rotate") {
    return JSON.stringify([operation, args.tokenHash]);
  }
  if (operation === "revoke") {
    return JSON.stringify([operation]);
  }
  throw new Error("Unsupported public share operation");
}

export function evaluatePublicShareOperationRetry({
  previous,
  request,
  share,
  now,
}) {
  if (!previous) return { repeated: false };
  if (
    previous.tripId !== request.tripId ||
    previous.operation !== request.operation ||
    previous.tokenHash !== request.tokenHash ||
    previous.requestFingerprint !== request.requestFingerprint
  ) {
    throw new Error(
      "Public share operation ID was already used with different arguments",
    );
  }
  if (previous.resultStatus === "not_published") {
    if (request.operation !== "revoke") {
      throw new Error("Invalid public share operation result");
    }
    return { repeated: true, share: null };
  }
  if (!share || share.generation !== previous.generation) {
    throw new Error(
      "This public share operation was already completed and later superseded",
    );
  }
  if (request.tokenHash && share.tokenHash !== request.tokenHash) {
    throw new Error("This public share token was already rotated");
  }
  const expectedStatus = request.operation === "revoke" ? "revoked" : "active";
  if (
    previous.resultStatus !== expectedStatus ||
    publicShareState(share, now) !== expectedStatus
  ) {
    throw new Error(
      "This public share operation was already completed and is no longer current",
    );
  }
  return { repeated: true, share };
}
