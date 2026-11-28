import {
  GetObjectCommand,
  type S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";

import { type StorageModuleOptions } from "../interfaces/storage-module-options.interface.js";

const ENDPOINT_PROBE_SEGMENT = "__storage_probe__";

interface CapturedSerializedRequest {
  hostname: string;
  path: string;
  port?: number;
  protocol: string;
}

/**
 * Builds S3 client configuration with credentials, endpoint, and bucket addressing settings.
 * @param options - Storage module options.
 * @param endpointUrl - Normalized S3 endpoint URL, when configured.
 * @param bucketEndpoint - Whether the endpoint already identifies the bucket.
 * @returns AWS SDK S3Client configuration object.
 */
export function createS3ClientConfig(
  options: StorageModuleOptions,
  endpointUrl: string | undefined,
  bucketEndpoint: boolean,
): S3ClientConfig {
  const { accessKeyId, forcePathStyle, region, secretAccessKey } = options;

  return {
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey } }
      : {}),
    ...(endpointUrl ? { endpoint: endpointUrl } : {}),
    ...(bucketEndpoint ? { bucketEndpoint: true } : {}),
    ...(bucketEndpoint || forcePathStyle === undefined
      ? {}
      : { forcePathStyle }),
    ...(region ? { region } : {}),
  };
}

/**
 * Resolves the canonical base URL of a directory prefix using the S3 SDK's own command
 * serialization and endpoint middleware (supporting `AWS_ENDPOINT_URL_S3`, shared profiles,
 * `bucketEndpoint`, `forcePathStyle`, and virtual-hosted bucket addressing without credentials).
 * @param client - S3 client whose endpoint rules should be applied.
 * @param clientBucket - Bucket parameter passed to `GetObjectCommand` (`clientBucket` or `internalClientBucket`).
 * @param objectPrefix - Bucket-relative directory prefix without trailing slash (for example `"tmp"` or `"tenant/tmp"`).
 * @returns Base URL ending with `/` for objects under `objectPrefix`.
 */
export async function resolveS3PrefixBaseUrl(
  client: S3Client,
  clientBucket: string,
  objectPrefix: string,
): Promise<URL> {
  const stack = client.middlewareStack.clone();
  stack.remove("httpAuthSchemeMiddleware");

  let captured: CapturedSerializedRequest | undefined;
  stack.add(
    () => (args) => {
      captured = args.request as CapturedSerializedRequest;
      return Promise.resolve({ response: {}, output: { $metadata: {} } });
    },
    {
      step: "build",
      name: "captureStoragePrefixEndpointMiddleware",
      priority: "low",
      override: true,
    },
  );

  const command = new GetObjectCommand({
    Bucket: clientBucket,
    Key: `${objectPrefix}/${ENDPOINT_PROBE_SEGMENT}`,
  });
  const handler = command.resolveMiddleware(stack, client.config, {});
  await handler({ input: command.input });

  if (!captured) {
    /* v8 ignore next -- build step always executes before short-circuit return */
    throw new Error("Failed to resolve S3 prefix endpoint URL");
  }

  const port = captured.port === undefined ? "" : `:${String(captured.port)}`;
  const basePath = captured.path.replace(
    new RegExp(`/${ENDPOINT_PROBE_SEGMENT}$`),
    "/",
  );
  return new URL(
    `${captured.protocol}//${captured.hostname}${port}${basePath}`,
  );
}

/**
 * Returns the endpoint URL guaranteed to end with a trailing slash.
 * @param endpointUrl - Configured S3 endpoint URL.
 * @returns Endpoint URL with a trailing slash.
 */
export function ensureTrailingSlash(endpointUrl: string): string {
  const url = new URL(endpointUrl);
  url.pathname = `${url.pathname.replace(/\/$/, "")}/`;
  return url.toString();
}

/**
 * Strips trailing slashes from bucket-bound endpoint URLs, or returns `endpointUrl` unchanged.
 * @param endpointUrl - Configured S3 endpoint URL.
 * @param bucketEndpoint - Whether the endpoint already identifies the bucket.
 * @returns Normalized endpoint URL, or `undefined` when omitted.
 */
export function normalizeBucketEndpointUrl(
  endpointUrl: string | undefined,
  bucketEndpoint: boolean,
): string | undefined {
  if (!endpointUrl || !bucketEndpoint) {
    return endpointUrl;
  }

  const url = new URL(endpointUrl);
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

/**
 * Percent-encodes each `/` segment of a storage path using RFC 3986 / Smithy S3 URI encoding.
 * @param path - Forward-slash-delimited path.
 * @returns Percent-encoded path preserving `/` delimiters.
 */
export function encodeStoragePath(path: string): string {
  return path
    .split("/")
    .map((segment) =>
      encodeURIComponent(segment).replace(
        /[!'()*]/g,
        (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
      ),
    )
    .join("/");
}

/**
 * Checks whether an S3 client error indicates a missing object (`404` / `NotFound` / `NoSuchKey`).
 * @param error - Thrown value from S3 command execution.
 * @returns True when the object was not found.
 */
export function isS3NotFoundError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const candidate = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    candidate.name === "NotFound" ||
    candidate.name === "NoSuchKey" ||
    candidate.$metadata?.httpStatusCode === 404
  );
}
