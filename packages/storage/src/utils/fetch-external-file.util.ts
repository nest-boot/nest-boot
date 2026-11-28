import { lookup as dnsLookup } from "node:dns/promises";
import {
  type ClientRequest,
  type IncomingMessage,
  request as httpRequest,
} from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { type Readable, Transform } from "node:stream";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";

import { BadRequestException } from "@nestjs/common";
import picomatch from "picomatch";

import { type StorageSsrfOptions } from "../interfaces/storage-ssrf-options.interface.js";
import { linkedAbortController } from "./storage-stream.util.js";

const DEFAULT_MAX_FILE_SIZE = 100 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;
const ENCODED_FRAMING_OVERHEAD_BYTES = 1024;
const MAX_REDIRECTS = 5;

/** Resolved DNS address record returned by lookup functions. */
export interface ResolvedHostAddress {
  /** IPv4 or IPv6 address literal. */
  address: string;
  /** IP family (`4` or `6`). */
  family: number;
}

/** Function signature used to resolve a hostname to all IP addresses. */
export type HostLookupFn = (hostname: string) => Promise<ResolvedHostAddress[]>;

/** Precompiled SSRF policy evaluated on each outbound request and redirect hop. */
export interface CompiledSsrfPolicy {
  /** Whether private, loopback, link-local, and reserved IP blocking is active. */
  enabled: boolean;
  /** Returns true when a bare hostname or IP literal matches `ssrf.allowedHosts`. */
  isAllowedHost: (bareHostname: string) => boolean;
}

/** Options for {@link fetchExternalFile}. */
export interface FetchExternalFileOptions {
  /** Maximum response body size in bytes. Defaults to 100 MiB. */
  maxFileSize?: number;
  /** Total fetch deadline in milliseconds covering DNS, redirects, and body streaming. Defaults to 30,000 ms. */
  timeout?: number;
  /** Optional upstream abort signal. */
  signal?: AbortSignal;
  /** SSRF policy configuration or precompiled policy. */
  ssrf?: StorageSsrfOptions | CompiledSsrfPolicy;
  /**
   * Optional callback invoked once final 2xx headers arrive to validate MIME type and
   * compute the exact byte-size ceiling for the response stream.
   */
  resolveMaxFileSize?: (metadata: {
    contentType?: string;
    pathname: string;
  }) => number;
  /** Custom DNS resolver override used in unit tests. */
  lookupFn?: HostLookupFn;
}

/** Stream and metadata returned by {@link fetchExternalFile}. */
export interface FetchedExternalFile {
  /** Size-bounded readable stream of the remote file body. */
  stream: Readable;
  /** Normalized MIME type from `Content-Type` response header, when present. */
  contentType?: string;
  /** Final URL pathname after following any HTTP redirects. */
  pathname: string;
}

/**
 * Compiles and validates SSRF protection options into a reusable matcher.
 * @param ssrf - Optional SSRF module configuration.
 * @returns Precompiled SSRF policy.
 */
export function compileSsrfPolicy(
  ssrf: StorageSsrfOptions = {},
): CompiledSsrfPolicy {
  const enabled = ssrf.enabled ?? true;
  const rawHosts = ssrf.allowedHosts ?? [];
  const normalizedHosts = rawHosts.map((entry) => {
    const trimmed = typeof entry === "string" ? entry.trim().toLowerCase() : "";
    const unbracketed =
      trimmed.startsWith("[") && trimmed.endsWith("]")
        ? trimmed.slice(1, -1)
        : trimmed;
    if (!unbracketed || unbracketed.includes("/")) {
      throw new Error(
        "Storage SSRF allowedHosts entries must be non-empty host or IP patterns",
      );
    }
    if (unbracketed.startsWith("!")) {
      throw new Error(
        "Storage SSRF allowedHosts entries must not use negation",
      );
    }
    return unbracketed;
  });

  const matcher =
    normalizedHosts.length > 0
      ? picomatch(normalizedHosts, { nocase: true, nonegate: true })
      : undefined;

  return {
    enabled,
    isAllowedHost: (bareHostname: string) =>
      matcher ? matcher(bareHostname.toLowerCase()) : false,
  };
}

