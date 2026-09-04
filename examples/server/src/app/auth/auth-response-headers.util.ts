import type { Response } from 'express';

/** Appends transport headers produced by authentication operations. */
export function applyAuthResponseHeaders(
  response: Response,
  headers: Headers,
): void {
  const cookies = headers.getSetCookie();

  if (cookies.length > 0) response.append('set-cookie', cookies);
}
