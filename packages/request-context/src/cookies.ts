import { parseCookie, stringifyCookie, stringifySetCookie } from "cookie";

import {
  getHttpRequest,
  getWritableHttpResponse,
  type HttpResponseLike,
} from "./http-context.js";

/** A name/value pair read from the incoming `Cookie` header. */
export interface RequestCookie {
  /** Cookie name. */
  name: string;

  /** Decoded cookie value. */
  value: string;
}

/** Attributes used when emitting a `Set-Cookie` response header. */
export interface CookieOptions {
  /** Domain to which the cookie belongs. */
  domain?: string;

  /** Exact expiration time. Numbers are interpreted as Unix milliseconds. */
  expires?: Date | number;

  /** Prevents client-side JavaScript from reading the cookie. */
  httpOnly?: boolean;

  /** Cookie lifetime in seconds. */
  maxAge?: number;

  /** Enables partitioned cookie storage. */
  partitioned?: boolean;

  /** Cookie path. Defaults to `/`. */
  path?: string;

  /** Cookie eviction priority. */
  priority?: "high" | "low" | "medium";

  /** Same-site cookie policy. */
  sameSite?: boolean | "lax" | "none" | "strict";

  /** Restricts the cookie to secure connections. */
  secure?: boolean;
}

/** A cookie and its response attributes. */
export interface ResponseCookie extends CookieOptions, RequestCookie {}

/** Attributes used to identify a cookie that should be deleted. */
export interface CookieDeleteOptions extends Omit<
  CookieOptions,
  "expires" | "maxAge"
> {
  /** Cookie name. */
  name: string;
}

/**
 * Request-scoped cookie access backed by the incoming request and outgoing
 * response headers.
 */
export interface CookieStore {
  /**
   * Finds one incoming cookie by name.
   *
   * @param name - Cookie name
   * @returns The cookie, or `undefined` when it is absent
   */
  get(name: string): RequestCookie | undefined;

  /**
   * Lists incoming cookies, optionally filtered by name.
   *
   * @param name - Optional cookie name
   * @returns Matching cookies in request-header order
   */
  getAll(name?: string): RequestCookie[];

  /**
   * Checks whether an incoming cookie exists.
   *
   * @param name - Cookie name
   * @returns Whether the cookie exists
   */
  has(name: string): boolean;

  /**
   * Emits a `Set-Cookie` response header without changing the incoming snapshot.
   *
   * @param name - Cookie name
   * @param value - Cookie value
   * @param options - Optional response cookie attributes
   * @returns This cookie store
   * @throws Error when no writable response exists or headers were already sent
   */
  set(name: string, value: string, options?: CookieOptions): this;

  /**
   * Emits a `Set-Cookie` response header from a structured cookie value.
   *
   * @param cookie - Cookie name, value, and response attributes
   * @returns This cookie store
   */
  set(cookie: ResponseCookie): this;

  /**
   * Emits an expired `Set-Cookie` response header. The path defaults to `/`.
   *
   * @param nameOrOptions - Cookie name, or its name and identifying attributes
   * @returns This cookie store
   * @throws Error when no writable response exists or headers were already sent
   */
  delete(nameOrOptions: CookieDeleteOptions | string): this;

  /** @returns The normalized incoming `Cookie` header value. */
  toString(): string;
}

/**
 * Returns a request-scoped cookie store for the current HTTP request.
 * Read operations use a snapshot of the incoming cookies, while write
 * operations append independent `Set-Cookie` values to the current response.
 *
 * @returns A synchronous cookie store for the current request
 * @throws Error when called outside an HTTP request context
 */
export function cookies(): CookieStore {
  const request = getHttpRequest("cookies");
  const cookieHeader = getHeader(request.headers, "cookie");

  return new RequestCookieStore(cookieHeader);
}

class RequestCookieStore implements CookieStore {
  private readonly entries: RequestCookie[];

  constructor(header: string | undefined) {
    this.entries = parseRequestCookies(header);
  }

  get(name: string): RequestCookie | undefined {
    return this.entries.find((cookie) => cookie.name === name);
  }

  getAll(name?: string): RequestCookie[] {
    return name === undefined
      ? [...this.entries]
      : this.entries.filter((cookie) => cookie.name === name);
  }

  has(name: string): boolean {
    return this.entries.some((cookie) => cookie.name === name);
  }

  set(name: string, value: string, options?: CookieOptions): this;
  set(cookie: ResponseCookie): this;
  set(
    nameOrCookie: ResponseCookie | string,
    value?: string,
    options: CookieOptions = {},
  ): this {
    const cookie =
      typeof nameOrCookie === "string"
        ? { name: nameOrCookie, value: value ?? "", ...options }
        : nameOrCookie;

    appendSetCookie(
      getWritableHttpResponse(),
      stringifySetCookie(normalizeResponseCookie(cookie)),
    );

    return this;
  }

  delete(nameOrOptions: CookieDeleteOptions | string): this {
    const { name, ...options } =
      typeof nameOrOptions === "string"
        ? { name: nameOrOptions }
        : nameOrOptions;

    appendSetCookie(
      getWritableHttpResponse(),
      stringifySetCookie({
        ...options,
        expires: new Date(0),
        name,
        path: options.path ?? "/",
        value: "",
      }),
    );

    return this;
  }

  toString(): string {
    return this.entries
      .map(({ name, value }) => stringifyCookie({ [name]: value }))
      .join("; ");
  }
}

function parseRequestCookies(header: string | undefined): RequestCookie[] {
  if (!header) return [];

  return header
    .split(";")
    .flatMap((pair) =>
      Object.entries(parseCookie(pair)).flatMap(([name, value]) =>
        value === undefined ? [] : [{ name, value }],
      ),
    );
}

function normalizeResponseCookie(cookie: ResponseCookie) {
  return {
    ...cookie,
    expires:
      typeof cookie.expires === "number"
        ? new Date(cookie.expires)
        : cookie.expires,
    path: cookie.path ?? "/",
  };
}

function getHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const entry = Object.entries(headers).find(
    ([headerName]) => headerName.toLowerCase() === name,
  );
  const value = entry?.[1];

  return Array.isArray(value) ? value.join("; ") : value;
}

function appendSetCookie(response: HttpResponseLike, value: string): void {
  if (response.appendHeader) {
    response.appendHeader("Set-Cookie", value);
    return;
  }

  if (!response.getHeader || !response.setHeader) {
    throw new Error("Cookie writes require a writable HTTP response context");
  }

  const current = response.getHeader("Set-Cookie");
  const values =
    current === undefined
      ? []
      : Array.isArray(current)
        ? current.map(String)
        : [String(current)];

  response.setHeader("Set-Cookie", [...values, value]);
}