/**
 * Checks whether an IPv4 or IPv6 literal belongs to a loopback, private, link-local, or reserved range.
 * @param address - IPv4 or IPv6 address string.
 * @returns True when outbound SSRF policy forbids connecting to the address.
 */
export function isPrivateOrReservedIp(address: string): boolean {
  const zoneStripped = address.split("%", 1)[0] ?? address;
  const family = isIP(zoneStripped);
  if (family === 4) {
    return isDisallowedIpv4(zoneStripped);
  }
  if (family === 6) {
    return isDisallowedIpv6(zoneStripped);
  }
  return true;
}

/**
 * Downloads an external HTTP/HTTPS file stream with SSRF protection, redirect validation, and byte-size enforcement.
 * @param rawUrl - External HTTP or HTTPS URL to fetch.
 * @param options - Size limit, timeout, abort signal, SSRF policy, and optional DNS lookup override.
 * @returns Size-bounded readable stream, normalized content type, and final URL pathname.
 */
export async function fetchExternalFile(
  rawUrl: string,
  options: FetchExternalFileOptions = {},
): Promise<FetchedExternalFile> {
  const maxFileSize = options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
  const timeoutMs = options.timeout ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isSafeInteger(maxFileSize) || maxFileSize < 1) {
    throw new BadRequestException(
      "External file maxFileSize must be a positive integer",
    );
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
    throw new BadRequestException(
      "External file timeout must be a positive integer",
    );
  }

  const lookupFn = options.lookupFn ?? defaultHostLookup;
  const ssrfPolicy = isCompiledSsrfPolicy(options.ssrf)
    ? options.ssrf
    : compileSsrfPolicy(options.ssrf);
  let currentUrl = parseExternalHttpUrl(rawUrl);

  const deadline = Date.now() + timeoutMs;
  const timeoutError = new BadRequestException(
    "External file request timed out",
  );
  const { controller, dispose } = linkedAbortController(
    options.signal,
    timeoutMs,
    timeoutError,
  );
  const effectiveSignal = controller.signal;

  try {
    for (
      let redirectCount = 0;
      redirectCount <= MAX_REDIRECTS;
      redirectCount += 1
    ) {
      const pinned = await resolveTargetAddress(
        currentUrl.hostname,
        lookupFn,
        ssrfPolicy,
        effectiveSignal,
        timeoutError,
      );
      const remainingMs = Math.max(1, deadline - Date.now());
      const response = await sendPinnedGetRequest(
        currentUrl,
        pinned,
        remainingMs,
        effectiveSignal,
        timeoutError,
      );
      const statusCode = response.statusCode ?? 0;

      if (
        statusCode === 301 ||
        statusCode === 302 ||
        statusCode === 303 ||
        statusCode === 307 ||
        statusCode === 308
      ) {
        response.destroy();
        const location = response.headers.location;
        if (!location || redirectCount === MAX_REDIRECTS) {
          throw new BadRequestException(
            "External file URL exceeded allowed redirects",
          );
        }
        currentUrl = parseExternalHttpUrl(location, currentUrl);
        continue;
      }

      if (
        statusCode < 200 ||
        statusCode >= 300 ||
        statusCode === 206 ||
        response.headers["content-range"] !== undefined
      ) {
        response.destroy();
        throw new BadRequestException(
          `External file request failed with HTTP ${String(statusCode)}`,
        );
      }

      const rawContentType = response.headers["content-type"];
      const normalizedContentType = rawContentType
        ?.split(";", 1)[0]
        ?.trim()
        .toLowerCase();

      let decoder: Transform | undefined;
      try {
        decoder = resolveContentDecoder(response.headers["content-encoding"]);
      } catch (error) {
        response.destroy();
        throw error;
      }

      let effectiveMaxFileSize = maxFileSize;
      if (options.resolveMaxFileSize) {
        try {
          effectiveMaxFileSize = options.resolveMaxFileSize({
            contentType: normalizedContentType,
            pathname: currentUrl.pathname,
          });
        } catch (error) {
          decoder?.destroy();
          response.destroy();
          throw error;
        }
        if (
          !Number.isSafeInteger(effectiveMaxFileSize) ||
          effectiveMaxFileSize < 1
        ) {
          decoder?.destroy();
          response.destroy();
          throw new BadRequestException(
            "External file maxFileSize must be a positive integer",
          );
        }
      }

      const declaredLength = response.headers["content-length"];
      const maxWireBytes =
        decoder === undefined
          ? effectiveMaxFileSize
          : maxEncodedWireBytes(effectiveMaxFileSize);
      if (declaredLength !== undefined) {
        const parsedLength = Number(declaredLength);
        if (Number.isFinite(parsedLength) && parsedLength > maxWireBytes) {
          decoder?.destroy();
          response.destroy();
          throw new BadRequestException("External file exceeds maximum size");
        }
      }

      return {
        stream: createBoundedStream(
          response,
          decoder,
          effectiveMaxFileSize,
          effectiveSignal,
          timeoutError,
          dispose,
        ),
        ...(normalizedContentType
          ? { contentType: normalizedContentType }
          : {}),
        pathname: currentUrl.pathname,
      };
    }

    /* v8 ignore next -- loop returns or throws on MAX_REDIRECTS */
    throw new BadRequestException(
      "External file URL exceeded allowed redirects",
    );
  } catch (error) {
    dispose();
    throw error;
  }
}

