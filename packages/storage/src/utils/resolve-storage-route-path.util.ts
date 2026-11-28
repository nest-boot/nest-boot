export const DEFAULT_STORAGE_DOWNLOAD_PATH = "downloads";
export const DEFAULT_STORAGE_UPLOAD_PATH = "uploads";

/**
 * Resolves static route segments before Nest adds its global prefix.
 * @param path - Route path relative to the global prefix.
 * @param defaultPath - Fallback path when `path` is undefined.
 * @param label - Route label included in validation errors.
 * @returns Normalized route path without leading or trailing slashes.
 */
export function resolveStorageRoutePath(
  path: string | undefined,
  defaultPath: string,
  label: "download" | "upload",
): string {
  const normalized = (path ?? defaultPath).replace(/^\/+|\/+$/g, "");
  const invalid = normalized
    .split("/")
    .some(
      (segment) =>
        !/^[a-zA-Z0-9._~-]+$/.test(segment) ||
        segment === "." ||
        segment === "..",
    );

  if (invalid) {
    throw new Error(
      `Storage ${label} path must contain only static URL segments`,
    );
  }
  return normalized;
}
