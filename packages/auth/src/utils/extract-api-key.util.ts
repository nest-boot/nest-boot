import type { Request } from "express";

/** Extracts an API key from a Bearer authorization value. */
export function extractApiKey(
  request: null | Request | undefined,
): null | string {
  if (!request) {
    return null;
  }

  const authorization = request.headers.authorization;

  if (typeof authorization === "string") {
    const [scheme, value] = authorization.split(/\s+/, 2);
    if (scheme?.toLowerCase() === "bearer" && value) {
      return value;
    }
  }
  return null;
}