/**
 * Type guard distinguishing a precompiled SSRF policy from raw options.
 * @param value - Candidate SSRF option value.
 * @returns True when `value` is a {@link CompiledSsrfPolicy}.
 */
function isCompiledSsrfPolicy(
  value: StorageSsrfOptions | CompiledSsrfPolicy | undefined,
): value is CompiledSsrfPolicy {
  return (
    typeof value === "object" &&
    value !== null &&
    "isAllowedHost" in value &&
    typeof value.isAllowedHost === "function"
  );
}

/**
 * Parses and validates an external HTTP(S) URL without embedded credentials or leaked base URLs.
 * @param rawUrl - Candidate URL or redirect `Location` string.
 * @param baseUrl - Optional redirect base URL.
 * @returns Parsed URL instance.
 */
function parseExternalHttpUrl(rawUrl: string, baseUrl?: URL): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl, baseUrl);
  } catch {
    throw new BadRequestException("Invalid file source URL");
  }

  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.username ||
    parsed.password
  ) {
    throw new BadRequestException("Invalid file source URL");
  }

  return parsed;
}

/**
 * Resolves a hostname with deadline/abort cancellation and enforces the active SSRF policy on all returned IPs.
 * @param hostname - URL hostname (IPv6 literals may include brackets).
 * @param lookupFn - DNS lookup implementation.
 * @param ssrfPolicy - Precompiled SSRF policy.
 * @param signal - Effective deadline and cancellation signal.
 * @param timeoutError - Error used when the fetch deadline expires.
 * @returns Non-empty list of validated IP addresses and families to pin on the socket.
 */
async function resolveTargetAddress(
  hostname: string,
  lookupFn: HostLookupFn,
  ssrfPolicy: CompiledSsrfPolicy,
  signal: AbortSignal,
  timeoutError: BadRequestException,
): Promise<ResolvedHostAddress[]> {
  throwIfSignalAborted(signal, timeoutError);

  const bareHost =
    hostname.startsWith("[") && hostname.endsWith("]")
      ? hostname.slice(1, -1)
      : hostname;
  const skipPrivateCheck =
    !ssrfPolicy.enabled || ssrfPolicy.isAllowedHost(bareHost);
  const directFamily = isIP(bareHost);
  if (directFamily !== 0) {
    if (!skipPrivateCheck && isPrivateOrReservedIp(bareHost)) {
      throw new BadRequestException(
        "External URL resolves to a disallowed network address",
      );
    }
    return [{ address: bareHost, family: directFamily }];
  }

  let records: ResolvedHostAddress[];
  try {
    records = await raceWithAbort(lookupFn(bareHost), signal, timeoutError);
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }
    throw new BadRequestException("Unable to resolve external file hostname");
  }

  if (
    records.length === 0 ||
    (!skipPrivateCheck &&
      records.some((record) => isPrivateOrReservedIp(record.address)))
  ) {
    throw new BadRequestException(
      "External URL resolves to a disallowed network address",
    );
  }

  return records;
}

