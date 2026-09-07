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

export function getWritableHttpResponse(): HttpResponseLike {
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

  return response;
}

function unavailableError(helper: "cookies" | "headers"): Error {
  return new Error(
    `${helper}() is only available within an HTTP request context`,
  );
}
