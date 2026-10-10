import { REQUEST, RESPONSE } from "./request-context.constants.js";
import { RequestContext } from "./request-context.js";

export interface HttpRequestLike {
  headers: Record<string, string | string[] | undefined>;
}

export interface HttpResponseLike {
  headersSent?: boolean;
  appendHeader?(name: string, value: string): unknown;
  getHeader?(name: string): number | string | string[] | undefined;
  setHeader?(name: string, value: string | string[]): unknown;
}

export type WritableHttpResponseLike =
  | {
      appendHeader(name: string, value: string): unknown;
    }
  | {
      getHeader(name: string): number | string | string[] | undefined;
      setHeader(name: string, value: string | string[]): unknown;
    };

/**
 * Returns hTTP request from the active request context.
 * @param helper - HTTP helper whose context is required.
 * @returns HTTP request from the active request context.
 */
export function getHttpRequest(helper: "cookies" | "headers"): HttpRequestLike {
  if (!RequestContext.isActive() || RequestContext.current().type !== "http") {
    throw unavailableError(helper);
  }

  const request = RequestContext.get<HttpRequestLike>(REQUEST);

  if (!request?.headers) {
    throw unavailableError(helper);
  }

  return request;
}

/**
 * Returns hTTP response that can accept cookie header changes.
 * @returns HTTP response that can accept cookie header changes.
 */
export function getWritableHttpResponse(): WritableHttpResponseLike {
  if (!RequestContext.isActive() || RequestContext.current().type !== "http") {
    throw new Error("Cookie writes require a writable HTTP response context");
  }

  const response = RequestContext.get<HttpResponseLike>(RESPONSE);

  if (!response) {
    throw new Error("Cookie writes require a writable HTTP response context");
  }

  if (response.headersSent) {
    throw new Error(
      "Cookie writes are not allowed after response headers have been sent",
    );
  }

  if (
    typeof response.appendHeader !== "function" &&
    (typeof response.getHeader !== "function" ||
      typeof response.setHeader !== "function")
  ) {
    throw new Error("Cookie writes require a writable HTTP response context");
  }

  return response as WritableHttpResponseLike;
}

/**
 * Returns error explaining that the helper requires an HTTP request context.
 * @param helper - HTTP helper whose context is required.
 * @returns Error explaining that the helper requires an HTTP request context.
 */
function unavailableError(helper: "cookies" | "headers"): Error {
  return new Error(
    `${helper}() is only available within an HTTP request context`,
  );
}