/**
 * Races an async DNS operation against the fetch deadline / abort signal.
 * @param promise - Pending operation.
 * @param signal - Effective abort signal.
 * @param timeoutError - Deadline timeout exception.
 * @returns Resolved operation value.
 */
async function raceWithAbort<T>(
  promise: Promise<T>,
  signal: AbortSignal,
  timeoutError: BadRequestException,
): Promise<T> {
  if (signal.aborted) {
    promise.catch(() => undefined);
    throw abortException(signal, timeoutError);
  }

  return await new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      promise.catch(() => undefined);
      reject(abortException(signal, timeoutError));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

/**
 * Throws a normalized `BadRequestException` if `signal` has already aborted.
 * @param signal - Effective abort signal.
 * @param timeoutError - Deadline timeout exception.
 */
function throwIfSignalAborted(
  signal: AbortSignal,
  timeoutError: BadRequestException,
): void {
  if (signal.aborted) {
    throw abortException(signal, timeoutError);
  }
}

/**
 * Maps an aborted signal into the appropriate `BadRequestException`.
 * @param signal - Aborted signal.
 * @param timeoutError - Deadline timeout exception.
 * @param fallbackMessage - Message used for caller-initiated aborts.
 * @returns Normalized `BadRequestException`.
 */
function abortException(
  signal: AbortSignal,
  timeoutError: BadRequestException,
  fallbackMessage = "Failed to fetch external file URL",
): BadRequestException {
  if (signal.reason === timeoutError) {
    return timeoutError;
  }
  return signal.reason instanceof BadRequestException
    ? signal.reason
    : new BadRequestException(fallbackMessage);
}

/**
 * Default DNS lookup wrapper returning all resolved host addresses.
 * @param hostname - Hostname to resolve.
 * @returns Resolved IP records.
 */
async function defaultHostLookup(
  hostname: string,
): Promise<ResolvedHostAddress[]> {
  return await dnsLookup(hostname, { all: true, order: "verbatim" });
}

/**
 * Performs a single isolated HTTP(S) GET request pinned to the pre-validated IP addresses.
 * @param url - Target URL.
 * @param pinned - Non-empty list of validated IP addresses and families.
 * @param timeoutMs - Remaining deadline in milliseconds.
 * @param signal - Effective abort signal.
 * @param timeoutError - Deadline timeout exception.
 * @returns HTTP response stream once headers arrive.
 */
function sendPinnedGetRequest(
  url: URL,
  pinned: ResolvedHostAddress[],
  timeoutMs: number,
  signal: AbortSignal,
  timeoutError: BadRequestException,
): Promise<IncomingMessage> {
  const requestFn = url.protocol === "https:" ? httpsRequest : httpRequest;
  const primary = pinned[0];

  return new Promise<IncomingMessage>((resolve, reject) => {
    let settled = false;
    const fail = (error: Error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    };

    const req: ClientRequest = requestFn(
      url,
      {
        agent: false,
        headers: {
          "accept-encoding": "identity",
        },
        method: "GET",
        signal,
        timeout: timeoutMs,
        lookup: (_hostname, lookupOptions, callback) => {
          if (lookupOptions.all) {
            callback(null, pinned);
            return;
          }
          /* v8 ignore next -- Node 20+ passes { all: true } by default */
          callback(null, primary.address, primary.family);
        },
      },
      (res) => {
        settled = true;
        resolve(res);
      },
    );

    req.once("timeout", () => {
      req.destroy();
      fail(timeoutError);
    });
    req.once("error", () => {
      fail(
        signal.aborted
          ? abortException(signal, timeoutError)
          : new BadRequestException("Failed to fetch external file URL"),
      );
    });
    req.once("close", () => {
      fail(
        signal.aborted
          ? abortException(signal, timeoutError)
          : new BadRequestException("Failed to fetch external file URL"),
      );
    });
    req.end();
  });
}

/**
 * Resolves an optional decompression stream for the HTTP `Content-Encoding` header.
 * @param contentEncodingHeader - Raw `Content-Encoding` header value, if present.
 * @returns Decompression transform stream, or `undefined` for `identity`/absent encoding.
 */
function resolveContentDecoder(
  contentEncodingHeader: string | undefined,
): Transform | undefined {
  if (!contentEncodingHeader) {
    return undefined;
  }
  const activeEncodings = contentEncodingHeader
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => Boolean(entry) && entry !== "identity");

  if (activeEncodings.length === 0) {
    return undefined;
  }
  if (activeEncodings.length > 1) {
    throw new BadRequestException("Unsupported external file content encoding");
  }

  switch (activeEncodings[0]) {
    case "gzip":
    case "x-gzip":
      return createGunzip();
    case "deflate":
      return createInflate();
    case "br":
      return createBrotliDecompress();
    default:
      throw new BadRequestException(
        "Unsupported external file content encoding",
      );
  }
}

