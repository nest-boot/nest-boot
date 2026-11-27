export const DEFAULT_STORAGE_DOWNLOAD_PATH = "files";

/**
 * Resolves the static route segments before Nest adds its global prefix.
 * @param path - Download path relative to the global prefix.
 * @returns Normalized path without leading or trailing slashes.
 */
export function resolveStorageDownloadPath(
  path = DEFAULT_STORAGE_DOWNLOAD_PATH,
): string {
  const normalized = path.replace(/^\/+|\/+$/g, "");
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
      "Storage download path must contain only static URL segments",
    );
  }
  return normalized;
}
