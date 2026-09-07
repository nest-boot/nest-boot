import { getHttpRequest } from "./http-context.js";

/**
 * Returns a Fetch-compatible snapshot of the current HTTP request headers.
 * Mutating the returned object does not change the incoming request.
 *
 * @returns A new Fetch-compatible `Headers` instance
 * @throws Error when called outside an HTTP request context
 */
export function headers(): Headers {
  const request = getHttpRequest("headers");
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