/**
 * Pipes an HTTP response (and optional content decoder) through a size- and deadline-bounded
 * Transform stream with native backpressure and premature-close detection.
 * @param response - Upstream HTTP IncomingMessage.
 * @param decoder - Optional zlib decompression stream.
 * @param maxFileSize - Maximum permitted decoded byte count.
 * @param signal - Effective abort signal.
 * @param timeoutError - Deadline timeout exception.
 * @param dispose - Callback releasing the deadline timer and upstream listener.
 * @returns Size-bounded Readable stream.
 */
function createBoundedStream(
  response: IncomingMessage,
  decoder: Transform | undefined,
  maxFileSize: number,
  signal: AbortSignal,
  timeoutError: BadRequestException,
  dispose: () => void,
): Readable {
  const limiter = createByteLimitTransform(maxFileSize);
  const wireLimiter = decoder
    ? createByteLimitTransform(maxEncodedWireBytes(maxFileSize))
    : undefined;
  // Keep an error listener attached from stream creation through async upload handoff
  // so `limiter.destroy(error)` sets `limiter.errored` without crashing Node.
  limiter.on("error", () => undefined);

  const failStream = (error?: unknown) => {
    if (!limiter.destroyed) {
      const mapped =
        error instanceof BadRequestException
          ? error
          : signal.aborted
            ? abortException(
                signal,
                timeoutError,
                "External file download aborted",
              )
            : new BadRequestException("External file download aborted");
      limiter.destroy(mapped);
    }
  };

  if (wireLimiter) {
    wireLimiter.on("error", (error) => {
      failStream(error);
    });
  }
  if (decoder) {
    decoder.on("error", () => {
      failStream(
        new BadRequestException("Invalid external file content encoding"),
      );
    });
  }

  const onAbort = () => {
    const error = abortException(
      signal,
      timeoutError,
      "External file download aborted",
    );
    response.destroy(error);
    wireLimiter?.destroy(error);
    decoder?.destroy(error);
    limiter.destroy(error);
  };
  if (signal.aborted) {
    onAbort();
    dispose();
    return limiter;
  }
  signal.addEventListener("abort", onAbort, { once: true });

  limiter.once("close", () => {
    signal.removeEventListener("abort", onAbort);
    dispose();
    if (decoder && !decoder.destroyed) {
      decoder.destroy();
    }
    if (wireLimiter && !wireLimiter.destroyed) {
      wireLimiter.destroy();
    }
    if (!response.destroyed) {
      response.destroy();
    }
  });

  response.once("error", (error) => {
    failStream(error);
  });
  response.once("close", () => {
    if (!response.complete) {
      failStream();
    }
  });

  if (wireLimiter && decoder) {
    response.pipe(wireLimiter).pipe(decoder).pipe(limiter);
  } else {
    response.pipe(limiter);
  }

  return limiter;
}

/**
 * Computes the maximum compressed wire byte allowance for a given decoded `maxBytes` ceiling
 * (~0.1% stored-block overhead + 1 KiB framing, exceeding zlib's worst-case `deflateBound`).
 * @param maxBytes - Configured decoded byte limit.
 * @returns Maximum permitted raw wire bytes before decompression.
 */
