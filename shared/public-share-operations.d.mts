export type PublicShareOperation = "publish" | "update" | "rotate" | "revoke";
export type PublicShareOperationResultStatus =
  "active" | "revoked" | "not_published";
export type PublicShareComputedState =
  "not_published" | "active" | "expired" | "revoked";

export interface PublicShareRetryShare {
  generation: number;
  tokenHash: string;
  status: "active" | "revoked";
  expiresAt: number;
}

export interface PublicShareOperationRecord {
  tripId: string;
  operation: PublicShareOperation;
  tokenHash?: string;
  requestFingerprint: string;
  resultStatus: PublicShareOperationResultStatus;
  generation: number;
}

export interface PublicShareRetryRequest {
  tripId: string;
  operation: PublicShareOperation;
  tokenHash?: string;
  requestFingerprint: string;
}

export function publicShareState(
  share: Pick<PublicShareRetryShare, "status" | "expiresAt"> | null,
  now: number,
): PublicShareComputedState;

export function publicShareOperationFingerprint(
  operation: "publish",
  args: { expectedVersion: number; tokenHash: string; expiresAt: number },
): string;
export function publicShareOperationFingerprint(
  operation: "update",
  args: { expectedVersion: number },
): string;
export function publicShareOperationFingerprint(
  operation: "rotate",
  args: { tokenHash: string },
): string;
export function publicShareOperationFingerprint(
  operation: "revoke",
  args?: Record<string, never>,
): string;

export function evaluatePublicShareOperationRetry<
  TShare extends PublicShareRetryShare,
>(input: {
  previous: PublicShareOperationRecord | null;
  request: PublicShareRetryRequest;
  share: TShare | null;
  now: number;
}): { repeated: false } | { repeated: true; share: TShare | null };
