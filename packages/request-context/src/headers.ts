import type { Request } from "express";

import { REQUEST } from "./request-context.constants.js";
import { RequestContext } from "./request-context.js";

/**
 * Returns Fetch-compatible headers for the current HTTP request.
 *
 * @throws Error when called outside a request context established for HTTP.
 */
export function headers(): Headers {
  const request = RequestContext.isActive()
    ? RequestContext.get<Request>(REQUEST)
    : undefined;

  if (!request) {
    throw new Error(
      "headers() is only available within an HTTP request context",
    );
  }

  const result = new Headers();

  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) result.append(name, item);
    } else if (value !== undefined) {
      result.set(name, value);
    }
  }

  return result;
}