function maxEncodedWireBytes(maxBytes: number): number {
  return maxBytes + Math.ceil(maxBytes / 1024) + ENCODED_FRAMING_OVERHEAD_BYTES;
}

/**
 * Creates a Transform stream that aborts with `BadRequestException` once cumulative bytes exceed `maxBytes`.
 * @param maxBytes - Maximum permitted byte count.
 * @returns Byte-counting Transform stream.
 */
function createByteLimitTransform(maxBytes: number): Transform {
  let received = 0;
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.byteLength;
      if (received > maxBytes) {
        callback(new BadRequestException("External file exceeds maximum size"));
        return;
      }
      callback(null, chunk);
    },
  });
}

/**
 * Checks whether an IPv4 address falls inside private, loopback, link-local, or reserved blocks.
 * @param ip - Validated IPv4 string.
 * @returns True when disallowed.
 */
function isDisallowedIpv4(ip: string): boolean {
  const [a = 0, b = 0, c = 0, d = 0] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 168 && b === 63 && c === 129 && d === 16) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

/**
 * Checks whether an IPv6 address falls inside loopback, unique-local, link-local, site-local, multicast, NAT64, 6to4, Teredo, or mapped-private blocks.
 * @param ip - Validated IPv6 string.
 * @returns True when disallowed.
 */
function isDisallowedIpv6(ip: string): boolean {
  const groups = expandIpv6Groups(ip);
  const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6 = 0, g7 = 0] =
    groups;

  const allZeroPrefix =
    g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0;
  if (allZeroPrefix && g5 === 0) {
    return true;
  }
  if (g0 === 0x0100 && g1 === 0 && g2 === 0 && g3 === 0) {
    return true;
  }
  if (g0 === 0x0064 && g1 === 0xff9b && g2 === 0x0001) {
    return true;
  }
  if (
    (allZeroPrefix && g5 === 0xffff) ||
    (g0 === 0x0064 &&
      g1 === 0xff9b &&
      g2 === 0 &&
      g3 === 0 &&
      g4 === 0 &&
      g5 === 0)
  ) {
    const mappedIpv4 = `${String(g6 >> 8)}.${String(g6 & 0xff)}.${String(g7 >> 8)}.${String(g7 & 0xff)}`;
    return isDisallowedIpv4(mappedIpv4);
  }
  if (g0 === 0x2002) {
    const embedded6to4 = `${String(g1 >> 8)}.${String(g1 & 0xff)}.${String(g2 >> 8)}.${String(g2 & 0xff)}`;
    return isDisallowedIpv4(embedded6to4);
  }

  return (
    (g0 & 0xfe00) === 0xfc00 ||
    (g0 & 0xffc0) === 0xfe80 ||
    (g0 & 0xffc0) === 0xfec0 ||
    (g0 & 0xff00) === 0xff00 ||
    (g0 === 0x2001 &&
      (g1 === 0x0000 || (g1 === 0x0002 && g2 === 0) || g1 === 0x0db8))
  );
}

/**
 * Expands a valid IPv6 literal (including `::` and embedded IPv4 suffixes) into eight 16-bit integers.
 * @param ip - Validated IPv6 literal.
 * @returns Eight 16-bit group values.
 */
function expandIpv6Groups(ip: string): number[] {
  let normalized = ip.toLowerCase();
  const lastColon = normalized.lastIndexOf(":");
  const tail = normalized.slice(lastColon + 1);
  if (tail.includes(".")) {
    const [a = 0, b = 0, c = 0, d = 0] = tail.split(".").map(Number);
    const high = ((a << 8) | b).toString(16);
    const low = ((c << 8) | d).toString(16);
    normalized = `${normalized.slice(0, lastColon)}:${high}:${low}`;
  }

  const [headPart = "", tailPart] = normalized.split("::");
  const head = headPart
    ? headPart.split(":").map((part) => parseInt(part, 16))
    : [];
  if (tailPart === undefined) {
    return head;
  }
  const tailGroups = tailPart
    ? tailPart.split(":").map((part) => parseInt(part, 16))
    : [];
  const missing = 8 - head.length - tailGroups.length;
  return [...head, ...Array.from({ length: missing }, () => 0), ...tailGroups];
}
