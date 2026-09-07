import {
  parseCookie,
  type SerializeOptions,
  stringifyCookie,
  stringifySetCookie,
} from "cookie";

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
export type CookieOptions = SerializeOptions;

/** Attributes used to identify a cookie that should be deleted. */
export type CookieDeleteOptions = Omit<CookieOptions, "expires" | "maxAge">;

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
   * @throws Error when no writable response exists or headers were already sent
   */
  set(name: string, value: string, options?: CookieOptions): void;

  /**
   * Emits an expired `Set-Cookie` response header. The path defaults to `/`.
   *
   * @param name - Cookie name
   * @param options - Attributes identifying the cookie to delete
   * @throws Error when no writable response exists or headers were already sent
   */
  delete(name: string, options?: CookieDeleteOptions): void;

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
    this.entries = Object.entries(parseCookie(header ?? "")).flatMap(
      ([name, value]) => (value === undefined ? [] : [{ name, value }]),
    );
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

  set(name: string, value: string, options: CookieOptions = {}): void {
    appendSetCookie(
      getWritableHttpResponse(),
      stringifySetCookie({ name, value, ...options }),
    );
  }

  delete(name: string, options: CookieDeleteOptions = {}): void {
    appendSetCookie(
      getWritableHttpResponse(),
      stringifySetCookie({
        ...options,
        expires: new Date(0),
        maxAge: 0,
        name,
        path: options.path ?? "/",
        value: "",
      }),
    );
  }

  toString(): string {
    return stringifyCookie(
      Object.fromEntries(this.entries.map(({ name, value }) => [name, value])),
    );
  }
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
